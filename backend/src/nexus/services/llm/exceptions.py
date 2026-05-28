"""Define the LLM provider exception hierarchy.

All provider-specific SDK errors are caught inside each provider implementation
and re-raised as one of the typed exceptions defined here. This decouples the
higher layers from vendor-specific SDKs. The original SDK exception is accessible
via the standard Python "__cause__" attribute.
"""

from __future__ import annotations

from nexus.exceptions import NexusError


class LLMError(NexusError):
    """Base exception for all LLM provider errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None,
        provider: str | None = None,
        **kwargs,
    ) -> None:

        details = {"provider": provider} if provider else None

        if status_code is None:
            status_code = 500

        super().__init__(
            status_code=status_code,
            message=message,
            code="LLM_ERROR",
            details=details,
            **kwargs,
        )
        self.message = message
        self.provider = provider
        self.status_code = status_code


class LLMProviderInitError(LLMError):
    """Exception raised when a provider fails to initialize."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )


class LLMProviderError(LLMError):
    """Generic provider-side failure."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )


class LLMRateLimitError(LLMError):
    """Exception raised for HTTP 429 or quota limit errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        retry_after_s: float | None = None,
        **kwargs,
    ) -> None:

        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )
        self.retry_after_s = retry_after_s


class LLMTimeoutError(LLMError):
    """Exception raised when a request exceeds its maximum execution time."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        elapsed_s: float | None = None,
        **kwargs,
    ) -> None:

        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )
        self.elapsed_s = elapsed_s


class LLMTokenLimitError(LLMError):
    """Exception raised when a request exceeds the model's token limits."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        token_count: int | None = None,
        context_limit: int | None = None,
        **kwargs,
    ) -> None:

        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )
        self.token_count = token_count
        self.context_limit = context_limit


class LLMContentFilterError(LLMError):
    """Exception raised when a response is blocked by a safety policy."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        **kwargs,
    ) -> None:

        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )


class LLMAuthenticationError(LLMError):
    """Exception raised for invalid or missing API credentials."""

    def __init__(
        self,
        message: str,
        status_code=401,
        provider: str | None = None,
        **kwargs,
    ) -> None:

        super().__init__(
            message=message,
            status_code=status_code,
            provider=provider,
            **kwargs,
        )
