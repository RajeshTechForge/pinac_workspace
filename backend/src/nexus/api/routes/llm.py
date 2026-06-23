"""LLM proxy routes for chat completion."""

from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from kitkat.core.exceptions import LLMError
from kitkat.service.byok import BYOKLLMService

from nexus.api.schemas import ChatRequest, ChatResponse
from nexus.exceptions import NexusError
from nexus.services.llm.schemas import (
    StreamChunkEvent,
    StreamChunkSchema,
    StreamErrorEvent,
    StreamErrorPayload,
)

router = APIRouter()


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


async def _byok_stream_generator(body: ChatRequest) -> AsyncIterator[bytes]:
    """Yield SSE chunks from the provider, catching errors mid-stream."""
    try:
        async with BYOKLLMService(
            provider_type=body.provider,
            api_key=body.api_key,
            model=body.model,
        ) as svc:
            request = body.to_llm_request()
            async for chunk in svc.stream(request):
                event = StreamChunkEvent(data=StreamChunkSchema.from_domain(chunk))
                yield f"data: {event.model_dump_json()}\n\n".encode("utf-8")

    except LLMError as exc:
        event = _llm_error_to_sse(exc)
        yield f"data: {event.model_dump_json()}\n\n".encode("utf-8")
    except NexusError as exc:
        event = StreamErrorEvent(
            error=StreamErrorPayload(
                code=exc.code,
                message=exc.message,
                details=exc.details,
            )
        )
        yield f"data: {event.model_dump_json()}\n\n".encode("utf-8")
    except Exception:
        event = StreamErrorEvent(
            error=StreamErrorPayload(
                code="INTERNAL_ERROR",
                message="An unexpected error occurred during streaming.",
            )
        )
        yield f"data: {event.model_dump_json()}\n\n".encode("utf-8")


@router.post("/chat")
async def chat_completion(body: ChatRequest):
    """Execute a BYOK chat completion request.

    If stream=True, returns an SSE (Server-Sent Events) stream.
    If stream=False, returns a standard ChatResponse JSON payload.
    """
    if body.stream:
        return StreamingResponse(
            _byok_stream_generator(body),
            media_type="text/event-stream",
        )

    async with BYOKLLMService(
        provider_type=body.provider,
        api_key=body.api_key,
        model=body.model,
    ) as svc:
        response = await svc.complete(body.to_llm_request())
        return ChatResponse.from_domain(response)
