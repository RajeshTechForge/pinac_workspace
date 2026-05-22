"""Define the abstract base contract for all LLM providers. Every concrete provider
must sub-class LLMProvider and implement all abstract methods. Providers should be used as
async context managers to ensure proper resource cleanup.

Design principles:
------------------
  - ABC enforces the contract at import time, not at runtime
  - All I/O is async-first (sync wrappers available via run_sync)
  - Streaming is a first-class citizen, not an afterthought
  - Observability hooks (usage, latency, metadata) baked into every response
  - Retry / timeout policy defined here, overridden per-provider
"""

from __future__ import annotations

import asyncio
import logging
import random
import time
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

from .exceptions import (
    LLMProviderError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMTokenLimitError,
)

logger = logging.getLogger(__name__)


class Role(str, Enum):
    """Conversation participant roles."""

    SYSTEM = "system"
    USER = "user"
    ASSISTANT = "assistant"


class FinishReason(str, Enum):
    """Provide specific reasons for the model stopping its generation."""

    STOP = "stop"  # Natural completion
    LENGTH = "length"  # Truncated by max_tokens
    TOOL_CALL = "tool_call"  # Requests tool execution
    CONTENT_FILTER = "content_filter"  # Blocked by safety filters
    ERROR = "error"  # Provider generation failure
    UNKNOWN = "unknown"  # Fallback for unmapped values


class ProviderType(str, Enum):
    """Canonical provider identifiers used throughout the routing layer."""

    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    GEMINI = "gemini"


# ----------------------------------------------------------------------------
# Core data models
# ----------------------------------------------------------------------------


@dataclass(frozen=True)
class Message:
    """A single turn in a conversation."""

    role: Role
    content: str

    def to_dict(self) -> dict[str, str]:
        """Serialize the message to a provider-agnostic dictionary format.

        Returns:
            A dictionary containing the message role and content.
        """
        return {"role": self.role.value, "content": self.content}


@dataclass
class LLMRequest:
    """Everything a provider needs to fulfil a completion or streaming request."""

    messages: list[Message]

    model: str = ""
    max_tokens: int = 2048
    temperature: float = 0.1
    top_p: float = 1.0
    stop_sequences: list[str] = field(default_factory=list)

    stream: bool = False
    timeout: float | None = 30.0  # in seconds

    def __post_init__(self) -> None:
        if not self.messages:
            raise ValueError("LLMRequest must contain at least one message.")
        if not 0.0 <= self.temperature <= 2.0:
            raise ValueError(
                f"temperature must be in [0.0, 2.0], got {self.temperature}"
            )
        if self.max_tokens < 1:
            raise ValueError(f"max_tokens must be ≥ 1, got {self.max_tokens}")


@dataclass
class TokenUsage:
    """Token consumption for a single provider call."""

    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0

    @classmethod
    def empty(cls) -> "TokenUsage":
        """Return a zero-valued usage object.

        Returns:
            An empty TokenUsage instance.
        """
        return cls()

    def __add__(self, other: "TokenUsage") -> "TokenUsage":
        """Aggregate usage from two calls.

        Args:
            other: Another TokenUsage object.

        Returns:
            A new TokenUsage representing the combined totals.
        """
        return TokenUsage(
            prompt_tokens=self.prompt_tokens + other.prompt_tokens,
            completion_tokens=self.completion_tokens + other.completion_tokens,
            total_tokens=self.total_tokens + other.total_tokens,
        )


@dataclass
class LLMResponse:
    """A completed (non-streaming) response from any provider."""

    content: str
    finish_reason: FinishReason
    usage: TokenUsage
    model: str
    provider: ProviderType
    latency_ms: float = 0.0

    # Excluded from repr to keep logs readable
    raw_response: Any = field(default=None, repr=False)

    @property
    def was_truncated(self) -> bool:
        """Return True when finish_reason indicates the max_tokens limit was hit."""
        return self.finish_reason == FinishReason.LENGTH


@dataclass
class StreamChunk:
    """One token or delta fragment from a streaming response."""

    delta: str
    is_final: bool = False

    finish_reason: FinishReason = FinishReason.UNKNOWN
    usage: TokenUsage = field(default_factory=TokenUsage.empty)
    model: str = ""
    provider: ProviderType = ProviderType.ANTHROPIC  # Overridden by concrete class
    latency_ms: float = 0.0


@dataclass
class RetryPolicy:
    """Exponential back-off configuration for provider retry loops."""

    max_attempts: int = 3
    base_delay_s: float = 1.0
    max_delay_s: float = 60.0
    exponential_base: float = 2.0
    jitter: bool = True
    retryable_status_codes: frozenset[int] = field(
        default_factory=lambda: frozenset({408, 429, 500, 502, 503, 504})
    )

    def delay_for_attempt(self, attempt: int) -> float:
        """Calculate how many seconds to wait before the specified attempt."""
        delay = min(
            self.base_delay_s * (self.exponential_base**attempt),
            self.max_delay_s,
        )
        if self.jitter:
            delay *= 0.5 + random.random() * 0.5
        return delay


@dataclass(frozen=True)
class ProviderCapabilities:
    """Feature flags that the router queries when selecting a provider."""

    supports_streaming: bool = True
    supports_system_prompt: bool = True
    supports_tool_calling: bool = False
    supports_vision: bool = False
    max_context_tokens: int = 8_192
    provider_type: ProviderType = ProviderType.ANTHROPIC


# ============================================================================
# Abstract base provider
# ============================================================================


class LLMProvider(ABC):
    """Abstract base class for all LLM providers."""

    PROVIDER_TYPE: ProviderType
    DEFAULT_MODEL: str
    CAPABILITIES: ProviderCapabilities

    RETRY_POLICY: RetryPolicy = RetryPolicy()

    def __init__(self, config: dict[str, Any]) -> None:
        """Initialize the LLM provider.

        Args:
            config: Provider-specific configuration mapping.
        """
        self._config = config
        self._initialized = False
        logger.debug("%s provider created.", self.__class__.__name__)

    # ------------------------------------------------------------------
    # Lifecycle methods
    # ------------------------------------------------------------------

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize the provider by validating credentials and pre-loading assets.

        Raises:
            LLMProviderInitError: If the provider fails to start due to configuration
                or credential errors.
        """

    @abstractmethod
    async def shutdown(self) -> None:
        """Gracefully release all resources associated with the provider."""

    @abstractmethod
    async def _init_client_only(self) -> None:
        """Create the underlying HTTP client without running a credential probe.

        This is the lightweight initialization path used by
        :class:`~src.services.llm.byok.BYOKLLMService` for BYOK requests.
        Calling code receives auth errors from the first inference call
        (:meth:`complete` / :meth:`stream`) rather than from a pre-flight probe,
        which avoids extra latency and billable probe requests for each user key.

        Concrete implementations must:
        1. Guard against double-initialization (idempotent — return early if
           ``self._initialized`` is already ``True``).
        2. Instantiate the provider-specific async HTTP client and assign it to
           ``self._client``.
        3. Set ``self._initialized = True`` after successful client creation.
        4. Raise :exc:`~src.services.llm.exceptions.LLMProviderInitError` if the
           client cannot be constructed (e.g. missing or malformed credentials in
           the config dataclass).

        Raises:
            LLMProviderInitError: If the underlying HTTP client cannot be created.
        """

    async def __aenter__(self) -> "LLMProvider":
        """Initialize the provider asynchronously upon context entry."""
        await self.initialize()
        return self

    async def __aexit__(self, *_: Any) -> None:
        """Ensure provider shutdown on context manager exit."""
        await self.shutdown()

    # ------------------------------------------------------------------
    # Core inference methods
    # ------------------------------------------------------------------

    @abstractmethod
    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Send a blocking non-streaming completion request.

        Args:
            request: The LLM request options and generation parameters.

        Returns:
            The completed response from the provider.

        Raises:
            LLMTimeoutError: If the request exceeds the specified timeout.
            LLMRateLimitError: If HTTP 429 occurs and exhausts all retry attempts.
            LLMTokenLimitError: If the prompt exceeds the model's context window.
            LLMProviderError: If any other provider-side failure occurs.
        """

    @abstractmethod
    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamChunk]:
        """Yield token deltas as an async stream from the provider.

        Args:
            request: The LLM request to stream.

        Returns:
            An async iterator yielding successive stream chunks.

        Raises:
            LLMTimeoutError: If the stream connection times out.
            LLMRateLimitError: If rate limited during streaming.
            LLMTokenLimitError: If context window exceeded.
            LLMProviderError: For any other streaming errors.
        """

    # ------------------------------------------------------------------
    # Health and introspection
    # ------------------------------------------------------------------

    @abstractmethod
    async def health_check(self) -> bool:
        """Perform a lightweight liveness probe.

        Returns:
            True if the provider is reachable and credentials are valid, False otherwise.
        """

    @abstractmethod
    def count_tokens(self, text: str) -> int:
        """Estimate the token count for a piece of text.

        Args:
            text: The text to evaluate.

        Returns:
            An estimated count of tokens according to the provider's tokenizer.
        """

    # ------------------------------------------------------------------
    # Shared helper methods
    # ------------------------------------------------------------------

    def _assert_initialized(self) -> None:
        """Assert that the provider has been initialized.

        Raises:
            RuntimeError: If initialize() has not been successfully executed.
        """
        if not self._initialized:
            raise RuntimeError(
                f"{self.__class__.__name__}.initialize() must be called "
                "before making inference requests. Use the async context manager."
            )

    def _build_base_response_kwargs(
        self,
        request: LLMRequest,
        start_time: float,
    ) -> dict[str, Any]:
        """Build tracing keyword arguments common to every response.

        Args:
            request: The original LLMRequest object.
            start_time: The time execution started.

        Returns:
            A dictionary containing standard trace identifiers.
        """
        return {
            "provider": self.PROVIDER_TYPE,
            "latency_ms": (time.monotonic() - start_time) * 1_000,
        }

    async def complete_with_retry(
        self,
        request: LLMRequest,
        *,
        policy: RetryPolicy | None = None,
    ) -> LLMResponse:
        """Execute a completion request using the configured retry wrapper.

        Args:
            request: The completion request.
            policy: An explicit retry policy, overriding the provider default.

        Returns:
            The complete response after successful generation.

        Raises:
            LLMTimeoutError: If all retries time out.
            LLMRateLimitError: If all rate limit retries fail.
            LLMProviderError: If retries encounter unrecoverable provider errors.
        """
        p = policy or getattr(self, "RETRY_POLICY", RetryPolicy())
        last_exc: Exception = Exception("LLM completion failed with no attempts made.")

        for attempt in range(p.max_attempts):
            try:
                return await self.complete(request)

            except LLMTokenLimitError:
                raise  # Deterministic failure, skip retries

            except (LLMRateLimitError, LLMTimeoutError, LLMProviderError) as exc:
                last_exc = exc
                if attempt == p.max_attempts - 1:
                    break  # Exhausted retries
                delay = p.delay_for_attempt(attempt)
                logger.warning(
                    "LLM request failed (attempt %d/%d): %s. Retrying in %.2fs.",
                    attempt + 1,
                    p.max_attempts,
                    exc,
                    delay,
                )
                await asyncio.sleep(delay)

        raise last_exc

    def run_sync(self, request: LLMRequest) -> LLMResponse:
        """Execute the completion request synchronously.

        Args:
            request: The request to send to the provider.

        Returns:
            The provider response after synchronous execution.

        Raises:
            RuntimeError: If called from within a running asyncio event loop.
        """
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            pass  # No running loop present
        else:
            raise RuntimeError(
                "run_sync() cannot be called from within a running event loop. "
                "Use `await provider.complete(request)` instead."
            )
        return asyncio.run(self.complete(request))

    # ------------------------------------------------------------------
    # Representation methods
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        status = "ready" if self._initialized else "uninitialised"
        return (
            f"<{self.__class__.__name__} "
            f"provider={self.PROVIDER_TYPE.value} "
            f"model={self.DEFAULT_MODEL!r} "
            f"status={status}>"
        )
