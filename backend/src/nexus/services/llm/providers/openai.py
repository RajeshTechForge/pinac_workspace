"""OpenAI & OpenAI-Compatible provider for the Sentinel RAG LLM service layer.

This module integrates the official "openai" Python SDK and is compatible
with any endpoint that follows the OpenAI Chat Completions API specification.

Supported features
------------------
  - Blocking completions via Chat Completions API (complete)
  - True async streaming via chat.completions.stream (stream)
  - Startup credential probe via models.list (initialize)
  - Health-check via a lightweight models.list probe (health_check)
  - OpenAI-compatible endpoint support via base_url override (OpenAI, NVIDIA NIM, proxies)
  - System prompts supported inline as standard "role=system" messages
  - tiktoken-based token counting (cl100k_base) with air-gapped fallback (count_tokens)
  - SDK/network error mapping into the Sentinel LLM exception hierarchy
  - Retry-After header extraction for rate-limit responses (429)
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import tiktoken
from openai import (
    APIConnectionError,
    APIError,
    APIResponseValidationError,
    APIStatusError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    BadRequestError,
    ConflictError,
    InternalServerError,
    NotFoundError,
    PermissionDeniedError,
    RateLimitError,
    UnprocessableEntityError,
)
from openai.types.chat import ChatCompletion, ChatCompletionChunk

from ..base import (
    FinishReason,
    LLMProvider,
    LLMRequest,
    LLMResponse,
    Message,
    ProviderCapabilities,
    ProviderType,
    RetryPolicy,
    StreamChunk,
    ThinkingConfig,
    TokenUsage,
)
from ..exceptions import (
    LLMAuthenticationError,
    LLMProviderError,
    LLMProviderInitError,
    LLMRateLimitError,
    LLMTimeoutError,
)

logger = logging.getLogger(__name__)


_DEFAULT_MODEL = "gpt-4o-mini"
_MAX_CONTEXT_TOKENS = 128_000
_HEALTH_CHECK_TIMEOUT_S = 8.0

# Guards against repeated tiktoken BPE download attempts in air-gapped environments.
_TIKTOKEN_UNAVAILABLE = object()

# Translates OpenAI finish_reason strings to the internal FinishReason enum.
_FINISH_REASON_MAP: dict[str | None, FinishReason] = {
    "stop": FinishReason.STOP,
    "length": FinishReason.LENGTH,
    "tool_calls": FinishReason.TOOL_CALL,
    "function_call": FinishReason.TOOL_CALL,
    "content_filter": FinishReason.CONTENT_FILTER,
    None: FinishReason.UNKNOWN,
}


# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------


@dataclass
class OpenAIConfig:
    """Typed configuration for the OpenAI-compatible provider.

    This config supports any OpenAI-spec endpoint.  To use NVIDIA NIM set
    "base_url" to ""https://integrate.api.nvidia.com/v1"" and provide
    your NVIDIA API key via "api_key".

    Attributes:
        api_key: Provider API key.  Must be non-empty.
        model: The model identifier to use for generation.
        base_url: Optional override for the API base URL.  Useful for NVIDIA
            NIM, Azure OpenAI, self-hosted vLLM, or any proxy endpoint.
            When "None" the SDK default ("api.openai.com") is used.
        max_retries: Number of SDK-level automatic retries.  Sentinel's own
            retry wrapper sits on top of this.
        timeout_s: Per-request wall-clock timeout in seconds.
        extra_headers: Arbitrary HTTP headers injected into every request.
            Useful for tracing ("X-Request-ID") or gateway auth headers.
        organization: Optional OpenAI organization ID.  Ignored by
            non-OpenAI endpoints.
    """

    api_key: str
    model: str = _DEFAULT_MODEL
    base_url: str | None = None
    max_retries: int = 0
    timeout_s: float = 60.0
    extra_headers: dict[str, str] = field(default_factory=dict)
    organization: str | None = None

    def __post_init__(self) -> None:
        if not self.api_key or not self.api_key.strip():
            raise LLMProviderInitError(
                (
                    "OpenAIConfig.api_key must be a non-empty string. "
                    "Set OPENAI_API_KEY (or NVIDIA_API_KEY) in your environment."
                ),
                provider="openai",
            )
        if self.timeout_s <= 0:
            raise LLMProviderInitError(
                f"OpenAIConfig.timeout_s must be positive, got {self.timeout_s}",
                provider="openai",
            )
        if self.max_retries < 0:
            raise LLMProviderInitError(
                f"OpenAIConfig.max_retries must be ≥ 0, got {self.max_retries}",
                provider="openai",
            )

    @classmethod
    def from_dict(cls, cfg: dict[str, Any]) -> "OpenAIConfig":
        """Build from the raw config slice.

        Accepts both the "[llm.providers.openai]" and any
        "[llm.providers.nvidia]" sub-table from "config.toml"; the
        caller is responsible for merging the "api_key" field before
        passing the dict here.

        Args:
            cfg: The raw configuration dictionary (already merged with
                any provider-level defaults from "config.toml").

        Returns:
            A fully validated :class:'OpenAIConfig' instance.

        Raises:
            LLMProviderInitError: If required fields are missing or invalid.
        """
        return cls(
            api_key=cfg["api_key"],
            model=cfg.get("model", _DEFAULT_MODEL),
            base_url=cfg.get("base_url") or None,  # Coerce "" → None
            max_retries=int(cfg.get("max_retries", 0)),
            timeout_s=float(cfg.get("timeout_s", 60.0)),
            extra_headers=dict(cfg.get("extra_headers", {})),
            organization=cfg.get("organization") or None,
        )


# ===========================================================================
# Provider implementation
# ===========================================================================


class OpenAIProvider(LLMProvider):
    """OpenAI-compatible provider implementation.

    Works out-of-the-box with:

    * **OpenAI** — default, no "base_url" required.
    * **NVIDIA NIM** — set "base_url = "https://integrate.api.nvidia.com/v1""
      and provide an NVIDIA API key.
    * Any other endpoint that implements the OpenAI Chat Completions API.

    The provider is fully async, supports both blocking and streaming
    completions, exposes tiktoken-based token counting, and maps all SDK
    exceptions to the Sentinel LLM exception hierarchy.
    """

    PROVIDER_TYPE = ProviderType.OPENAI
    DEFAULT_MODEL = _DEFAULT_MODEL
    CAPABILITIES = ProviderCapabilities(
        supports_streaming=True,
        supports_system_prompt=True,
        supports_tool_calling=True,
        supports_vision=True,
        supports_thinking=True,
        max_context_tokens=_MAX_CONTEXT_TOKENS,
        provider_type=ProviderType.OPENAI,
    )
    RETRY_POLICY = RetryPolicy(
        max_attempts=3,
        base_delay_s=1.0,
        max_delay_s=60.0,
        exponential_base=2.0,
        jitter=True,
        retryable_status_codes=frozenset({408, 429, 500, 502, 503, 504}),
    )

    def __init__(self, config: "OpenAIConfig | dict[str, Any]") -> None:
        """Initialize the OpenAIProvider.

        Args:
            config: Either an :class:'OpenAIConfig' instance or a raw
                dictionary that will be coerced into one.
        """
        if isinstance(config, dict):
            config = OpenAIConfig.from_dict(config)

        # Satisfies LLMProvider.__init__ dictionary configuration requirement.
        super().__init__(config.__dict__)
        self._cfg: OpenAIConfig = config
        self._client: AsyncOpenAI | None = None

        # Holds the lazy-loaded tiktoken encoder. Uses _TIKTOKEN_UNAVAILABLE on failure.
        self._encoder: Any = None

    # ------------------------------------------------------------------
    # Lifecycle methods
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Instantiate the async HTTP client and validate credentials.

        Probes the endpoint with a lightweight "models.list" call so that
        credential failures are surfaced at startup, not at inference time.

        Raises:
            LLMProviderInitError: If the API key is invalid, the endpoint
                is unreachable, or client construction fails.
        """
        if self._initialized:
            logger.debug("OpenAIProvider already initialised — skipping.")
            return

        logger.info(
            "Initialising OpenAIProvider (model=%r, base_url=%r).",
            self._cfg.model,
            self._cfg.base_url or "default (api.openai.com)",
        )

        try:
            self._client = AsyncOpenAI(
                api_key=self._cfg.api_key,
                base_url=self._cfg.base_url,
                max_retries=self._cfg.max_retries,
                default_headers=self._cfg.extra_headers or None,
                organization=self._cfg.organization,
                # Per-request timeouts are applied via asyncio.wait_for to ensure
                # consistent LLMTimeoutError mapping regardless of SDK internals.
                timeout=None,
            )
        except Exception as exc:
            raise LLMProviderInitError(
                "Failed to create AsyncOpenAI client.", provider="openai"
            ) from exc

        # Validate credentials via a lightweight list call that consumes no tokens.
        try:
            await asyncio.wait_for(
                self._client.models.list(),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
        except Exception as exc:
            raise self._map_openai_error(exc) from exc

        self._initialized = True
        logger.info("OpenAIProvider initialised successfully.")

    async def shutdown(self) -> None:
        """Close the underlying HTTPX connection pool gracefully."""
        if self._client is not None:
            try:
                await self._client.close()
            except Exception as exc:
                logger.warning("Error closing OpenAI client: %s", exc)
            finally:
                self._client = None
                self._initialized = False
                logger.debug("OpenAIProvider shut down.")

    async def _init_client_only(self) -> None:
        """Create the AsyncOpenAI HTTP client without running a credential probe.

        Intended for use by :class:'~src.services.llm.byok.BYOKLLMService' so that
        authentication errors surface from the first inference call rather than
        from a pre-flight "models.list" probe, avoiding extra latency and
        billable probe requests for each BYOK user key.

        Raises:
            LLMProviderInitError: If the AsyncOpenAI client cannot be created.
        """
        if self._initialized:
            return

        try:
            self._client = AsyncOpenAI(
                api_key=self._cfg.api_key,
                base_url=self._cfg.base_url,
                max_retries=self._cfg.max_retries,
                default_headers=self._cfg.extra_headers or None,
                organization=self._cfg.organization,
                timeout=None,
            )
        except Exception as exc:
            raise LLMProviderInitError(
                "Failed to create AsyncOpenAI client.", provider="openai"
            ) from exc

        self._initialized = True
        logger.debug("OpenAIProvider client created (credential probe skipped).")

    # ------------------------------------------------------------------
    # Core inference methods
    # ------------------------------------------------------------------

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute a blocking Chat Completions request.

        Args:
            request: The generation request containing messages and parameters.

        Returns:
            A populated :class:'LLMResponse'.

        Raises:
            LLMTimeoutError: If the request exceeds the configured timeout.
            LLMRateLimitError: On HTTP 429 from the provider.
            LLMTokenLimitError: If the prompt exceeds the model context window.
            LLMAuthenticationError: On credential failures.
            LLMProviderError: On any other provider-side error.
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        messages = self._build_message_list(request.messages)
        thinking_kwargs = self._build_thinking_params(request.thinking)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "OpenAI complete | model=%s messages=%d thinking=%s",
            model,
            len(messages),
            bool(thinking_kwargs),
        )

        try:
            raw: ChatCompletion = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=model,
                    messages=messages,
                    # reasoning models require max_completion_tokens.
                    max_completion_tokens=request.max_tokens,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    stop=request.stop_sequences or None,
                    stream=False,
                    **thinking_kwargs,
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"OpenAI request timed out after {elapsed:.1f}s (limit={timeout}s)",
                elapsed_s=elapsed,
                provider="openai",
            ) from exc

        except Exception as exc:
            raise self._map_openai_error(exc) from exc

        return self._build_response(raw, request, start)

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamChunk]:
        """Yield token deltas as an async stream from the Chat Completions API.

        Args:
            request: The streaming generation request.

        Yields:
            :class:'StreamChunk' objects for each token delta, with a final
            sentinel chunk containing aggregated usage and metadata.

        Raises:
            LLMTimeoutError: If the stream connection times out.
            LLMRateLimitError: On HTTP 429 during streaming.
            LLMTokenLimitError: If context window exceeded.
            LLMAuthenticationError: On credential failure.
            LLMProviderError: On any other streaming error.
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        messages = self._build_message_list(request.messages)
        thinking_kwargs = self._build_thinking_params(request.thinking)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "OpenAI stream | model=%s thinking=%s",
            model,
            bool(thinking_kwargs),
        )

        finish_reason = FinishReason.UNKNOWN
        usage = TokenUsage.empty()
        model_version = model

        try:
            async with asyncio.timeout(timeout):
                async with self._client.chat.completions.stream(
                    model=model,
                    messages=messages,
                    # reasoning models require max_completion_tokens.
                    max_completion_tokens=request.max_tokens,
                    temperature=request.temperature,
                    top_p=request.top_p,
                    stop=request.stop_sequences or None,
                    **thinking_kwargs,
                ) as stream_mgr:
                    async for chunk in stream_mgr:
                        chunk: ChatCompletionChunk
                        if not chunk.choices:
                            continue

                        choice = chunk.choices[0]
                        delta_text = (
                            choice.delta.content
                            if choice.delta and choice.delta.content
                            else ""
                        )

                        # Resolve finish_reason from the last chunk that carries it.
                        if choice.finish_reason is not None:
                            finish_reason = _FINISH_REASON_MAP.get(
                                choice.finish_reason, FinishReason.UNKNOWN
                            )

                        # Stream-level usage arrives in the final chunk's usage field.
                        if chunk.usage is not None:
                            thinking_toks = 0
                            comp_toks = chunk.usage.completion_tokens or 0
                            if hasattr(chunk.usage, "completion_tokens_details"):
                                details = chunk.usage.completion_tokens_details
                                if details and hasattr(details, "reasoning_tokens"):
                                    thinking_toks = details.reasoning_tokens or 0
                                    comp_toks = comp_toks - thinking_toks
                            usage = TokenUsage(
                                prompt_tokens=chunk.usage.prompt_tokens or 0,
                                completion_tokens=comp_toks,
                                thinking_tokens=thinking_toks,
                                total_tokens=chunk.usage.total_tokens or 0,
                            )

                        if chunk.model:
                            model_version = chunk.model

                        if delta_text:
                            yield StreamChunk(delta=delta_text)

        except asyncio.TimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"OpenAI stream timed out after {elapsed:.1f}s",
                elapsed_s=elapsed,
                provider="openai",
            ) from exc

        except Exception as exc:
            raise self._map_openai_error(exc) from exc

        # Yield the final sentinel chunk with authoritative metadata.
        yield StreamChunk(
            delta="",
            is_final=True,
            finish_reason=finish_reason,
            usage=usage,
            model=model_version,
            provider=ProviderType.OPENAI,
            latency_ms=(time.monotonic() - start) * 1_000,
        )

    # ------------------------------------------------------------------
    # Health and introspection
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Probe endpoint reachability via a lightweight models.list call.

        Returns:
            "True" if the provider is fully operational, "False" otherwise.
        """
        if self._client is None:
            return False
        try:
            await asyncio.wait_for(
                self._client.models.list(),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
            return True
        except Exception as exc:
            logger.warning("OpenAIProvider health_check failed: %s", exc)
            return False

    def count_tokens(self, text: str) -> int:
        """Estimate the token count for a text sequence using tiktoken.

        Uses the "cl100k_base" BPE encoding — the shared base for GPT-4,
        GPT-3.5-turbo, and most NVIDIA NIM models.  Falls back to a
        character-based estimate (4 chars ≈ 1 token) if tiktoken is
        unavailable (e.g. in air-gapped environments).

        Args:
            text: The target text string.

        Returns:
            Estimated token count (always ≥ 1).
        """
        if self._encoder is None:
            try:
                self._encoder = tiktoken.get_encoding("cl100k_base")
            except Exception as exc:
                logger.warning(
                    "tiktoken BPE load failed (%s); falling back to "
                    "character-based token estimate (4 chars ≈ 1 token).",
                    exc,
                )
                self._encoder = _TIKTOKEN_UNAVAILABLE

        if self._encoder is _TIKTOKEN_UNAVAILABLE:
            return max(1, len(text) // 4)

        return len(self._encoder.encode(text))

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_message_list(
        messages: list[Message],
    ) -> list[dict[str, str]]:
        """Serialize :class:'Message' objects to the OpenAI wire format.

        OpenAI's Chat Completions API accepts system prompts inline as
        "{"role": "system", "content": "..."}" messages, so no
        special extraction is required — messages are serialized verbatim.

        Args:
            messages: The list of conversation messages.

        Returns:
            A list of role/content dictionaries ready for the SDK.
        """
        return [msg.to_dict() for msg in messages]

    @staticmethod
    def _build_thinking_params(
        thinking: ThinkingConfig | None,
    ) -> dict[str, str]:
        """Map a domain ThinkingConfig to OpenAI SDK keyword arguments.

        OpenAI models are always reasoning-capable — there is no on/off
        toggle. This method maps the thinking config to the
        "reasoning_effort" parameter.

        Precedence:
            1. "provider_options["effort"]"
            2. Normalized "thinking.effort"
            3. Omitted (let the model decide)

        Args:
            thinking: The domain thinking configuration, or None.

        Returns:
            A dict of SDK keyword arguments (may be empty).
        """
        if thinking is None or not thinking.enabled:
            return {}

        opts = thinking.provider_options or {}
        effort = opts.get("effort") or thinking.effort
        if effort:
            return {"reasoning_effort": str(effort)}
        return {}

    @staticmethod
    def _build_response(
        raw: ChatCompletion,
        request: LLMRequest,
        start: float,
    ) -> LLMResponse:
        """Map an OpenAI :class:'ChatCompletion' to an :class:'LLMResponse'.

        Args:
            raw: The native SDK response object.
            request: The originating generation request.
            start: The "time.monotonic()" timestamp when the call started.

        Returns:
            A populated :class:'LLMResponse' domain object.
        """
        choice = raw.choices[0] if raw.choices else None
        content = (
            choice.message.content
            if choice and choice.message and choice.message.content
            else ""
        )

        finish_reason = FinishReason.UNKNOWN
        if choice and choice.finish_reason:
            finish_reason = _FINISH_REASON_MAP.get(
                choice.finish_reason, FinishReason.UNKNOWN
            )

        usage = TokenUsage.empty()
        if raw.usage is not None:
            thinking_toks = 0
            comp_toks = raw.usage.completion_tokens or 0
            if hasattr(raw.usage, "completion_tokens_details"):
                details = raw.usage.completion_tokens_details
                if details and hasattr(details, "reasoning_tokens"):
                    thinking_toks = details.reasoning_tokens or 0
                    comp_toks = comp_toks - thinking_toks
            usage = TokenUsage(
                prompt_tokens=raw.usage.prompt_tokens or 0,
                completion_tokens=comp_toks,
                thinking_tokens=thinking_toks,
                total_tokens=raw.usage.total_tokens or 0,
            )

        return LLMResponse(
            content=content,
            finish_reason=finish_reason,
            usage=usage,
            model=raw.model or request.model or _DEFAULT_MODEL,
            provider=ProviderType.OPENAI,
            latency_ms=(time.monotonic() - start) * 1_000,
            raw_response=raw,
        )

    @staticmethod
    def _map_openai_error(exc: Exception) -> Exception:
        """Map an OpenAI SDK exception to the most specific LLM domain error."""

        status_code = getattr(exc, "status_code", None)
        exc_type = type(exc).__name__

        if isinstance(exc, AuthenticationError):
            logger.warning(
                "OpenAI authentication failed.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMAuthenticationError(
                "OpenAI API credentials are invalid or revoked.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, APITimeoutError):
            logger.warning(
                "OpenAI request timed out.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMTimeoutError(
                "The request to OpenAI timed out. Please try again.",
                provider="openai",
            )

        elif isinstance(exc, APIConnectionError):
            logger.warning(
                "OpenAI connection error.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "Unable to connect to the OpenAI API. Please try again later.",
                provider="openai",
            )

        elif isinstance(exc, PermissionDeniedError):
            logger.warning(
                "OpenAI permission denied.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMAuthenticationError(
                "Access denied by OpenAI. The API key lacks permission for this operation.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, NotFoundError):
            logger.warning(
                "OpenAI resource not found.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "The requested OpenAI model or resource was not found.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, ConflictError):
            logger.warning(
                "OpenAI resource conflict.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "OpenAI resource conflict. This may indicate a concurrent modification or invalid state.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, UnprocessableEntityError):
            logger.warning(
                "OpenAI unprocessable entity.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "OpenAI could not process the request. Verify the input format and parameters.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, RateLimitError):
            retry_after = OpenAIProvider._parse_retry_after(exc)
            logger.warning(
                "OpenAI rate limit exceeded.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                    "retry_after_s": retry_after,
                },
            )
            return LLMRateLimitError(
                "OpenAI request rate limit exceeded. Retry after the delay returned by the service.",
                status_code=status_code,
                retry_after_s=retry_after,
                provider="openai",
            )

        elif isinstance(exc, BadRequestError):
            logger.warning(
                "OpenAI bad request.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "OpenAI rejected the request as bad request.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, InternalServerError):
            logger.warning(
                "OpenAI internal server error.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "OpenAI encountered an internal server error. Please retry shortly.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, APIResponseValidationError):
            logger.warning(
                "OpenAI response validation failed.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "OpenAI response JSON did not match the expected schema.",
                provider="openai",
            )

        elif isinstance(exc, APIStatusError):
            logger.warning(
                "OpenAI HTTP status error.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "An unexpected OpenAI HTTP error occurred.",
                status_code=status_code,
                provider="openai",
            )

        elif isinstance(exc, APIError):
            logger.warning(
                "OpenAI SDK error.",
                extra={
                    "provider": "openai",
                    "exc_type": exc_type,
                    "status_code": status_code,
                },
            )
            return LLMProviderError(
                "An unexpected Open API error occurred.",
                status_code=status_code,
                provider="openai",
            )

        logger.exception(
            "Unexpected error from OpenAI provider.",
            extra={
                "provider": "openai",
                "exc_type": exc_type,
                "status_code": status_code,
            },
        )
        return LLMProviderError(
            "An unexpected error occurred while communicating with OpenAI.",
            status_code=status_code,
            provider="openai",
        )

    @staticmethod
    def _parse_retry_after(exc: RateLimitError) -> float | None:
        """Extract the "Retry-After" delay from a rate-limit response header.

        Args:
            exc: The OpenAI rate-limit exception.

        Returns:
            Seconds to wait before retrying, or "None" if the header is
            absent or unparseable.
        """
        try:
            header_val = exc.response.headers.get("retry-after")
            return float(header_val) if header_val else None
        except (AttributeError, ValueError):
            return None
