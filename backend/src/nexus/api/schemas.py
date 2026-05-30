from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from nexus.services.llm.base import LLMRequest, ProviderType
from nexus.services.llm.schemas import (
    LLMResponseSchema,
    MessageSchema,
    ThinkingConfigSchema,
)


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


#       LLM CHAT
# ---------------------------


class ChatRequest(BaseSchema):
    """Payload for BYOK chat completions."""

    provider: ProviderType = Field(
        ..., description="Which provider to use (anthropic, openai, gemini)."
    )
    api_key: str = Field(..., min_length=1, description="Provider API key (BYOK mode).")
    model: str = Field(
        default="", description="Model identifier. If empty, uses provider default."
    )
    messages: list[MessageSchema] = Field(
        ..., min_length=1, description="Conversation history."
    )
    stream: bool = Field(default=False, description="Whether to stream the response.")
    max_tokens: int = Field(
        default=2048, ge=1, le=128_000, description="Max tokens to generate."
    )
    temperature: float = Field(
        default=0.1, ge=0.0, le=2.0, description="Sampling temperature."
    )
    top_p: float = Field(default=1.0, ge=0.0, le=1.0, description="Nucleus sampling.")
    stop_sequences: list[str] = Field(
        default_factory=list, max_length=8, description="Stop sequences."
    )
    timeout: float | None = Field(
        default=30.0, ge=1.0, le=600.0, description="Request timeout in seconds."
    )
    thinking: ThinkingConfigSchema | None = Field(
        default=None,
        description=(
            "Thinking/reasoning configuration. When omitted, no thinking "
            "parameters are sent to the provider."
        ),
    )

    @model_validator(mode="after")
    def thinking_provider_must_match(self) -> "ChatRequest":
        """Ensure provider_options.provider matches the top-level provider field.

        Raises:
            ValueError: If the provider_options discriminator does not match.
        """
        if (
            self.thinking
            and self.thinking.provider_options
            and self.thinking.provider_options.provider != self.provider.value
        ):
            raise ValueError(
                f"thinking.provider_options.provider "
                f"('{self.thinking.provider_options.provider}') must match "
                f"the top-level provider ('{self.provider.value}')."
            )
        return self

    def to_llm_request(self) -> LLMRequest:
        """Convert to the internal LLMRequest domain object."""
        return LLMRequest(
            messages=[m.to_domain() for m in self.messages],
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            stop_sequences=self.stop_sequences,
            stream=self.stream,
            timeout=self.timeout,
            thinking=self.thinking.to_domain() if self.thinking else None,
        )


class ChatResponse(LLMResponseSchema):
    """Inherits directly from the internal schema for consistency"""
