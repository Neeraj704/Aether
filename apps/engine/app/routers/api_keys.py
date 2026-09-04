import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_current_user_id
from ..db.session import get_db
from ..db.models import UserProviderKeyModel
from ..llm.key_vault import encrypt_key

router = APIRouter(prefix="/account/provider-keys", tags=["Provider API Keys"])

class StoreProviderKeyPayload(BaseModel):
    providerId: str = Field(..., description="Provider identifier (e.g. groq, openai, anthropic, deepseek, google, alibaba)")
    apiKey: str = Field(..., min_length=1, description="Raw provider API secret key")

class ProviderKeyMeta(BaseModel):
    providerId: str
    hasKey: bool
    updatedAt: str

@router.post("", response_model=ProviderKeyMeta)
async def store_provider_key(
    payload: StoreProviderKeyPayload,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    provider_id = payload.providerId.strip().lower()
    raw_key = payload.apiKey.strip()
    if not provider_id:
        raise HTTPException(status_code=400, detail="providerId cannot be empty")
    if not raw_key:
        raise HTTPException(status_code=400, detail="apiKey cannot be empty")

    now = datetime.now(timezone.utc)
    enc_key = encrypt_key(raw_key)

    # Upsert in database
    res = await db.execute(
        select(UserProviderKeyModel).where(
            UserProviderKeyModel.user_id == user_uuid,
            UserProviderKeyModel.provider_id == provider_id,
        )
    )
    existing = res.scalars().first()
    if existing:
        existing.encrypted_key = enc_key
        existing.updated_at = now
    else:
        new_row = UserProviderKeyModel(
            user_id=user_uuid,
            provider_id=provider_id,
            encrypted_key=enc_key,
            created_at=now,
            updated_at=now,
        )
        db.add(new_row)

    await db.commit()

    return ProviderKeyMeta(
        providerId=provider_id,
        hasKey=True,
        updatedAt=now.isoformat(),
    )

@router.get("", response_model=List[ProviderKeyMeta])
async def list_provider_keys(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    res = await db.execute(
        select(UserProviderKeyModel).where(UserProviderKeyModel.user_id == user_uuid)
    )
    rows = res.scalars().all()

    return [
        ProviderKeyMeta(
            providerId=r.provider_id,
            hasKey=True,
            updatedAt=r.updated_at.isoformat() if r.updated_at else datetime.now(timezone.utc).isoformat(),
        )
        for r in rows
    ]

@router.delete("/{provider_id}", response_model=ProviderKeyMeta)
async def delete_provider_key(
    provider_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    try:
        user_uuid = uuid.UUID(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid user_id '{user_id}'")

    prov_clean = provider_id.strip().lower()
    await db.execute(
        delete(UserProviderKeyModel).where(
            UserProviderKeyModel.user_id == user_uuid,
            UserProviderKeyModel.provider_id == prov_clean,
        )
    )
    await db.commit()

    return ProviderKeyMeta(
        providerId=prov_clean,
        hasKey=False,
        updatedAt=datetime.now(timezone.utc).isoformat(),
    )
