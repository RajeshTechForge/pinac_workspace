"""LLM service facade that API route handlers use to interact with providers.

The :class:'LLMService' provides a thin, provider-agnostic interface over the
provider implementations, handling provider lifecycle, request routing, and
observability. It is the single entry point from the API layer into the LLM
provider layer.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator

from .base import (
    LLMProvider,
    LLMRequest,
    LLMResponse,
    Message,
    ProviderCapabilities,
    ProviderType,
    StreamChunk,
)
from .exceptions import LLMProviderError

logger = logging.getLogger(__name__)


class LLMService:
    """Facade over all registered LLM providers for API route handlers.

    The service owns provider lifecycle and exposes every provider operation
    (completion, streaming, health checks, token counting) through a single
    provider-type-routed interface.

    Register providers via :meth:'register_provider' or use the
    :func:'create_llm_service' factory.
    """

    def __init__(self) -> None:
        self._providers: dict[ProviderType, LLMProvider] = {}

    # ------------------------------------------------------------------
    # Registration & lifecycle
    # ------------------------------------------------------------------

    def register_provider(
        self, provider_type: ProviderType, provider: LLMProvider
    ) -> None:
        """Register a provider instance under its canonical type key.

        Args:
            provider_type: The provider type identifier.
            provider: An initialized or uninitialized provider instance.

        Raises:
            ValueError: If *provider_type* is already registered.
        """
        if provider_type in self._providers:
            raise ValueError(
                f"A provider is already registered for {provider_type.value!r}."
            )
        self._providers[provider_type] = provider

    async def initialize(self) -> None:
        """Initialize all registered providers.

        Providers are initialized sequentially so the first failure surfaces
        immediately.

        Raises:
            LLMProviderInitError: If any provider fails to initialize.
        """
        for provider_type, provider in self._providers.items():
            await provider.initialize()
        logger.info("LLMService initialized %d provider(s).", len(self._providers))

    async def shutdown(self) -> None:
        """Gracefully shut down all registered providers."""
        for provider_type, provider in self._providers.items():
            try:
                await provider.shutdown()
            except Exception as exc:
                logger.warning(
                    "Error shutting down provider %r: %s",
                    provider_type.value,
                    exc,
                )
        self._providers.clear()
        logger.info("LLMService shut down.")

    @property
    def providers(self) -> dict[ProviderType, LLMProvider]:
        """Return a read-only copy of the registered provider mapping."""
        return dict(self._providers)

    @property
    def provider_count(self) -> int:
        """Return the number of registered providers."""
        return len(self._providers)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    async def complete(
        self, request: LLMRequest, provider_type: ProviderType
    ) -> LLMResponse:
        """Execute a non-streaming completion on the given provider.

        The retry policy configured on the provider is applied automatically
        via :meth:'LLMProvider.complete_with_retry'.

        Args:
            request: The generation request (messages, parameters, etc.).
            provider_type: Which provider the request is routed to.

        Returns:
            The completed response including token usage and latency.

        Raises:
            LLMProviderError: If *provider_type* is not registered.
            LLMTimeoutError: If the request exceeds the configured timeout.
            LLMRateLimitError: On HTTP 429 after exhausting retries.
            LLMTokenLimitError: If the prompt exceeds the context window.
        """
        provider = self._resolve(provider_type)
        return await provider.complete_with_retry(request)

    async def stream(
        self, request: LLMRequest, provider_type: ProviderType
    ) -> AsyncIterator[StreamChunk]:
        """Yield a streaming response from the given provider.

        Each invocation yields one :class:'StreamChunk' per token delta. The
        final chunk carries *is_final=True*, aggregated token usage, the
        finish reason, the model version, and wall-clock latency.

        Args:
            request: The streaming generation request.
            provider_type: Which provider the request is routed to.

        Yields:
            StreamChunk objects representing token deltas.

        Raises:
            LLMProviderError: If *provider_type* is not registered.
            LLMTimeoutError: If the stream connection times out.
        """
        provider = self._resolve(provider_type)
        async for chunk in provider.stream(request):
            yield chunk

    # ------------------------------------------------------------------
    # Observability
    # ------------------------------------------------------------------

    async def health_check(self, provider_type: ProviderType) -> bool:
        """Check a single provider's liveness.

        Args:
            provider_type: Which provider to probe.

        Returns:
            True if the provider is reachable and operational, False otherwise.
        """
        provider = self._resolve(provider_type)
        return await provider.health_check()

    async def health_check_all(self) -> dict[ProviderType, bool]:
        """Check liveness for every registered provider.

        Each provider is probed sequentially. A failing probe for one
        provider does not prevent the remaining providers from being
        checked.

        Returns:
            Mapping of each provider type to its health status.
        """
        results: dict[ProviderType, bool] = {}
        for provider_type, provider in self._providers.items():
            try:
                results[provider_type] = await provider.health_check()
            except Exception as exc:
                logger.warning(
                    "Health check failed for %r: %s",
                    provider_type.value,
                    exc,
                )
                results[provider_type] = False
        return results

    def count_tokens(self, provider_type: ProviderType, text: str) -> int:
        """Estimate the token count for a text string.

        Delegates to the provider's local tokenizer (e.g. tiktoken for
        OpenAI / Anthropic, character-based fallback if unavailable).

        Args:
            provider_type: Which provider's tokenizer to use.
            text: The text to estimate.

        Returns:
            Estimated token count (always >= 1 for non-empty text).
        """
        provider = self._resolve(provider_type)
        return provider.count_tokens(text)

    def count_prompt_tokens(
        self, provider_type: ProviderType, messages: list[Message]
    ) -> int:
        """Estimate the total token count for a sequence of messages.

        Concatenates all message contents with a single-space separator
        and delegates to the provider's :meth:'count_tokens'.

        Args:
            provider_type: Which provider's tokenizer to use.
            messages: The conversation messages to estimate.

        Returns:
            Estimated token count, or 0 for an empty message list.
        """
        if not messages:
            return 0
        combined = " ".join(msg.content for msg in messages)
        return self.count_tokens(provider_type, combined)

    def get_capabilities(self, provider_type: ProviderType) -> ProviderCapabilities:
        """Return the capabilities descriptor for a registered provider.

        Args:
            provider_type: Which provider to inspect.

        Returns:
            The provider's :class:'ProviderCapabilities' attribute.

        Raises:
            LLMProviderError: If *provider_type* is not registered.
        """
        provider = self._resolve(provider_type)
        return provider.CAPABILITIES

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _resolve(self, provider_type: ProviderType) -> LLMProvider:
        """Look up a registered provider by type.

        Args:
            provider_type: The requested provider type.

        Returns:
            The registered provider instance.

        Raises:
            LLMProviderError: If no provider is registered for
                *provider_type*.
        """
        provider = self._providers.get(provider_type)
        if provider is None:
            registered = [p.value for p in self._providers]
            raise LLMProviderError(
                f"No provider registered for {provider_type.value!r}. "
                f"Registered providers: {registered or 'none'}.",
                provider=provider_type.value,
            )
        return provider


# ---------------------------------------------------------------------------
# Factory
# ---------------------------------------------------------------------------


def create_llm_service(
    providers: dict[ProviderType, LLMProvider],
) -> LLMService:
    """Create and configure an :class:'LLMService' from pre-built providers.

    The caller is responsible for constructing and providing provider
    instances (initialized or not). The returned service must have
    :meth:'LLMService.initialize' called before it can serve requests.

    Args:
        providers: Mapping of provider types to provider instances.

    Returns:
        An :class:'LLMService' with all providers registered.
    """
    service = LLMService()
    for provider_type, provider in providers.items():
        service.register_provider(provider_type, provider)
    return service
