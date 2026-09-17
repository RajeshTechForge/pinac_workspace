"""Map API exceptions to standardized error responses.

Handlers return a consistent error envelope and request identifier so client
errors can be correlated with server logs during incident analysis.
"""

from __future__ import annotations

import logging
import traceback
from uuid import uuid4

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from kitkat import (
    LLMAuthenticationError,
    LLMContentFilterError,
    LLMError,
    LLMRateLimitError,
    LLMTimeoutError,
    LLMTokenLimitError,
)
from starlette.exceptions import HTTPException as StarletteHTTPException

from nexus.config import get_settings
from nexus.exceptions import HTTP_ERROR_CODE_MAP, NexusError

logger = logging.getLogger(__name__)


def create_error_response(
    request_id: str,
    error: str,
    message: str,
    status_code: int,
    details: dict | None = None,
) -> JSONResponse:
    """Build a standardized JSON error response payload."""

    content: dict[str, object] = {
        "error": error,
        "message": message,
        "request_id": request_id,
    }
    if details:
        content["details"] = details

    return JSONResponse(status_code=status_code, content=content)


async def nexus_exception_handler(request: Request, exc: NexusError) -> JSONResponse:
    """Convert SentinelError into an API error response."""

    request_id = getattr(request.state, "request_id", str(uuid4()))

    return create_error_response(
        request_id=request_id,
        error=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details if exc.details else None,
    )


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError,
) -> JSONResponse:
    """Convert request validation errors into an API error response."""

    request_id = getattr(request.state, "request_id", str(uuid4()))

    errors = []
    for error in exc.errors():
        field = ".".join(str(loc) for loc in error["loc"])
        errors.append(
            {
                "field": field,
                "message": error["msg"],
                "type": error["type"],
            }
        )
    return create_error_response(
        request_id=request_id,
        error="VALIDATION_ERROR",
        message="Request validation failed",
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        details={"validation_errors": errors},
    )


async def http_exception_handler(
    request: Request,
    exc: StarletteHTTPException,
) -> JSONResponse:
    """Convert Starlette HTTP exceptions into API error responses."""

    request_id = getattr(request.state, "request_id", str(uuid4()))

    error_code = HTTP_ERROR_CODE_MAP.get(exc.status_code, "HTTP_ERROR")

    return create_error_response(
        request_id=request_id,
        error=error_code,
        message=str(exc.detail),
        status_code=exc.status_code,
    )


async def unhandled_exception_handler(
    request: Request,
    exc: Exception,
) -> JSONResponse:
    """Convert unexpected exceptions into internal error responses."""

    request_id = getattr(request.state, "request_id", str(uuid4()))
    settings = get_settings()

    if settings.debug:
        details = {
            "exception_type": type(exc).__name__,
            "exception_message": str(exc),
            "traceback": traceback.format_exc().split("\n"),
        }
    else:
        details = None

    return create_error_response(
        request_id=request_id,
        error="INTERNAL_ERROR",
        message="An unexpected error occurred. Please try again later.",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        details=details,
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Register API exception handlers on the FastAPI application."""

    app.exception_handler(NexusError)(nexus_exception_handler)
    app.exception_handler(LLMError)(llm_error_handler)
    app.exception_handler(RequestValidationError)(validation_exception_handler)
    app.exception_handler(StarletteHTTPException)(http_exception_handler)
    app.exception_handler(Exception)(unhandled_exception_handler)


async def llm_error_handler(request: Request, exc: LLMError) -> JSONResponse:
    """Convert kitkat LLMError subclasses into standardized HTTP error responses.

    Maps each exception type to the appropriate HTTP status code per kitkat's
    documented exception hierarchy.  Generic messages are returned to callers —
    internal provider details are never exposed.

    Args:
        request: The incoming FastAPI request.
        exc: The kitkat LLMError (or subclass) that was raised.

    Returns:
        JSONResponse with a status code and error envelope.
    """
    request_id = getattr(request.state, "request_id", str(uuid4()))
    headers: dict[str, str] = {}

    if isinstance(exc, LLMAuthenticationError):
        http_status = status.HTTP_401_UNAUTHORIZED
        message = "Authentication with the AI provider failed. Check your API key."
        code = "LLM_AUTHENTICATION_ERROR"
    elif isinstance(exc, LLMRateLimitError):
        http_status = status.HTTP_429_TOO_MANY_REQUESTS
        retry_after: float | None = getattr(exc, "retry_after_s", None)
        if retry_after is not None:
            headers["Retry-After"] = str(int(retry_after))
        message = "AI provider rate limit exceeded. Please retry after a moment."
        code = "LLM_RATE_LIMIT_ERROR"
    elif isinstance(exc, LLMTokenLimitError):
        http_status = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
        message = "Prompt exceeds the maximum context length for the selected model."
        code = "LLM_TOKEN_LIMIT_ERROR"
    elif isinstance(exc, LLMContentFilterError):
        http_status = status.HTTP_400_BAD_REQUEST
        message = "The response was blocked by the provider's content safety filters."
        code = "LLM_CONTENT_FILTER_ERROR"
    elif isinstance(exc, LLMTimeoutError):
        http_status = status.HTTP_504_GATEWAY_TIMEOUT
        message = "The AI provider did not respond within the allowed timeout."
        code = "LLM_TIMEOUT_ERROR"
    else:
        http_status = status.HTTP_502_BAD_GATEWAY
        message = "An error was returned by the AI provider."
        code = "LLM_PROVIDER_ERROR"

    logger.exception(
        "LLM provider error",
        extra={"code": code, "provider": getattr(exc, "provider", None)},
    )

    return create_error_response(
        request_id=request_id,
        error=code,
        message=message,
        status_code=http_status,
        details=headers or None,
    )
