"""Define the LLM provider exception hierarchy.

All provider-specific SDK errors are caught inside each provider implementation
and re-raised as one of the typed exceptions defined here. This decouples the
higher layers from vendor-specific SDKs. The original SDK exception is accessible
via the standard Python "__cause__" attribute.
"""

from __future__ import annotations

from src.exceptions import NexusError


class LLMError(NexusError):
    """Base exception for all LLM provider errors."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        if provider is not None:
            details = details or {}
            details["provider"] = provider

        if status_code is None:
            status_code = 500

        super().__init__(
            status_code=status_code,
            message=f"[LLMError]: {message}",
            details=details,
            **kwargs,
        )
        self.provider = provider
        self.extra = kwargs


class LLMProviderInitError(LLMError):
    """Exception raised when a provider fails to initialize."""

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=f"[LLMProviderInitError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )


class LLMProviderError(LLMError):
    """Generic provider-side failure.

    Attributes:
        status_code: The HTTP status code from the provider.
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=f"[LLMProviderError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )


class LLMRateLimitError(LLMError):
    """Exception raised for HTTP 429 or quota limit errors.

    Attributes:
        retry_after_s: The number of seconds to wait before retrying.
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        retry_after_s: float | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        if retry_after_s is not None:
            details = details or {}
            details["retry_after_s"] = retry_after_s

        super().__init__(
            message=f"[LLMRateLimitError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )
        self.retry_after_s = retry_after_s


class LLMTimeoutError(LLMError):
    """Exception raised when a request exceeds its maximum execution time.

    Attributes:
        elapsed_s: The elapsed time in seconds before the timeout occurred.
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        elapsed_s: float | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        if elapsed_s is not None:
            details = details or {}
            details["elapsed_s"] = elapsed_s

        super().__init__(
            message=f"[LLMTimeoutError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )
        self.elapsed_s = elapsed_s


class LLMTokenLimitError(LLMError):
    """Exception raised when a request exceeds the model's token limits.

    Attributes:
        token_count: The calculated token count for the problem request.
        context_limit: The maximum allowable tokens for the requested model.
    """

    def __init__(
        self,
        message: str,
        status_code: int | None = None,
        provider: str | None = None,
        token_count: int | None = None,
        context_limit: int | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        if token_count or context_limit is not None:
            details = details or {}
            if token_count is not None:
                details["token_count"] = token_count
            if context_limit is not None:
                details["context_limit"] = context_limit

        super().__init__(
            message=f"[LLMTokenLimitError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
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
        details: dict | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=f"[LLMContentFilterError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )


class LLMAuthenticationError(LLMError):
    """Exception raised for invalid or missing API credentials."""

    def __init__(
        self,
        message: str,
        status_code=401,
        provider: str | None = None,
        details: dict | None = None,
        **kwargs,
    ) -> None:
        super().__init__(
            message=f"[LLMAuthenticationError] {message}",
            status_code=status_code,
            provider=provider,
            details=details,
            **kwargs,
        )
