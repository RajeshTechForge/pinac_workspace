"""Anthropic Claude provider for the Sentinel RAG LLM service layer.

This module integrates the official Anthropic python SDK, supporting both synchronized
and asynchronous (streaming) LLM calls, exact token counting, and custom retry logic
tailored for Sentinel RAG requirements.

Supported features
------------------
  - Blocking completions (complete)
  - True async streaming with back-pressure (stream)
  - Pre-flight token counting via SDK count_tokens API (async)
  - Sync approximation via tiktoken cl100k_base (count_tokens)
  - Automatic system-message extraction (Anthropic uses a separate param)
  - Retry-after header honoured on 429s
  - Full stop_reason → FinishReason mapping including tool_use
  - Health-check via a minimal token-count probe (no inference cost)
"""

from __future__ import annotations

import asyncio
import logging
import time
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import anthropic
import tiktoken
from anthropic import AsyncAnthropic
from anthropic.types import Message as AnthropicMessage

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
    LLMProviderError,
    LLMProviderInitError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMTokenLimitError,
)

logger = logging.getLogger(__name__)


_DEFAULT_MODEL = "claude-sonnet-4-6"
_MAX_CONTEXT_TOKENS = 200_000
_HEALTH_CHECK_TIMEOUT_S = 5.0

# Guards against repeated tiktoken BPE download attempts in air-gapped environments.
_TIKTOKEN_UNAVAILABLE = object()

# Translates Anthropic stop_reason strings to internal FinishReason enum.
# Treats extended-thinking pause_turn as UNKNOWN pending generation completion.
_STOP_REASON_MAP: dict[str | None, FinishReason] = {
    "end_turn": FinishReason.STOP,
    "stop_sequence": FinishReason.STOP,
    "max_tokens": FinishReason.LENGTH,
    "tool_use": FinishReason.TOOL_CALL,
    "pause_turn": FinishReason.UNKNOWN,
    None: FinishReason.UNKNOWN,
}


# ---------------------------------------------------------------------------
# Provider configuration
# ---------------------------------------------------------------------------


@dataclass
class AnthropicConfig:
    """Typed configuration for the Anthropic provider."""

    api_key: str
    model: str = _DEFAULT_MODEL
    base_url: str | None = None
    max_retries: int = 0
    timeout_s: float = 30.0
    extra_headers: dict[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.api_key or not self.api_key.strip():
            raise LLMProviderInitError(
                (
                    "AnthropicConfig.api_key must be a non-empty string. "
                    "Set ANTHROPIC_API_KEY in your environment."
                ),
                provider="anthropic",
            )
        if self.timeout_s <= 0:
            raise LLMProviderInitError(
                f"AnthropicConfig.timeout_s must be positive, got {self.timeout_s}",
                provider="anthropic",
            )

    @classmethod
    def from_dict(cls, cfg: dict[str, Any]) -> "AnthropicConfig":
        """Build from the raw config slice.

        Args:
            cfg: The configuration dictionary.

        Returns:
            An AnthropicConfig instance.
        """
        return cls(
            api_key=cfg["api_key"],
            model=cfg.get("model", _DEFAULT_MODEL),
            base_url=cfg.get("base_url"),
            max_retries=int(cfg.get("max_retries", 0)),
            timeout_s=float(cfg.get("timeout_s", 30.0)),
            extra_headers=dict(cfg.get("extra_headers", {})),
        )


# ===========================================================================
# Provider implementation
# ===========================================================================


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider implementation."""

    PROVIDER_TYPE = ProviderType.ANTHROPIC
    DEFAULT_MODEL = _DEFAULT_MODEL
    CAPABILITIES = ProviderCapabilities(
        supports_streaming=True,
        supports_system_prompt=True,
        supports_tool_calling=True,
        supports_vision=True,
        max_context_tokens=_MAX_CONTEXT_TOKENS,
        provider_type=ProviderType.ANTHROPIC,
    )
    RETRY_POLICY = RetryPolicy(
        max_attempts=3,
        base_delay_s=1.0,
        max_delay_s=60.0,
        exponential_base=2.0,
        jitter=True,
        retryable_status_codes=frozenset({408, 429, 500, 502, 503, 504}),
    )

    def __init__(self, config: "AnthropicConfig | dict[str, Any]") -> None:
        """Initialize the AnthropicProvider.

        Args:
            config: The endpoint configuration.
        """
        if isinstance(config, dict):
            config = AnthropicConfig.from_dict(config)

        # Satisfies LLMProvider.__init__ dictionary configuration requirement.
        super().__init__(config.__dict__)
        self._cfg: AnthropicConfig = config
        self._client: AsyncAnthropic | None = None

        # Holds lazy-loaded tiktoken encoder. Uses _TIKTOKEN_UNAVAILABLE on load failure.
        self._encoder: Any = None

    # ------------------------------------------------------------------
    # Lifecycle methods
    # ------------------------------------------------------------------

    async def initialize(self) -> None:
        """Instantiate the async HTTP client and run a credential probe.

        Raises:
            LLMProviderInitError: If the API key is invalid or client creation fails.
        """
        if self._initialized:
            logger.debug("AnthropicProvider already initialised — skipping.")
            return

        logger.info(
            "Initialising AnthropicProvider (model=%r, base_url=%r).",
            self._cfg.model,
            self._cfg.base_url or "default",
        )

        try:
            self._client = AsyncAnthropic(
                api_key=self._cfg.api_key,
                base_url=self._cfg.base_url,
                max_retries=self._cfg.max_retries,
                default_headers=self._cfg.extra_headers or None,
                # Bypasses client-level timeout in favor of per-request asyncio.wait_for.
                # Ensures consistent LLMTimeoutError mapping.
            )
        except Exception as exc:
            raise LLMProviderInitError(
                "Failed to create AsyncAnthropic client.",
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc

        # Probes credentials via token count payload.
        try:
            await asyncio.wait_for(
                self._client.messages.count_tokens(
                    model=self._cfg.model,
                    messages=[{"role": "user", "content": "ping"}],
                ),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
        except anthropic.AuthenticationError as exc:
            raise LLMProviderInitError(
                "Anthropic API key is invalid or revoked.",
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc
        except Exception as exc:
            logger.warning(
                "AnthropicProvider credential probe failed (non-fatal): %s", exc
            )

        self._initialized = True
        logger.info("AnthropicProvider initialised successfully.")

    async def shutdown(self) -> None:
        """Close the underlying HTTPX connection pool."""
        if self._client is not None:
            try:
                await self._client.close()
            except Exception as exc:
                logger.warning("Error closing Anthropic client: %s", exc)
            finally:
                self._client = None
                self._initialized = False
                logger.debug("AnthropicProvider shut down.")

    async def _init_client_only(self) -> None:
        """Create the AsyncAnthropic HTTP client without running a credential probe.

        Intended for use by :class:`~src.services.llm.byok.BYOKLLMService` so that
        authentication errors surface from the first inference call rather than
        from a pre-flight token-count probe, avoiding extra latency and billable
        probe requests for each BYOK user key.

        Raises:
            LLMProviderInitError: If the AsyncAnthropic client cannot be created.
        """
        if self._initialized:
            return

        try:
            self._client = AsyncAnthropic(
                api_key=self._cfg.api_key,
                base_url=self._cfg.base_url,
                max_retries=self._cfg.max_retries,
                default_headers=self._cfg.extra_headers or None,
            )
        except Exception as exc:
            raise LLMProviderInitError(
                "Failed to create AsyncAnthropic client.",
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc

        self._initialized = True
        logger.debug("AnthropicProvider client created (credential probe skipped).")

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
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        system_prompt, messages = self._split_messages(request.messages)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "Anthropic complete | model=%s messages=%d",
            model,
            len(messages),
        )

        try:
            raw: AnthropicMessage = await asyncio.wait_for(
                self._client.messages.create(
                    model=model,
                    messages=messages,
                    max_tokens=request.max_tokens,
                    system=system_prompt if system_prompt else anthropic.NOT_GIVEN,
                    temperature=request.temperature,
                    top_p=(
                        request.top_p if request.top_p != 1.0 else anthropic.NOT_GIVEN
                    ),
                    stop_sequences=request.stop_sequences or anthropic.NOT_GIVEN,
                    stream=False,
                ),
                timeout=timeout,
            )
        except asyncio.TimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"Anthropic request timed out after {elapsed:.1f}s (limit={timeout}s)",
                elapsed_s=elapsed,
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc
        except Exception as exc:
            raise self._map_anthropic_error(exc) from exc

        return self._build_response(raw, request, start)

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamChunk]:
        """Yield token deltas as an async stream from the Anthropic API.

        Args:
            request: The streaming generation request.

        Returns:
            An async iterator of stream chunks.

        Raises:
            LLMTimeoutError: If stream connection operations time out.
            LLMProviderError: On error streaming from the API.
        """
        self._assert_initialized()
        assert self._client is not None

        model = request.model or self._cfg.model
        system_prompt, messages = self._split_messages(request.messages)
        timeout = (
            request.timeout if request.timeout is not None else self._cfg.timeout_s
        )
        start = time.monotonic()

        logger.debug(
            "Anthropic stream | model=%s",
            model,
        )

        try:
            async with self._client.messages.stream(
                model=model,
                messages=messages,
                max_tokens=request.max_tokens,
                system=system_prompt if system_prompt else anthropic.NOT_GIVEN,
                temperature=request.temperature,
                top_p=(request.top_p if request.top_p != 1.0 else anthropic.NOT_GIVEN),
                stop_sequences=request.stop_sequences or anthropic.NOT_GIVEN,
                timeout=timeout,
            ) as stream_mgr:
                async for text_delta in stream_mgr.text_stream:
                    yield StreamChunk(delta=text_delta)

                # Retrieves final authoritative message for usage statistics.
                final_msg: AnthropicMessage = await stream_mgr.get_final_message()

        except anthropic.APITimeoutError as exc:
            elapsed = time.monotonic() - start
            raise LLMTimeoutError(
                f"Anthropic stream timed out after {elapsed:.1f}s",
                elapsed_s=elapsed,
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc
        except Exception as exc:
            raise self._map_anthropic_error(exc) from exc

        # Yields final sentinel chunk with aggregated usage and finish metadata.
        yield StreamChunk(
            delta="",
            is_final=True,
            finish_reason=_STOP_REASON_MAP.get(
                final_msg.stop_reason, FinishReason.UNKNOWN
            ),
            usage=TokenUsage(
                prompt_tokens=final_msg.usage.input_tokens,
                completion_tokens=final_msg.usage.output_tokens,
                total_tokens=final_msg.usage.input_tokens
                + final_msg.usage.output_tokens,
            ),
            model=final_msg.model,
            provider=ProviderType.ANTHROPIC,
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
                self._client.messages.count_tokens(
                    model=self._cfg.model,
                    messages=[{"role": "user", "content": "ping"}],
                ),
                timeout=_HEALTH_CHECK_TIMEOUT_S,
            )
            return True
        except Exception as exc:
            logger.warning("AnthropicProvider health_check failed: %s", exc)
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
                    "tiktoken BPE load failed (%s); falling back to "
                    "character-based token estimate (4 chars ≈ 1 token).",
                    exc,
                )
                self._encoder = _TIKTOKEN_UNAVAILABLE

        if self._encoder is _TIKTOKEN_UNAVAILABLE:
            return max(1, len(text) // 4)

        return len(self._encoder.encode(text))

    async def async_count_tokens(self, request: LLMRequest) -> int:
        """Return the exact prompt token count via the Anthropic API.

        Args:
            request: The generation request carrying target text.

        Returns:
            The specific token count according to Anthropic's models.

        Raises:
            LLMProviderError: On any failure executing the count query.
        """
        self._assert_initialized()
        assert self._client is not None

        system_prompt, messages = self._split_messages(request.messages)
        try:
            result = await self._client.messages.count_tokens(
                model=request.model or self._cfg.model,
                messages=messages,
                system=system_prompt if system_prompt else anthropic.NOT_GIVEN,
            )
        except Exception as exc:
            raise LLMProviderError(
                "Anthropic count_tokens failed.",
                provider="anthropic",
                details={"error": str(exc)},
            ) from exc
        return result.input_tokens

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _split_messages(
        messages: list[Message],
    ) -> tuple[str, list[dict[str, str]]]:
        """Separate the system prompt from the conversation turns.

        Args:
            messages: The list of combined messages.

        Returns:
            A tuple of the separated system prompt and list of remainder messages.
        """
        system_parts: list[str] = []
        conversation: list[dict[str, str]] = []

        for msg in messages:
            if msg.role == Role.SYSTEM:
                system_parts.append(msg.content)
            else:
                conversation.append(msg.to_dict())

        # Separates multi-system messages with clear boundary rules.
        return "\n\n---\n\n".join(system_parts), conversation

    @staticmethod
    def _build_response(
        raw: AnthropicMessage,
        request: LLMRequest,
        start: float,
    ) -> LLMResponse:
        """Map an Anthropic SDK Message object to an LLMResponse.

        Args:
            raw: The native anthropic message.
            request: The originating generation request.
            start: The performance start time.

        Returns:
            The constructed LLMResponse domain object.
        """
        # Extracts text from blocks with defined .text attributes.
        # Skips tool-use blocks intentionally.
        content = "".join(block.text for block in raw.content if hasattr(block, "text"))

        return LLMResponse(
            content=content,
            finish_reason=_STOP_REASON_MAP.get(raw.stop_reason, FinishReason.UNKNOWN),
            usage=TokenUsage(
                prompt_tokens=raw.usage.input_tokens,
                completion_tokens=raw.usage.output_tokens,
                total_tokens=raw.usage.input_tokens + raw.usage.output_tokens,
            ),
            model=raw.model,
            provider=ProviderType.ANTHROPIC,
            latency_ms=(time.monotonic() - start) * 1_000,
            raw_response=raw,
        )

    @staticmethod
    def _map_anthropic_error(exc: Exception) -> Exception:
        """Map an Anthropic SDK exception to the most specific LLMError subtype."""

        if isinstance(exc, anthropic.RateLimitError):
            return LLMRateLimitError(
                "Anthropic rate limit exceeded",
                retry_after_s=AnthropicProvider._parse_retry_after(exc),
                provider="anthropic",
                details={"error": str(exc)},
            )
        if isinstance(exc, anthropic.BadRequestError):
            msg_lower = exc.message.lower()
            if "too long" in msg_lower or "token" in msg_lower:
                return LLMTokenLimitError(
                    "Prompt exceeds Anthropic context window.",
                    context_limit=_MAX_CONTEXT_TOKENS,
                    provider="anthropic",
                    details={"error": str(exc)},
                )
            return LLMProviderError(
                f"Anthropic bad request: {exc.message}",
                status_code=exc.status_code,
                provider="anthropic",
                details={"error": str(exc)},
            )
        if isinstance(exc, anthropic.AuthenticationError):
            return LLMAuthenticationError(
                f"Anthropic authentication failed: {exc.message}",
                provider="anthropic",
                details={"error": str(exc)},
            )
        if isinstance(exc, anthropic.APIStatusError):
            return LLMProviderError(
                f"Anthropic API error: {exc.message}",
                status_code=exc.status_code,
                provider="anthropic",
                details={"error": str(exc)},
            )
        if isinstance(exc, anthropic.APIConnectionError):
            return LLMProviderError(
                "Anthropic connection error.",
                provider="anthropic",
                details={"error": str(exc)},
            )
        # Maps SDK errors not explicitly enumerated.
        return LLMProviderError(
            f"Anthropic unexpected error ({type(exc).__name__})",
            provider="anthropic",
            details={"error": str(exc)},
        )

    @staticmethod
    def _parse_retry_after(exc: anthropic.RateLimitError) -> float | None:
        """Extract Retry-After seconds from a response header.

        Args:
            exc: The Anthropic rate limit exception.

        Returns:
            The retry after delay duration, or None if unparseable.
        """
        try:
            header_val = exc.response.headers.get("retry-after")
            return float(header_val) if header_val else None
        except (AttributeError, ValueError):
            return None
