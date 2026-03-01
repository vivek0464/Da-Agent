import asyncio
from fastapi import Header, HTTPException, status
from app.firebase_admin import get_auth


async def get_current_user(authorization: str = Header(None)) -> dict:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    token = authorization.split(" ", 1)[1]
    try:
        decoded = await asyncio.to_thread(get_auth().verify_id_token, token)
        return decoded
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(exc)}",
        ) from exc


async def require_auth(authorization: str = Header(None)) -> dict:
    return await get_current_user(authorization)


async def require_platform_admin(authorization: str = Header(None)) -> dict:
    user = await get_current_user(authorization)
    if not user.get("platform_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform admin access required",
        )
    return user
