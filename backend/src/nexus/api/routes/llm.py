"""LLM proxy routes for BYOK chat completion."""

from __future__ import annotations

import logging
from typing import cast

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from kitkat import ProviderType
from kitkat.core.enums import ByokProviderType  # noqa: TC002

from nexus.api.schemas import ChatRequest, ChatResponse
from nexus.services.llm.sse import byok_stream_generator

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=None)
async def chat_completion(body: ChatRequest) -> ChatResponse | StreamingResponse:
    """Execute a BYOK chat completion request.

    Dispatches to the appropriate response path based on the ``stream`` flag
    in the request body.

    Args:
        body: Validated :class:`ChatRequest` containing provider credentials,
            model parameters, and the conversation history.

    Returns:
        A :class:`StreamingResponse` (SSE, ``text/event-stream``) when
        ``body.stream`` is ``True``; a :class:`ChatResponse` JSON payload
        otherwise.  On streaming errors the stream emits a terminal
        ``StreamErrorEvent`` frame rather than raising an HTTP exception,
        because the 200 status has already been sent.
    """
    from kitkat.service.byok import BYOKLLMService

    # use_enum_values=True on ChatRequest stores provider as a plain str.
    # Reconstruct the enum, then cast to ByokProviderType so pyright knows
    # the value is one of the three BYOK-supported provider literals —
    # ChatRequest validation already guarantees this constraint at the boundary.
    provider = cast("ByokProviderType", ProviderType(body.provider))

    if body.stream:
        return StreamingResponse(
            byok_stream_generator(
                provider=provider,
                api_key=body.api_key,
                model=body.model,
                llm_request=body.to_llm_request(),
            ),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    async with BYOKLLMService(
        provider_type=provider,
        api_key=body.api_key,
        model=body.model,
    ) as svc:
        response = await svc.complete(body.to_llm_request())

    return ChatResponse.from_llm_response(response)
