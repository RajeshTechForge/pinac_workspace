"""Provide dependency wiring and shared application state for the API layer.

The module owns application lifecycle initialization and exposes typed FastAPI
dependencies so route handlers can consume services without direct global state
access.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, Request

from src.config import AppSettings, get_settings


class AppState:
    """Store long-lived service instances for the running API process.

    Attributes:
        _initialized: Indicates whether startup has already created service
            instances for this process.
    """

    def __init__(self) -> None:
        self._initialized: bool = False

    @property
    def is_initialized(self) -> bool:
        """Return whether application services are initialized."""
        return self._initialized

    async def initialize(self, settings: AppSettings) -> None:
        """Initialize shared infrastructure services from configuration.

        Args:
            settings: Application settings used to create service clients.

        Returns:
            None.

        Note:
            Returns immediately when services are already initialized. This
            keeps repeated startup hooks idempotent.
        """
        if self._initialized:
            return

        self._initialized = True

    async def shutdown(self) -> None:
        """Release shared infrastructure services."""
        self._initialized = False


_app_state = AppState()


def get_app_state() -> AppState:
    """Return the singleton application state container."""
    return _app_state


@asynccontextmanager
async def app_lifespan(app):
    """Run startup and shutdown hooks for the FastAPI lifespan."""
    settings = get_settings()
    state = get_app_state()

    await state.initialize(settings)

    yield

    await state.shutdown()


# ----------------------------------------------------------------------------
# DEPENDENCY PROVIDERS
# ----------------------------------------------------------------------------


def get_settings_dep() -> AppSettings:
    """Provide application settings as a dependency."""
    return get_settings()


SettingsDep = Annotated[AppSettings, Depends(get_settings_dep)]


# ----------------------------------------------------------------------------
# REQUEST CONTEXT
# ----------------------------------------------------------------------------


class RequestContext:
    """Represent request-scoped metadata used by downstream services."""

    def __init__(
        self,
        request: Request,
    ) -> None:
        self.request = request

    @property
    def client_ip(self) -> str | None:
        """Return the request client IP address when available."""
        return self.request.client.host if self.request.client else None

    @property
    def user_agent(self) -> str | None:
        """Return the request user-agent header value."""
        return self.request.headers.get("user-agent")

    @property
    def session_id(self) -> str | None:
        """Return the current session identifier from request cookies."""
        return self.request.cookies.get("session_id")

    def to_dict(self) -> dict[str, str | None]:
        """Serialize request metadata for persistence and logging.

        Returns:
            Mapping with client IP, user agent, and session identifier.
        """
        return {
            "ip_address": self.client_ip,
            "user_agent": self.user_agent,
            "session_id": self.session_id,
        }


async def get_request_context(request: Request) -> RequestContext:
    """Create request-scoped context for dependency injection.

    Args:
        request: Incoming FastAPI request.

    Returns:
        RequestContext containing request metadata.
    """
    return RequestContext(request=request)


RequestContextDep = Annotated[RequestContext, Depends(get_request_context)]


# ----------------------------------------------------------------------------
# COMPOSITE DEPENDENCIES
# ----------------------------------------------------------------------------


class ServiceContainer:
    """Bundle frequently co-used services for route handler dependencies."""

    def __init__(
        self,
        settings: AppSettings,
        context: RequestContext,
    ) -> None:
        self.settings = settings
        self.context = context


async def get_services(
    settings: SettingsDep,
    context: RequestContextDep,
) -> ServiceContainer:
    """Assemble a composite dependency with core request services.

    Args:
        settings: Loaded application settings.
        context: Request-scoped metadata and identity context.

    Returns:
        ServiceContainer with grouped services for route handlers.
    """
    return ServiceContainer(
        settings=settings,
        context=context,
    )


ServicesDep = Annotated[ServiceContainer, Depends(get_services)]
