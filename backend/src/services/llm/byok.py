"""Per-request LLM service for BYOK (Bring Your Own Key) mode.

In BYOK mode the caller supplies their own provider API key with each request.
This module provides :class:`BYOKLLMService`, a short-lived async context
manager that builds a single-use :class:`~.base.LLMProvider`, initializes its
HTTP client *without* a credential probe, serves the request, and tears the
provider down on exit.

The service is intentionally narrow: it exposes only :meth:`~BYOKLLMService.complete`
and :meth:`~BYOKLLMService.stream`. Token counting, health checks, and provider
registry operations remain responsibilities of the server-side
:class:`~.service.LLMService` (Managed Service path).

Typical usage::

    from src.services.llm.base import LLMRequest, ProviderType
    from src.services.llm.byok import BYOKLLMService

    async with BYOKLLMService(
        provider_type=ProviderType.ANTHROPIC,
        api_key="sk-ant-...",
        model="claude-sonnet-4-6",
    ) as svc:
        response = await svc.complete(request)
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from typing import TYPE_CHECKING

from .base import LLMProvider, LLMRequest, LLMResponse, ProviderType, StreamChunk
from .exceptions import LLMProviderError
from .providers import (
    AnthropicConfig,
    AnthropicProvider,
    GeminiConfig,
    GeminiProvider,
    OpenAIConfig,
    OpenAIProvider,
)

if TYPE_CHECKING:
    from types import TracebackType

logger = logging.getLogger(__name__)

_SUPPORTED_PROVIDERS = [p.value for p in ProviderType]


class BYOKLLMService:
    """Per-request LLM service that manages a single-use provider lifecycle.

    Each instance is bound to one (provider_type, api_key, model) triple. The
    provider's HTTP client is created on ``__aenter__`` and torn down on
    ``__aexit__``, making instances safe to use in a ``try/finally`` block or
    as an ``async with`` statement inside a FastAPI route handler.

    The credential probe (model-list or token-count pre-flight call) is
    intentionally skipped. Any authentication failure surfaces as
    :exc:`~.exceptions.LLMAuthenticationError` from the first :meth:`complete`
    or :meth:`stream` call, which the route handler maps to HTTP 401.

    Args:
        provider_type: The target provider (Anthropic, OpenAI, or Gemini).
        api_key: The caller-supplied API key for the chosen provider.
        model: The model identifier to use for inference. An empty string
            causes each provider to fall back to its configured default model.

    Raises:
        LLMProviderError: On ``__aenter__`` if the provider type is unknown, or
            if the HTTP client cannot be constructed (e.g. an empty ``api_key``
            fails :class:`~.providers.anthropic.AnthropicConfig` validation).
    """

    def __init__(
        self,
        provider_type: ProviderType,
        api_key: str,
        model: str,
    ) -> None:
        self._provider_type = provider_type
        self._api_key = api_key
        self._model = model
        self._provider: LLMProvider = self._build_provider(
            provider_type, api_key, model
        )

    # ------------------------------------------------------------------
    # Async context manager
    # ------------------------------------------------------------------

    async def __aenter__(self) -> "BYOKLLMService":
        """Initialize the provider HTTP client (no credential probe).

        Returns:
            This :class:`BYOKLLMService` instance, ready for inference.

        Raises:
            LLMProviderInitError: If the underlying HTTP client cannot be created.
        """
        logger.debug(
            "BYOKLLMService entering: provider=%r model=%r",
            self._provider_type.value,
            self._model,
        )
        await self._provider._init_client_only()
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Shut down the provider and release HTTP connection pool resources.

        Shutdown is unconditional — it runs regardless of whether inference
        raised an exception, so no connection leaks occur on error paths.
        """
        await self._provider.shutdown()
        logger.debug(
            "BYOKLLMService exited: provider=%r",
            self._provider_type.value,
        )

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    async def complete(self, request: LLMRequest) -> LLMResponse:
        """Execute a non-streaming completion with the provider's retry policy.

        Delegates directly to :meth:`~.base.LLMProvider.complete_with_retry`,
        which applies exponential back-off on transient errors (429, 5xx).

        Args:
            request: The generation request including messages and sampling
                parameters. The ``model`` field is used when set; otherwise
                the provider falls back to the model supplied at construction.

        Returns:
            The completed :class:`~.base.LLMResponse` including generated text,
            token usage, finish reason, and wall-clock latency.

        Raises:
            LLMAuthenticationError: If the supplied API key is invalid.
            LLMRateLimitError: If the provider rate-limits the request after
                exhausting retry attempts.
            LLMTokenLimitError: If the prompt exceeds the model's context window.
            LLMTimeoutError: If the request exceeds its configured timeout.
            LLMProviderError: On any other provider-side failure.
        """
        return await self._provider.complete_with_retry(request)

    async def stream(self, request: LLMRequest) -> AsyncIterator[StreamChunk]:
        """Yield token deltas from a streaming completion.

        The caller must consume this generator *within* the ``async with``
        block that created this service instance: the provider is shut down on
        ``__aexit__``, so iterating after exit will encounter a closed client.

        Args:
            request: The streaming generation request. Set ``request.stream``
                to ``True`` before passing here, though providers handle both
                modes through this method regardless.

        Yields:
            :class:`~.base.StreamChunk` objects — one per token delta — with
            ``is_final=False`` on intermediate chunks. The final chunk has
            ``is_final=True`` and carries aggregated ``usage``, ``model``,
            ``provider``, ``finish_reason``, and ``latency_ms``.

        Raises:
            LLMAuthenticationError: If the supplied API key is invalid.
            LLMRateLimitError: If the provider rate-limits during streaming.
            LLMTokenLimitError: If the prompt exceeds the model's context window.
            LLMTimeoutError: If the stream connection times out.
            LLMProviderError: On any other provider-side streaming failure.
        """
        async for chunk in self._provider.stream(request):
            yield chunk

    # ------------------------------------------------------------------
    # Representation
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"<BYOKLLMService "
            f"provider={self._provider_type.value!r} "
            f"model={self._model!r}>"
        )

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_provider(
        provider_type: ProviderType,
        api_key: str,
        model: str,
    ) -> LLMProvider:
        """Construct a provider instance from BYOK credentials.

        Maps the canonical ``ProviderType`` to its typed ``*Config`` dataclass
        and concrete ``*Provider`` class. Config validation (e.g. empty
        ``api_key``) is performed here by the config ``__post_init__`` guard,
        so callers receive a clear :exc:`~.exceptions.LLMProviderInitError`
        rather than a raw ``ValueError`` from downstream code.

        Args:
            provider_type: The target provider.
            api_key: The caller-supplied API key.
            model: The model identifier. An empty string falls back to each
                provider's default model.

        Returns:
            An uninitialized :class:`~.base.LLMProvider` instance whose HTTP
            client will be created by :meth:`_init_client_only`.

        Raises:
            LLMProviderError: If ``provider_type`` is not a recognized value.
            LLMProviderInitError: If config validation fails (e.g. empty key).
        """
        if provider_type == ProviderType.ANTHROPIC:
            return AnthropicProvider(AnthropicConfig(api_key=api_key, model=model))
        if provider_type == ProviderType.OPENAI:
            return OpenAIProvider(OpenAIConfig(api_key=api_key, model=model))
        if provider_type == ProviderType.GEMINI:
            return GeminiProvider(GeminiConfig(api_key=api_key, model=model))
        raise LLMProviderError(
            f"No BYOK provider registered for {provider_type.value!r}. "
            f"Supported providers: {_SUPPORTED_PROVIDERS}.",
            provider=provider_type.value,
        )
