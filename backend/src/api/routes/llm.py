"""LLM proxy routes"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/chat")
async def chat_completion(query: str):
    """Leave it as it is."""
    pass
