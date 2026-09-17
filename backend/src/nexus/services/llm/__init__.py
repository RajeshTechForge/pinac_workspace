"""Expose the public interface for the LLM service package.

Only Nexus-specific constructs are re-exported here. kitkat domain types
(LLMRequest, LLMResponse, StreamChunk, etc.) are imported directly from
the kitkat package at the call site.
"""

from __future__ import annotations

from nexus.services.llm.schemas import (
    StreamChunkEvent,
    StreamErrorEvent,
    StreamErrorPayload,
    StreamEventType,
    StreamSSEEvent,
)
from nexus.services.llm.sse import byok_stream_generator

__all__ = [
    "StreamChunkEvent",
    "StreamErrorEvent",
    "StreamErrorPayload",
    "StreamEventType",
    "StreamSSEEvent",
    "byok_stream_generator",
]
