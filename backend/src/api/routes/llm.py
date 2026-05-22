"""LLM proxy routes for chat completion."""

import json
from collections.abc import AsyncIterator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from src.api.schemas import ChatRequest, ChatResponse
from src.exceptions import NexusError
from src.services.llm import BYOKLLMService
from src.services.llm.schemas import StreamChunkSchema

router = APIRouter()


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
                schema = StreamChunkSchema.from_domain(chunk)
                yield f"data: {schema.model_dump_json()}\n\n".encode("utf-8")

    except NexusError as exc:
        payload = {
            "is_final": True,
            "error": {
                "code": exc.code,
                "message": exc.message,
                "details": exc.details,
            },
        }
        yield f"data: {json.dumps(payload)}\n\n".encode("utf-8")
    except Exception:
        payload = {
            "is_final": True,
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An unexpected error occurred during streaming.",
            },
        }
        yield f"data: {json.dumps(payload)}\n\n".encode("utf-8")


@router.post("/chat")
async def chat_completion(body: ChatRequest):
    """Execute a BYOK chat completion request.

    If stream=True, returns an SSE (Server-Sent Events) stream.
    If stream=False, returns a standard ChatResponse JSON payload.
    """
    if body.stream:
        BYOKLLMService(
            provider_type=body.provider,
            api_key=body.api_key,
            model=body.model,
        )

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
