"""Define Pydantic V2 schemas for the LLM service layer boundary.

These schemas validate data from the API HTTP layer and convert it into the
lightweight domain dataclasses used by the router and providers. They enforce
boundaries and specific structural constraints.
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .base import (
    FinishReason,
    LLMRequest,
    LLMResponse,
    Message,
    ProviderType,
    Role,
    StreamChunk,
    TokenUsage,
)


class MessageSchema(BaseModel):
    """A single conversation turn as received from the API layer."""

    model_config = ConfigDict(use_enum_values=True)

    role: Role = Field(
        ...,
        description="Who authored this message.",
        examples=["user", "assistant", "system"],
    )
    content: str = Field(
        ...,
        min_length=1,
        description="The text content of the message.",
    )

    @field_validator("content")
    @classmethod
    def content_not_whitespace_only(cls, v: str) -> str:
        """Reject messages that consist entirely of whitespace."""
        if not v.strip():
            raise ValueError("Message content must not be whitespace-only.")
        return v

    def to_domain(self) -> Message:
        """Convert to the internal Message dataclass."""
        return Message(role=Role(self.role), content=self.content)

    @classmethod
    def from_domain(cls, msg: Message) -> "MessageSchema":
        """Build from the internal domain dataclass.

        Args:
            msg: The internal message dataclass.

        Returns:
            The Pydantic message schema instance.
        """
        return cls(role=msg.role, content=msg.content)


# ---------------------------------------------------------------------------
# LLM Request
# ---------------------------------------------------------------------------


class LLMRequestSchema(BaseModel):
    """Validated completion request received from the API layer."""

    model_config = ConfigDict(use_enum_values=True)

    messages: list[MessageSchema] = Field(
        ...,
        min_length=1,
        description="Ordered conversation history. Must contain at least one message.",
    )
    model: str = Field(
        default="",
        description=(
            "Target model identifier. "
            "Empty string → each provider uses its configured default."
        ),
    )
    max_tokens: int = Field(
        default=2048,
        ge=1,
        le=128_000,
        description="Maximum tokens to generate in the response.",
    )
    temperature: float = Field(
        default=0.1,
        ge=0.0,
        le=2.0,
        description="Sampling temperature. Lower = more deterministic (recommended for RAG).",
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
    stream: bool = Field(
        default=False,
        description="Whether to stream the response token-by-token.",
    )
    timeout: float | None = Field(
        default=30.0,
        ge=1.0,
        le=600.0,
        description="Per-request wall-clock timeout in seconds. None → provider default.",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Arbitrary key-value pairs forwarded through the pipeline.",
    )

    @model_validator(mode="after")
    def system_message_at_most_one_and_first(self) -> "LLMRequestSchema":
        """Enforce that at most one system message is present and it is the first message.

        Raises:
            ValueError: If multiple system messages are provided or if the system message is not at the first position.
        """
        system_positions = [
            i for i, m in enumerate(self.messages) if m.role == Role.SYSTEM.value
        ]
        if len(system_positions) > 1:
            raise ValueError(
                f"At most one system message is allowed; "
                f"found {len(system_positions)} at positions {system_positions}."
            )
        if system_positions and system_positions[0] != 0:
            raise ValueError(
                "The system message must be the first message in the conversation, "
                f"but was found at index {system_positions[0]}."
            )
        return self

    def to_domain(self) -> LLMRequest:
        """Produce the zero-overhead dataclass dispatched by the router and providers.

        Returns:
            The equivalent LLMRequest domain object.
        """
        return LLMRequest(
            messages=[m.to_domain() for m in self.messages],
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            top_p=self.top_p,
            stop_sequences=list(self.stop_sequences),
            stream=self.stream,
            timeout=self.timeout,
        )

    @classmethod
    def from_domain(cls, req: LLMRequest) -> "LLMRequestSchema":
        """Build from the internal domain dataclass.

        Args:
            req: The LLMRequest domain object.

        Returns:
            The corresponding Pydantic schema instance.
        """
        return cls(
            messages=[MessageSchema.from_domain(m) for m in req.messages],
            model=req.model,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
            top_p=req.top_p,
            stop_sequences=req.stop_sequences,
            stream=req.stream,
            timeout=req.timeout,
        )


# ---------------------------------------------------------------------------
# Token usage
# ---------------------------------------------------------------------------


class TokenUsageSchema(BaseModel):
    """Token consumption for a single request, used for cost attribution and rate-limit budgeting."""

    prompt_tokens: int = Field(
        default=0,
        ge=0,
        description="Tokens consumed by the input messages.",
    )
    completion_tokens: int = Field(
        default=0,
        ge=0,
        description="Tokens generated in the response.",
    )
    total_tokens: int = Field(
        default=0,
        ge=0,
        description="Sum of prompt and completion tokens.",
    )

    @model_validator(mode="after")
    def total_is_consistent(self) -> "TokenUsageSchema":
        """Auto-correct total_tokens when providers omit it or round differently.

        Returns:
            The TokenUsageSchema instance with corrected total_tokens if necessary.
        """
        expected = self.prompt_tokens + self.completion_tokens
        discrepancy = abs(self.total_tokens - expected)

        # Correct if total is missing (0 and we have data) or materially wrong
        if self.total_tokens == 0 or discrepancy > 1:
            self.total_tokens = expected

        return self

    def to_domain(self) -> TokenUsage:
        """Convert to the internal TokenUsage dataclass."""
        return TokenUsage(
            prompt_tokens=self.prompt_tokens,
            completion_tokens=self.completion_tokens,
            total_tokens=self.total_tokens,
        )

    @classmethod
    def from_domain(cls, usage: TokenUsage) -> "TokenUsageSchema":
        """Build from the internal domain dataclass."""
        return cls(
            prompt_tokens=usage.prompt_tokens,
            completion_tokens=usage.completion_tokens,
            total_tokens=usage.total_tokens,
        )


# ---------------------------------------------------------------------------
# LLM Response (non-streaming)
# ---------------------------------------------------------------------------


class LLMResponseSchema(BaseModel):
    """Completed (non-streaming) response returned to API callers."""

    model_config = ConfigDict(use_enum_values=True)

    content: str = Field(..., description="Generated text content.")
    finish_reason: FinishReason = Field(
        ..., description="Why the model stopped generating."
    )
    usage: TokenUsageSchema = Field(..., description="Token consumption breakdown.")
    model: str = Field(
        ..., description="Exact model version that generated the response."
    )
    provider: ProviderType = Field(
        ..., description="Which provider served the request."
    )
    latency_ms: float = Field(
        ...,
        ge=0.0,
        description="Wall-clock time for the full provider round-trip in milliseconds.",
    )
    cached: bool = Field(
        default=False,
        description="True if this response was served from cache.",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when the response was produced.",
    )

    @property
    def was_truncated(self) -> bool:
        """Return True when the response was cut short by the max_tokens limit."""
        return self.finish_reason == FinishReason.LENGTH.value

    @classmethod
    def from_domain(
        cls,
        resp: LLMResponse,
        *,
        cached: bool = False,
    ) -> "LLMResponseSchema":
        """Convert from the internal domain LLMResponse dataclass.

        Args:
            resp: The LLMResponse produced by a provider or restored from cache.
            cached: True if the response was served from the LLMCache.

        Returns:
            The Pydantic response schema instance.
        """
        return cls(
            content=resp.content,
            finish_reason=resp.finish_reason,
            usage=TokenUsageSchema.from_domain(resp.usage),
            model=resp.model,
            provider=resp.provider,
            latency_ms=resp.latency_ms,
            cached=cached,
        )

    def to_domain(self) -> LLMResponse:
        """Convert to the internal LLMResponse domain dataclass."""
        return LLMResponse(
            content=self.content,
            finish_reason=FinishReason(self.finish_reason),
            usage=self.usage.to_domain(),
            model=self.model,
            provider=ProviderType(self.provider),
            latency_ms=self.latency_ms,
            raw_response=None,  # lost at the schema boundary — by design
        )


# ---------------------------------------------------------------------------
# Stream chunk
# ---------------------------------------------------------------------------


class StreamChunkSchema(BaseModel):
    """A single token delta in a streaming response."""

    model_config = ConfigDict(use_enum_values=True)

    delta: str = Field(
        ...,
        description="Incremental text. Empty string on the final chunk.",
    )
    is_final: bool = Field(
        default=False,
        description="True on the last chunk. Subsequent fields carry aggregated values.",
    )
    finish_reason: FinishReason = Field(
        default=FinishReason.UNKNOWN,
        description="Populated on the final chunk. UNKNOWN on intermediate chunks.",
    )
    usage: TokenUsageSchema = Field(
        default_factory=TokenUsageSchema,
        description="Populated on the final chunk. Zero values on intermediate chunks.",
    )
    model: str = Field(
        default="",
        description="Exact model version. Populated on the final chunk.",
    )
    provider: ProviderType | None = Field(
        default=None,
        description=(
            "Which provider served the request. "
            "None on intermediate chunks; populated on the final chunk."
        ),
    )
    latency_ms: float = Field(
        default=0.0,
        ge=0.0,
        description="Total wall-clock time in ms. Populated on the final chunk.",
    )

    @classmethod
    def from_domain(cls, chunk: StreamChunk) -> "StreamChunkSchema":
        """Build from the internal StreamChunk dataclass.

        Args:
            chunk: The domain StreamChunk object.

        Returns:
            The Pydantic StreamChunkSchema representation.
        """
        return cls(
            delta=chunk.delta,
            is_final=chunk.is_final,
            finish_reason=chunk.finish_reason,
            usage=TokenUsageSchema.from_domain(chunk.usage),
            model=chunk.model,
            provider=chunk.provider if chunk.is_final else None,
            latency_ms=chunk.latency_ms,
        )

    def to_domain(self) -> StreamChunk:
        """Convert back to the internal StreamChunk dataclass."""
        return StreamChunk(
            delta=self.delta,
            is_final=self.is_final,
            finish_reason=FinishReason(self.finish_reason),
            usage=self.usage.to_domain(),
            model=self.model,
            provider=ProviderType(self.provider)
            if self.provider
            else ProviderType.ANTHROPIC,
            latency_ms=self.latency_ms,
        )


# ---------------------------------------------------------------------------
# SSE envelope (discriminated union)
# ---------------------------------------------------------------------------


class StreamEventType(str, Enum):
    """Discriminator values for SSE frames sent by the streaming endpoint."""

    CHUNK = "chunk"
    ERROR = "error"


class StreamErrorPayload(BaseModel):
    """Error detail embedded inside a :class:'StreamErrorEvent' frame."""

    code: str = Field(
        ..., description="Machine-readable error code. (e.g. 'AUTH_ERROR')"
    )
    message: str = Field(..., description="Human-readable error description.")
    details: dict | None = Field(
        default=None,
        description="Optional structured context. None when unavailable.",
    )


class StreamChunkEvent(BaseModel):
    """SSE envelope for a normal token-delta chunk."""

    event_type: Literal[StreamEventType.CHUNK] = StreamEventType.CHUNK
    data: StreamChunkSchema


class StreamErrorEvent(BaseModel):
    """SSE envelope for a terminal error frame emitted mid-stream."""

    event_type: Literal[StreamEventType.ERROR] = StreamEventType.ERROR
    error: StreamErrorPayload


StreamSSEEvent = Annotated[
    StreamChunkEvent | StreamErrorEvent,
    Field(discriminator="event_type"),
]
"""Discriminated union of all SSE frame types for the streaming endpoint."""


# ---------------------------------------------------------------------------
# Router / Cache observability schemas (returned by admin routes)
# ---------------------------------------------------------------------------


class ProviderStatusSchema(BaseModel):
    """Live status snapshot for a single provider slot in the router pool."""

    model_config = ConfigDict(use_enum_values=True)

    provider: ProviderType = Field(description="Provider vendor type.")
    model: str = Field(description="Model identifier used by this provider slot.")
    healthy: bool = Field(description="True if the last health probe succeeded.")
    circuit_state: str = Field(
        description="CLOSED (normal) | OPEN (failing) | HALF_OPEN (recovering).",
    )
    total_requests: int = Field(
        ge=0, description="Total requests routed here since startup."
    )
    failed_requests: int = Field(
        ge=0, description="Total failed requests since startup."
    )
    avg_latency_ms: float = Field(
        ge=0.0, description="Moving average latency in milliseconds."
    )
    error_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="Fraction of requests that failed (0.0–1.0).",
    )
    rate_limited_until: datetime | None = Field(
        default=None,
        description=(
            "If set, this provider is under a Retry-After cooldown until this UTC timestamp. "
            "Requests are skipped until this time elapses."
        ),
    )


class RouterStatusSchema(BaseModel):
    """Full router health snapshot."""

    strategy: str = Field(description="Active routing strategy name.")
    provider_count: int = Field(ge=0, description="Total providers in the pool.")
    healthy_count: int = Field(
        ge=0, description="Providers with a passing health check."
    )
    providers: list[ProviderStatusSchema] = Field(description="Per-provider detail.")
    cache_enabled: bool = Field(description="Whether the LLM response cache is active.")
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        description="UTC timestamp when this snapshot was taken.",
    )


class CacheStatsSchema(BaseModel):
    """Cache telemetry snapshot."""

    backend: str = Field(description="'memory' or 'redis'.")
    hits: int = Field(ge=0, description="Cache hits since startup.")
    misses: int = Field(ge=0, description="Cache misses since startup.")
    hit_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="hits / (hits + misses). 0.0 if no requests yet.",
    )
    size: int = Field(
        ge=0, description="Current number of entries (InMemoryCache only)."
    )
    max_size: int = Field(
        ge=0,
        description="Configured entry-count cap (InMemoryCache only; 0 = Redis backend).",
    )
    ttl_seconds: int = Field(
        ge=0, description="Default TTL applied to new cache entries."
    )
