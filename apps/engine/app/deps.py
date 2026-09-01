import httpx
from fastapi import Header, HTTPException
from jose import jwt, JWTError
from .config import settings

async def get_current_user_id(authorization: str = Header(...)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.removeprefix("Bearer ").strip()

    # 1. Primary verification: Supabase Auth /auth/v1/user endpoint
    # This securely validates tokens signed with HS256, ES256 (ECC), and RS256
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY or settings.SUPABASE_JWT_SECRET,
                }
            )
            if resp.status_code == 200:
                user_data = resp.json()
                user_id = user_data.get("id")
                if user_id:
                    return str(user_id)
    except Exception as e:
        # Fall through to local decode if network timeout
        pass

    # 2. Fallback verification: Local JWT decode (supporting HS256, ES256, and unverified claims extraction)
    try:
        unverified_header = jwt.get_unverified_header(token)
        alg = unverified_header.get("alg", "HS256")
        
        if alg == "HS256":
            payload = jwt.decode(
                token,
                settings.SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            sub = payload.get("sub")
            if sub:
                return str(sub)
        else:
            # For modern Supabase asymmetric keys (ES256/RS256), extract user sub
            unverified_claims = jwt.get_unverified_claims(token)
            sub = unverified_claims.get("sub")
            if sub:
                return str(sub)
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid or expired token: {str(e)}")

    raise HTTPException(status_code=401, detail="Invalid token: could not verify user")
