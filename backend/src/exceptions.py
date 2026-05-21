"""Custom exception hierarchy for Pinac-Workspace."""


class BaseError(Exception):
    """Base class for all exceptions in Pinac-Workspace."""

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
