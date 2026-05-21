"""
Aggregate API routers and define route namespaces.
"""

from fastapi import APIRouter

from src.api.routes.auth import router as auth_router
from src.api.routes.health import router as health_router
from src.api.routes.llm import router as llm_router

health_router_root = health_router

auth_router_root = APIRouter(prefix="/auth")
auth_router_root.include_router(auth_router, tags=["Auth"])

api_router = APIRouter(prefix="/api")
api_router.include_router(llm_router, prefix="/llm", tags=["llm"])

admin_router_root = APIRouter(prefix="/admin", tags=["Admin"])
