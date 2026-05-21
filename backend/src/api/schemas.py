from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    """Provide shared Pydantic configuration for API schema models."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class TimestampMixin(BaseModel):
    """Add optional creation and update timestamps to schema models."""

    created_at: datetime | None = None
    updated_at: datetime | None = None


#       HEALTH CHECK
# ---------------------------


class HealthResponse(BaseSchema):
    """Represent the baseline health check response payload."""

    status: str = "healthy"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class DetailedHealthResponse(HealthResponse):
    """Represent health check payload with component diagnostics."""

    components: dict[str, dict[str, Any]] = Field(default_factory=dict)
