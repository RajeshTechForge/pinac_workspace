"""Create and configure the FastAPI application for Nexus.

This module centralizes API bootstrap so production and test entry points use
the same middleware, exception handlers, and router registration sequence.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from nexus.api.dependencies import app_lifespan
from nexus.api.exception_handlers import register_exception_handlers
from nexus.api.routes import api_router, auth_router_root, health_router_root
from nexus.config import get_settings


def create_application() -> FastAPI:
    """Create and configure the FastAPI application instance.

    Returns:
        FastAPI app with middleware and routers registered.
    """
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
        lifespan=app_lifespan,
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
        openapi_url="/openapi.json" if not settings.is_production else None,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors.allow_origins,
        allow_credentials=settings.cors.allow_credentials,
        allow_methods=settings.cors.allow_methods,
        allow_headers=settings.cors.allow_headers,
    )

    register_exception_handlers(app)

    app.include_router(health_router_root)
    app.include_router(auth_router_root)
    app.include_router(api_router)

    return app


app = create_application()


def create_test_application(**overrides) -> FastAPI:
    """Create an application instance for tests.

    Returns:
        FastAPI application configured by the standard application factory.
    """
    return create_application()
