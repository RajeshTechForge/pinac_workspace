"""Provide the SSE byte-stream generator for BYOK chat completions.

Extracting the generator from the route file makes it independently testable
and reusable by future service routes (e.g. RAG) that need to push SSE frames.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from kitkat import LLMError
from kitkat.service.byok import BYOKLLMService

from nexus.exceptions import NexusError
from nexus.services.llm.schemas import StreamErrorEvent, StreamErrorPayload

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from kitkat import LLMRequest
    from kitkat.core.enums import ByokProviderType

logger = logging.getLogger(__name__)


def _llm_error_to_sse(exc: LLMError) -> StreamErrorEvent:
    """Convert a kitkat LLMError into a structured SSE error frame.

    Args:
        exc: The kitkat exception raised during inference.

    Returns:
        A :class:`StreamErrorEvent` with a machine-readable code, the
        exception message, and an optional provider context in details.
    """
    details = {"provider": exc.provider} if getattr(exc, "provider", None) else None
    return StreamErrorEvent(
        error=StreamErrorPayload(
            code=type(exc).__name__.upper(),
            message=str(exc),
            details=details,
        )
    )


async def byok_stream_generator(
    provider: ByokProviderType,
    api_key: str,
    model: str,
    llm_request: LLMRequest,
) -> AsyncIterator[bytes]:
    """Yield SSE-encoded bytes from a BYOK provider stream.

    Each yielded value is a complete ``data: <json>\\n\\n`` SSE frame encoded
    as UTF-8 bytes.  The generator emits a terminal :class:`StreamErrorEvent`
    frame and then stops on any recognised error so the client always receives
    a structured failure instead of a silent disconnect.

    Args:
        provider: kitkat ``ByokProviderType`` value string (e.g. ``"anthropic"``).
        api_key: Caller-supplied provider API key, valid only within this call.
        model: Model identifier passed to :class:`BYOKLLMService`.
        llm_request: A ``kitkat.LLMRequest`` instance ready for dispatch.

    Yields:
        UTF-8-encoded SSE frames. Each frame is a ``StreamChunkEvent`` or, on
        failure, a single ``StreamErrorEvent`` followed by generator exhaustion.
    """
    from nexus.services.llm.schemas import StreamChunkEvent

    try:
        async with BYOKLLMService(
            provider_type=provider,
            api_key=api_key,
            model=model,
        ) as svc:
            async for chunk in svc.stream(llm_request):
                event = StreamChunkEvent(data=_chunk_to_dict(chunk))
                yield f"data: {event.model_dump_json()}\n\n".encode()

    except LLMError as exc:
        logger.exception(
            "LLM provider error during BYOK stream",
            extra={"provider": provider, "error_type": type(exc).__name__},
        )
        event = _llm_error_to_sse(exc)
        yield f"data: {event.model_dump_json()}\n\n".encode()

    except NexusError as exc:
        logger.exception(
            "Nexus error during BYOK stream",
            extra={"code": exc.code},
        )
        event = StreamErrorEvent(
            error=StreamErrorPayload(
                code=exc.code,
                message=exc.message,
                details=exc.details,
            )
        )
        yield f"data: {event.model_dump_json()}\n\n".encode()

    except Exception:
        logger.exception("Unexpected error during BYOK stream")
        event = StreamErrorEvent(
            error=StreamErrorPayload(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred during streaming.",
            )
        )
        yield f"data: {event.model_dump_json()}\n\n".encode()


def _chunk_to_dict(chunk) -> dict:
    """Serialize a kitkat StreamChunk to a plain dict for the SSE envelope.

    Args:
        chunk: A ``kitkat.StreamChunk`` dataclass instance.

    Returns:
        Plain dict representation of the chunk suitable for JSON serialization.
    """
    return {
        "delta": chunk.delta,
        "is_thinking": chunk.is_thinking,
        "is_final": chunk.is_final,
        "finish_reason": chunk.finish_reason.value if chunk.finish_reason else None,
        "usage": {
            "prompt_tokens": chunk.usage.prompt_tokens,
            "completion_tokens": chunk.usage.completion_tokens,
            "thinking_tokens": chunk.usage.thinking_tokens,
            "total_tokens": chunk.usage.total_tokens,
        },
        "model": chunk.model,
        "provider": chunk.provider.value if chunk.is_final and chunk.provider else None,
        "latency_ms": chunk.latency_ms,
    }
