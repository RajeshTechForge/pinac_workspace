"""Define Pydantic V2 schemas for the Nexus HTTP API layer.

Schemas in this module represent request/response shapes at the HTTP
boundary.  They are responsible for input validation, sanitization, and
conversion to kitkat domain types.  No kitkat domain types are re-modelled
here — schemas convert *to* and *from* kitkat types via explicit methods.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from kitkat import FinishReason, LLMRequest, Message, ProviderType, Role, ThinkingConfig
from kitkat import LLMResponse as KitkatLLMResponse
from kitkat.core.enums import ByokProviderType  # noqa: TC002
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class BaseSchema(BaseModel):
    """Provide shared Pydantic configuration for API schema models."""

    model_config = ConfigDict(from_attributes=True, str_strip_whitespace=True)


class TimestampMixin(BaseModel):
    """Add optional creation and update timestamps to schema models."""

    created_at: datetime | None = None
    updated_at: datetime | None = None


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------


class HealthResponse(BaseSchema):
    """Represent the baseline health check response payload."""

    status: str = "healthy"
    version: str
    environment: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(UTC))


class DetailedHealthResponse(HealthResponse):
    """Represent health check payload with component diagnostics."""

    components: dict[str, dict[str, Any]] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Thinking configuration (API-boundary validation concern)
#
# kitkat.ThinkingConfig carries (enabled, effort, provider_options: dict).
# Nexus validates the provider_options dict shape at the HTTP boundary via
# a discriminated union so API callers receive precise error messages instead
# of silent dict failures inside kitkat.
# ---------------------------------------------------------------------------


class AnthropicThinkingOptions(BaseModel):
    """Anthropic-specific thinking overrides for the API request payload.

    Controls the two thinking modes on Claude models:

    - Adaptive (thinking_type='adaptive'): Claude dynamically decides
      reasoning depth. Use ``effort`` to guide the level. Available on
      Claude 4.6+. Required on Opus 4.7+.
    - Fixed-budget (thinking_type='enabled'): Explicit token budget via
      ``budget_tokens``. Deprecated on Claude 4.6, removed on Opus 4.7+.
    """

    provider: Literal["anthropic"] = "anthropic"
    thinking_type: Literal["adaptive", "enabled"] | None = Field(
        default=None,
        description=(
            "Thinking mode. 'adaptive' for dynamic reasoning depth, "
            "'enabled' for fixed token budget. Defaults to 'adaptive' when omitted."
        ),
    )
    budget_tokens: int | None = Field(
        default=None,
        ge=1024,
        description="Fixed token budget. Only valid with thinking_type='enabled'.",
    )
    effort: Literal["low", "medium", "high", "xhigh", "max"] | None = Field(
        default=None,
        description=(
            "Effort level for adaptive thinking. Provider default is 'high'. "
            "'xhigh' and 'max' are not available on all models."
        ),
    )


class OpenAIThinkingOptions(BaseModel):
    """OpenAI-specific thinking overrides for the API request payload.

    OpenAI reasoning models are always reasoning-capable — there is no
    on/off toggle. This schema controls the reasoning effort level.
    """

    provider: Literal["openai"] = "openai"
    effort: Literal["none", "minimal", "low", "medium", "high", "xhigh"] | None = Field(
        default=None,
        description="Reasoning effort level. Lower = faster, higher = deeper reasoning.",
    )


class GeminiThinkingOptions(BaseModel):
    """Gemini-specific thinking overrides for the API request payload."""

    provider: Literal["gemini"] = "gemini"
    level: Literal["MINIMAL", "LOW", "MEDIUM", "HIGH"] | None = Field(
        default=None,
        description="Gemini thinking level.",
    )


ProviderThinkingOptions = Annotated[
    AnthropicThinkingOptions | OpenAIThinkingOptions | GeminiThinkingOptions,
    Field(discriminator="provider"),
]
"""Discriminated union of provider-specific thinking option schemas."""


class ThinkingRequest(BaseModel):
    """Provider-agnostic thinking/reasoning configuration for the API request payload.

    Use ``effort`` for the common case (maps to the provider-native vocabulary
    for low/medium/high).  Use ``provider_options`` for parameters that have no
    cross-provider equivalent (e.g. Anthropic ``budget_tokens``, OpenAI ``xhigh``).
    When both are supplied, ``provider_options`` takes precedence inside kitkat.
    """

    enabled: bool = Field(
        default=False,
        description="Activate thinking/reasoning mode.",
    )
    effort: Literal["low", "medium", "high"] | None = Field(
        default=None,
        description=(
            "Normalized effort level mapped to each provider's native vocabulary. "
            "Ignored when provider_options supplies its own effort/level."
        ),
    )
    provider_options: ProviderThinkingOptions | None = Field(
        default=None,
        description=(
            "Typed provider-specific overrides. Discriminated by the 'provider' "
            "literal field inside each options model."
        ),
    )

    def to_domain(self) -> ThinkingConfig:
        """Convert to the kitkat ThinkingConfig dataclass.

        Returns:
            ThinkingConfig with provider_options serialized to a plain dict
            (the ``provider`` discriminator key is excluded because kitkat
            derives the provider from the service context, not from this dict).
        """
        return ThinkingConfig(
            enabled=self.enabled,
            effort=self.effort,
            provider_options=(
                self.provider_options.model_dump(exclude={"provider"}, exclude_none=True)
                if self.provider_options
                else None
            ),
        )


# ---------------------------------------------------------------------------
# LLM Chat — Request
# ---------------------------------------------------------------------------


class _MessageInput(BaseModel):
    """A single conversation turn as received from the API layer."""

    model_config = ConfigDict(use_enum_values=True)

    role: Role = Field(
        ...,
        description="Who authored this message.",
        examples=["user", "assistant", "system"],
    )
    content: str = Field(..., min_length=1, description="The text content of the message.")

    @field_validator("content")
    @classmethod
    def content_not_whitespace_only(cls, v: str) -> str:
        """Reject messages that consist entirely of whitespace."""
        if not v.strip():
            raise ValueError("Message content must not be whitespace-only.")
        return v


class ChatRequest(BaseSchema):
    """Payload for BYOK chat completions received at the HTTP boundary.

    Validates all fields, enforces message ordering constraints, and verifies
    that any provider-specific thinking options match the top-level provider.
    ``to_llm_request()`` converts the validated payload into a kitkat
    ``LLMRequest`` for dispatch.
    """

    model_config = ConfigDict(
        from_attributes=True,
        str_strip_whitespace=True,
        use_enum_values=True,
    )

    provider: ByokProviderType = Field(
        ...,
        description="Which provider to use (anthropic, openai, gemini).",
    )
    api_key: str = Field(..., min_length=1, description="Provider API key (BYOK mode).")
    model: str = Field(default="", description="Model identifier. Empty → provider default.")
    messages: list[_MessageInput] = Field(
        ...,
        min_length=1,
        description="Ordered conversation history. Must contain at least one message.",
    )
    stream: bool = Field(
        default=False,
        description="Whether to stream the response token-by-token.",
    )
    max_tokens: int = Field(
        default=2048,
        ge=1,
        le=128_000,
        description="Maximum tokens to generate.",
    )
    temperature: float = Field(
        default=0.1,
        ge=0.0,
        le=2.0,
        description="Sampling temperature.",
    )
    top_p: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Nucleus sampling probability mass.",
    )
    stop_sequences: list[str] = Field(
        default_factory=list,
        max_length=8,
        description="Strings that stop generation when encountered.",
    )
    timeout: float | None = Field(
        default=30.0,
        ge=1.0,
        le=600.0,
        description="Per-request wall-clock timeout in seconds. None → provider default.",
    )
    thinking: ThinkingRequest | None = Field(
        default=None,
        description=(
            "Thinking/reasoning configuration. When omitted, no thinking "
            "parameters are sent to the provider."
        ),
    )

    @model_validator(mode="after")
    def system_message_at_most_one_and_first(self) -> ChatRequest:
        """Enforce at most one system message, placed first in the conversation.

        Raises:
            ValueError: If more than one system message is present, or if the
                system message is not at position 0.
        """
        system_positions = [i for i, m in enumerate(self.messages) if m.role == Role.SYSTEM.value]
        if len(system_positions) > 1:
            raise ValueError(
                f"At most one system message is allowed; found {len(system_positions)}"
                f" at positions {system_positions}."
            )
        if system_positions and system_positions[0] != 0:
            raise ValueError(
                "The system message must be the first message in the conversation, "
                f"but was found at index {system_positions[0]}."
            )
        return self

    @model_validator(mode="after")
    def thinking_provider_must_match(self) -> ChatRequest:
        """Ensure provider_options.provider matches the top-level provider field.

        Raises:
            ValueError: If the provider_options discriminator does not match the
                top-level provider, which would silently apply the wrong
                provider-specific parameters inside kitkat.
        """
        if (
            self.thinking
            and self.thinking.provider_options
            and self.thinking.provider_options.provider != self.provider
        ):
            raise ValueError(
                f"thinking.provider_options.provider "
                f"('{self.thinking.provider_options.provider}') must match "
                f"the top-level provider ('{self.provider}')."
            )
        return self

    def to_llm_request(self) -> LLMRequest:
        """Convert the validated API payload to a kitkat LLMRequest.

        Returns:
            LLMRequest ready for dispatch via BYOKLLMService.
        """
        return LLMRequest(
            messages=[Message(role=Role(m.role), content=m.content) for m in self.messages],
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            stop_sequences=list(self.stop_sequences),
            stream=self.stream,
            timeout=self.timeout,
            thinking=self.thinking.to_domain() if self.thinking else None,
        )


# ---------------------------------------------------------------------------
# LLM Chat — Response
# ---------------------------------------------------------------------------


class ChatResponse(BaseModel):
    """Non-streaming chat completion response returned to API callers.

    Built directly from a ``kitkat.LLMResponse`` via ``from_llm_response()``.
    Only the fields relevant to the HTTP response are included; the raw
    provider response object is intentionally excluded at this boundary.
    """

    model_config = ConfigDict(use_enum_values=True)

    content: str = Field(..., description="Generated text content (answer only).")
    thinking_content: str = Field(
        default="",
        description=(
            "Reasoning/thinking text produced by the model. Empty when thinking "
            "is disabled or the provider does not expose thinking text."
        ),
    )
    finish_reason: FinishReason = Field(..., description="Why the model stopped generating.")
    usage: _TokenUsageOutput = Field(..., description="Token consumption breakdown.")
    model: str = Field(..., description="Exact model version that generated the response.")
    provider: ProviderType = Field(..., description="Which provider served the request.")
    latency_ms: float = Field(
        ...,
        ge=0.0,
        description="Wall-clock time for the provider round-trip in ms.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="UTC timestamp when the response was produced.",
    )

    @classmethod
    def from_llm_response(cls, resp: KitkatLLMResponse) -> ChatResponse:
        """Build from a kitkat LLMResponse.

        Args:
            resp: The LLMResponse returned by BYOKLLMService.complete().

        Returns:
            The API-ready ChatResponse instance.
        """
        return cls(
            content=resp.content,
            thinking_content=resp.thinking_content,
            finish_reason=resp.finish_reason,
            usage=_TokenUsageOutput(
                prompt_tokens=resp.usage.prompt_tokens,
                completion_tokens=resp.usage.completion_tokens,
                thinking_tokens=resp.usage.thinking_tokens,
                total_tokens=resp.usage.total_tokens,
            ),
            model=resp.model,
            provider=resp.provider,
            latency_ms=resp.latency_ms,
        )


class _TokenUsageOutput(BaseModel):
    """Token consumption breakdown embedded in ChatResponse."""

    prompt_tokens: int = Field(
        default=0,
        ge=0,
        description="Tokens consumed by the input messages.",
    )
    completion_tokens: int = Field(
        default=0,
        ge=0,
        description="Tokens generated in the answer.",
    )
    thinking_tokens: int = Field(
        default=0,
        ge=0,
        description="Tokens consumed by extended thinking. 0 when thinking is disabled.",
    )
    total_tokens: int = Field(
        default=0,
        ge=0,
        description="Sum of prompt, completion, and thinking tokens.",
    )
