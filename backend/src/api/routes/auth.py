"""Authentication routes"""

from fastapi import APIRouter

router = APIRouter()


@router.post("/token")
async def get_token(api_key: str):
    """Leave it as is for now"""
    pass
