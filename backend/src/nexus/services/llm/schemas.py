"""Define Pydantic V2 schemas for the LLM SSE streaming envelope.

These schemas represent the wire format of Server-Sent Events emitted by the
streaming endpoint.  They are Nexus-specific constructs — kitkat has no
equivalent SSE envelope types — so they live at the service boundary rather
than in the API layer.

kitkat domain types (LLMRequest, LLMResponse, StreamChunk, ThinkingConfig,
TokenUsage, etc.) are used directly from the kitkat package throughout the
codebase; they are not re-modelled here.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class StreamEventType(StrEnum):
    """Discriminator values for SSE frames sent by the streaming endpoint."""

    CHUNK = "chunk"
    ERROR = "error"


class StreamErrorPayload(BaseModel):
    """Error detail embedded inside a :class:`StreamErrorEvent` frame."""

    code: str = Field(..., description="Machine-readable error code (e.g. 'AUTH_ERROR').")
    message: str = Field(..., description="Human-readable error description.")
    details: dict | None = Field(
        default=None,
        description="Optional structured context. None when unavailable.",
    )


class StreamChunkEvent(BaseModel):
    """SSE envelope for a normal token-delta chunk."""

    event_type: Literal[StreamEventType.CHUNK] = StreamEventType.CHUNK
    data: dict = Field(..., description="Serialized StreamChunk payload.")


class StreamErrorEvent(BaseModel):
    """SSE envelope for a terminal error frame emitted mid-stream."""

    event_type: Literal[StreamEventType.ERROR] = StreamEventType.ERROR
    error: StreamErrorPayload


StreamSSEEvent = Annotated[
    StreamChunkEvent | StreamErrorEvent,
    Field(discriminator="event_type"),
]
"""Discriminated union of all SSE frame types for the streaming endpoint."""
