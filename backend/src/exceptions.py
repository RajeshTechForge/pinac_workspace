"""Custom exception hierarchy for Pinac-Workspace."""

from __future__ import annotations

HTTP_ERROR_CODE_MAP: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    405: "METHOD_NOT_ALLOWED",
    408: "REQUEST_TIMEOUT",
    409: "CONFLICT",
    415: "UNSUPPORTED_MEDIA_TYPE",
    422: "UNPROCESSABLE_ENTITY",
    429: "TOO_MANY_REQUESTS",
    500: "INTERNAL_ERROR",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


class NexusError(Exception):
    """Base exception for all Pinac-Nexus errors."""

    def __init__(
        self,
        message: str,
        code: str = "PINAC_NEXUS_ERROR",
        details: dict | None = None,
        status_code: int = 500,
    ):
        if details:
            details.pop("error")  # Remove nested error details if present

        self.message = message
        self.code = code
        self.details = details
        self.status_code = status_code
        super().__init__(self.message)

    def to_dict(self) -> dict:
        """Convert exception to dictionary for API responses."""
        return {
            "error": self.code,
            "message": self.message,
            "details": self.details,
        }
