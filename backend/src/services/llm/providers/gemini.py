"""Google Gemini provider for the Sentinel RAG LLM service layer.

This module integrates the official google-genai SDK, supporting both synchronized
and asynchronous (streaming) LLM calls, robust error mapping, and specialized Vertex AI
support for enterprise deployments.

Supported features
------------------
 - Blocking completions via aio.models.generate_content
 - True async streaming via aio.models.generate_content_stream
 - Pre-flight token counting via aio.models.count_tokens (async)
 - Sync approximation via tiktoken cl100k_base (count_tokens)
 - Automatic system_instruction extraction (Gemini top-level param)
 - Full Gemini FinishReason → our FinishReason mapping (SAFETY, RECITATION…)
 - Health-check via zero-cost count_tokens probe
 - Vertex AI support via vertexai=True + project/location config
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import tiktoken
from google.genai import Client
from google.genai import errors as genai_errors
from google.genai import types as genai_types

from ..base import (
    FinishReason,
    LLMProvider,
    LLMRequest,
    LLMResponse,
    Message,
    ProviderCapabilities,
    ProviderType,
    RetryPolicy,
    Role,
    StreamChunk,
    TokenUsage,
)
from ..exceptions import (
    LLMAuthenticationError,
    LLMContentFilterError,
    LLMProviderError,
    LLMProviderInitError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMTokenLimitError,
)

logger = logging.getLogger(__name__)


_DEFAULT_MODEL = "gemini-3-flash-preview"
_MAX_CONTEXT_TOKENS = 1_048_576
_HEALTH_CHECK_TIMEOUT_S = 5.0

# Translates Gemini finish reasons to internal FinishReason enum.
_FINISH_REASON_MAP: dict[str, FinishReason] = {
    "STOP": FinishReason.STOP,
    "MAX_TOKENS": FinishReason.LENGTH,
    "SAFETY": FinishReason.CONTENT_FILTER,
    "RECITATION": FinishReason.CONTENT_FILTER,  # Copyright / recitation block
    "BLOCKLIST": FinishReason.CONTENT_FILTER,
    "PROHIBITED_CONTENT": FinishReason.CONTENT_FILTER,
    "SPII": FinishReason.CONTENT_FILTER,  # Sensitive PII detection
    "IMAGE_SAFETY": FinishReason.CONTENT_FILTER,
    "MALFORMED_FUNCTION_CALL": FinishReason.TOOL_CALL,
    "UNEXPECTED_TOOL_CALL": FinishReason.TOOL_CALL,
    "LANGUAGE": FinishReason.UNKNOWN,
    "OTHER": FinishReason.UNKNOWN,
    "IMAGE_OTHER": FinishReason.UNKNOWN,
    "FINISH_REASON_UNSPECIFIED": FinishReason.UNKNOWN,
}

# Guards against repeated tiktoken BPE download attempts in air-gapped environments.
_TIKTOKEN_UNAVAILABLE = object()


# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------


@dataclass
class GeminiConfig:
    """Typed configuration for the Gemini provider."""

    api_key: str = ""
    model: str = _DEFAULT_MODEL
    vertexai: bool = False
    project: str = ""
    location: str = ""
    timeout_s: float = 60.0
    extra_headers: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.vertexai and not self.api_key.strip():
            raise LLMProviderInitError(
                (
                    "GeminiConfig.api_key must be a non-empty string when not using "
                    "Vertex AI. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in your env."
                ),
                provider="gemini",
            )
        if self.vertexai and (not self.project or not self.location):
            raise LLMProviderInitError(
                (
                    "GeminiConfig.project and GeminiConfig.location are required "
                    "when vertexai=True."
                ),
                provider="gemini",
            )
        if self.timeout_s <= 0:
            raise LLMProviderInitError(
                f"GeminiConfig.timeout_s must be positive, got {self.timeout_s}",
                provider="gemini",
            )

    @classmethod
    def from_dict(cls, cfg: dict[str, Any]) -> "GeminiConfig":
        """Build from the raw config slice.

        Args:
            cfg: The configuration dictionary.

        Returns:
            A GeminiConfig instance.
        """
        return cls(
            api_key=cfg.get("api_key", ""),
            model=cfg.get("model", _DEFAULT_MODEL),
            vertexai=bool(cfg.get("vertexai", False)),
            project=cfg.get("project", ""),
            location=cfg.get("location", ""),
            timeout_s=float(cfg.get("timeout_s", 60.0)),
            extra_headers=dict(cfg.get("extra_headers", {})),
        )


# ===========================================================================
# Provider implementation
# ===========================================================================


class GeminiProvider(LLMProvider):
    """Google Gemini provider implementation."""

    PROVIDER_TYPE = ProviderType.GEMINI
    DEFAULT_MODEL = _DEFAULT_MODEL
    CAPABILITIES = ProviderCapabilities(
        supports_streaming=True,
        supports_system_prompt=True,
        supports_tool_calling=True,
        supports_vision=True,
        max_context_tokens=_MAX_CONTEXT_TOKENS,
        provider_type=ProviderType.GEMINI,
    )
    RETRY_POLICY = RetryPolicy(
        max_attempts=3,
        base_delay_s=2.0,  # Uses extended back-off for quota limits
        max_delay_s=60.0,
        exponential_base=2.0,
        jitter=True,
        retryable_status_codes=frozenset({408, 429, 500, 502, 503, 504}),
    )

    def __init__(self, config: "GeminiConfig | dict[str, Any]") -> None:
        """Initialize the GeminiProvider.

        Args:
            config: The endpoint configuration.
        """
        if isinstance(config, dict):
            config = GeminiConfig.from_dict(config)

        super().__init__(config.__dict__)
        self._cfg: GeminiConfig = config
        self._client: Client | None = None
        self._encoder: Any = None

    # ------------------------------------------------------------------
    # Lifecycle methods
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Instantiate the Client and run a credential probe.

        Raises:
            LLMProviderInitError: If credentials or network communication fail.
        """
        if self._initialized:
            logger.debug("GeminiProvider already initialised — skipping.")
            return

        logger.info(
            "Initialising GeminiProvider (model=%r, vertexai=%s).",
            self._cfg.model,
            self._cfg.vertexai,
        )

        try:
            if self._cfg.vertexai:
                self._client = Client(
                    vertexai=True,
                    project=self._cfg.project,
                    location=self._cfg.location,
                    http_options=self._build_http_options(),
                )
            else:
                self._client = Client(
                    api_key=self._cfg.api_key,
                    http_options=self._build_http_options(),
                )
        except Exception as exc:
            raise LLMProviderInitError(
                "Failed to create google-genai Client.",
                provider="gemini",
                details={"error": str(exc)},
            ) from exc

        # Probes credentials via zero-inference token check.
        try:
            await asyncio.wait_for(
                self._client.aio.models.count_tokens(
                    model=self._cfg.model,
                    contents="ping",
                ),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
        except genai_errors.ClientError as exc:
            if exc.code in {401, 403}:
                raise LLMProviderInitError(
                    f"Gemini API key is invalid or lacks permission: {exc.message}",
                    provider="gemini",
                    details={"error": str(exc)},
                ) from exc
            logger.warning(
                "GeminiProvider credential probe returned %s (non-fatal): %s",
                exc.code,
                exc.message,
            )
        except Exception as exc:
            logger.warning(
                "GeminiProvider credential probe failed (non-fatal): %s", exc
            )

        self._initialized = True
        logger.info("GeminiProvider initialised successfully.")

    async def shutdown(self) -> None:
        """Close the Gemini SDK client."""
        if self._client is not None:
            try:
                await self._client.aio.aclose()
                self._client.close()
            except Exception as exc:
                logger.warning("Error closing Gemini client: %s", exc)
            finally:
                self._client = None
                self._initialized = False
                logger.debug("GeminiProvider shut down.")

    # ------------------------------------------------------------------
    # Core inference methods
    # ------------------------------------------------------------------

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute a blocking completion request.

        Args:
            request: The generation request.

        Returns:
            A populated LLMResponse.

        Raises:
            LLMTimeoutError: If the execution time limit is reached.
            LLMProviderError: On error executing the completion request.
            LLMContentFilterError: If the response is blocked by safety filters.
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        system_instruction, contents = self._split_messages(request.messages)
        gen_cfg = self._build_generation_config(request, system_instruction)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "Gemini complete | model=%s turns=%d",
            model,
            len(contents),
        )

        try:
            raw: genai_types.GenerateContentResponse = await asyncio.wait_for(
                self._client.aio.models.generate_content(
                    model=model,
                    contents=contents,
                    config=gen_cfg,
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"Gemini request timed out after {elapsed:.1f}s (limit={timeout}s)",
                elapsed_s=elapsed,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc
        except genai_errors.ClientError as exc:
            raise self._map_client_error(exc) from exc
        except genai_errors.ServerError as exc:
            raise LLMProviderError(
                f"Gemini server error: {exc.message}",
                status_code=exc.code,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc
        except genai_errors.APIError as exc:
            raise LLMProviderError(
                f"Gemini API error: {exc.message}",
                status_code=exc.code,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc

        return self._build_response(raw, request, start)

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamChunk]:
        """Yield token deltas as an async stream from the Gemini API.

        Args:
            request: The streaming generation request.

        Returns:
            An async iterator of stream chunks.

        Raises:
            LLMTimeoutError: If stream connection operations time out.
            LLMProviderError: On error streaming from the API.
            LLMContentFilterError: If the response is blocked by safety filters.
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        system_instruction, contents = self._split_messages(request.messages)
        gen_cfg = self._build_generation_config(request, system_instruction)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "Gemini stream | model=%s",
            model,
        )

        finish_reason = FinishReason.UNKNOWN
        usage = TokenUsage.empty()
        model_version = model
        any_chunk_yielded = False

        try:
            async with asyncio.timeout(timeout):
                async for (
                    chunk
                ) in await self._client.aio.models.generate_content_stream(
                    model=model,
                    contents=contents,
                    config=gen_cfg,
                ):
                    delta = chunk.text or ""

                    # Updates usage and finish_reason properties incrementally.
                    # Retains the last non-None value as authoritative final state.
                    if chunk.usage_metadata is not None:
                        usage = TokenUsage(
                            prompt_tokens=chunk.usage_metadata.prompt_token_count or 0,
                            completion_tokens=(
                                chunk.usage_metadata.candidates_token_count or 0
                            ),
                            total_tokens=chunk.usage_metadata.total_token_count or 0,
                        )
                    if chunk.candidates:
                        candidate = chunk.candidates[0]
                        if candidate.finish_reason is not None:
                            finish_reason = _FINISH_REASON_MAP.get(
                                candidate.finish_reason.value, FinishReason.UNKNOWN
                            )
                    if chunk.model_version:
                        model_version = chunk.model_version

                    if delta:
                        any_chunk_yielded = True
                        yield StreamChunk(delta=delta)

        except asyncio.TimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"Gemini stream timed out after {elapsed:.1f}s",
                elapsed_s=elapsed,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc
        except genai_errors.ClientError as exc:
            raise self._map_client_error(exc) from exc
        except genai_errors.ServerError as exc:
            raise LLMProviderError(
                f"Gemini server error (stream): {exc.message}",
                status_code=exc.code,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc
        except genai_errors.APIError as exc:
            raise LLMProviderError(
                f"Gemini API error (stream): {exc.message}",
                status_code=exc.code,
                provider="gemini",
                details={"error": str(exc)},
            ) from exc

        # Raises content-filter error after stream if safety policies block all output.
        if finish_reason == FinishReason.CONTENT_FILTER:
            raise LLMContentFilterError(
                "Gemini stream blocked by content/safety filter.",
                provider="gemini",
            )

        # Guarantees minimum one chunk yield for empty responses.
        if not any_chunk_yielded:
            yield StreamChunk(delta="")

        # Yields final sentinel chunk with authoritative metadata.
        yield StreamChunk(
            delta="",
            is_final=True,
            finish_reason=finish_reason,
            usage=usage,
            model=model_version,
            provider=ProviderType.GEMINI,
            latency_ms=(time.monotonic() - start) * 1_000,
        )

    # ------------------------------------------------------------------
    # Health and introspection
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Probe reachability via a lightweight token count call.

        Returns:
            True if the provider is fully operational, False otherwise.
        """
        if self._client is None:
            return False
        try:
            await asyncio.wait_for(
                self._client.aio.models.count_tokens(
                    model=self._cfg.model,
                    contents="ping",
                ),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
            return True
        except Exception as exc:
            logger.warning("GeminiProvider health_check failed: %s", exc)
            return False

    def count_tokens(self, text: str) -> int:
        """Approximate the token count for a text sequence.

        Args:
            text: The targeted text string.

        Returns:
            The number of tokens the string represents.
        """
        if self._encoder is None:
            try:
                self._encoder = tiktoken.get_encoding("cl100k_base")
            except Exception as exc:
                logger.warning(
                    "tiktoken BPE load failed (%s); "
                    "falling back to character-based estimate.",
                    exc,
                )
                self._encoder = _TIKTOKEN_UNAVAILABLE

        if self._encoder is _TIKTOKEN_UNAVAILABLE:
            return max(1, len(text) // 4)

        return len(self._encoder.encode(text))

    async def async_count_tokens(self, request: LLMRequest) -> int:
        """Return the exact prompt token count via the Gemini API.

        Args:
            request: The generation request carrying target text.

        Returns:
            The specific token count according to Gemini's models.
        """
        self._assert_initialized()
        assert self._client is not None

        _, contents = self._split_messages(request.messages)
        result = await self._client.aio.models.count_tokens(
            model=request.model or self._cfg.model,
            contents=contents,
        )
        return result.total_tokens or 0

    # ------------------------------------------------------------------
    # Private helper methods
    # ------------------------------------------------------------------

    def _build_http_options(self) -> genai_types.HttpOptions:
        """Build HttpOptions, injecting any extra headers from the config.

        Returns:
            The constructed HttpOptions.
        """
        kwargs: dict[str, Any] = {}
        if self._cfg.extra_headers:
            kwargs["headers"] = self._cfg.extra_headers
        return genai_types.HttpOptions(**kwargs)

    @staticmethod
    def _split_messages(
        messages: list[Message],
    ) -> tuple[str, list[genai_types.Content]]:
        """Separate the system instruction from conversation turns.

        Args:
            messages: The list of combined messages.

        Returns:
            A tuple of the separated system instruction and list of Content objects.
        """
        system_parts: list[str] = []
        contents: list[genai_types.Content] = []

        for msg in messages:
            if msg.role == Role.SYSTEM:
                system_parts.append(msg.content)
            else:
                gemini_role = "model" if msg.role == Role.ASSISTANT else "user"
                contents.append(
                    genai_types.Content(
                        role=gemini_role,
                        parts=[genai_types.Part(text=msg.content)],
                    )
                )

        return "\n\n---\n\n".join(system_parts), contents

    @staticmethod
    def _build_generation_config(
        request: LLMRequest,
        system_instruction: str,
    ) -> genai_types.GenerateContentConfig:
        """Build GenerateContentConfig from an LLMRequest.

        Args:
            request: The generation request.
            system_instruction: The separated system instruction.

        Returns:
            The constructed generation config object.
        """
        return genai_types.GenerateContentConfig(
            system_instruction=system_instruction if system_instruction else None,
            temperature=request.temperature,
            top_p=request.top_p if request.top_p != 1.0 else None,
            max_output_tokens=request.max_tokens,
            stop_sequences=request.stop_sequences if request.stop_sequences else None,
        )

    def _build_response(
        self,
        raw: genai_types.GenerateContentResponse,
        request: LLMRequest,
        start: float,
    ) -> LLMResponse:
        """Map a GenerateContentResponse to an LLMResponse.

        Args:
            raw: The native generate content response.
            request: The originating generation request.
            start: The performance start time.

        Returns:
            The constructed LLMResponse domain object.

        Raises:
            LLMContentFilterError: If the response was blocked by safety filters.
        """
        content = raw.text or ""

        finish_reason = FinishReason.UNKNOWN
        if raw.candidates:
            candidate = raw.candidates[0]
            if candidate.finish_reason is not None:
                finish_reason = _FINISH_REASON_MAP.get(
                    candidate.finish_reason.value, FinishReason.UNKNOWN
                )

        if finish_reason == FinishReason.CONTENT_FILTER:
            raise LLMContentFilterError(
                "Gemini response blocked by content/safety filter.",
                provider="gemini",
            )

        usage = TokenUsage.empty()
        if raw.usage_metadata is not None:
            usage = TokenUsage(
                prompt_tokens=raw.usage_metadata.prompt_token_count or 0,
                completion_tokens=raw.usage_metadata.candidates_token_count or 0,
                total_tokens=raw.usage_metadata.total_token_count or 0,
            )

        model_version = getattr(raw, "model_version", None) or (
            request.model or self._cfg.model
        )

        return LLMResponse(
            content=content,
            finish_reason=finish_reason,
            usage=usage,
            model=model_version,
            provider=ProviderType.GEMINI,
            latency_ms=(time.monotonic() - start) * 1_000,
            raw_response=raw,
        )

    def _map_client_error(
        self,
        exc: genai_errors.ClientError,
    ) -> Exception:
        """Map a Gemini ClientError to the most specific LLMError.

        Args:
            exc: The native client error.

        Returns:
            The mapped domain exception.
        """
        code = exc.code or 0
        message = exc.message

        if code in {401, 403}:
            return LLMAuthenticationError(
                "Gemini authentication failed.",
                provider="gemini",
                details={"error": str(exc)},
            )
        if code == 429:
            return LLMRateLimitError(
                "Gemini rate limit exceeded.",
                provider="gemini",
                details={"error": str(exc)},
            )
        if code == 400 and ("token" in message.lower() or "context" in message.lower()):
            return LLMTokenLimitError(
                "Prompt exceeds Gemini context window.",
                context_limit=_MAX_CONTEXT_TOKENS,
                provider="gemini",
                details={"error": str(exc)},
            )
        return LLMProviderError(
            f"Gemini client error: {message}",
            status_code=code,
            provider="gemini",
            details={"error": str(exc)},
        )
