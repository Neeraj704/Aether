import uuid
from typing import Optional, Any
from cryptography.fernet import Fernet
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..db.models import UserProviderKeyModel

_DEFAULT_PLACEHOLDER_KEY = b"ZYmI28CQ19dgT9znLtpYlnyK2XYET-8hvHC8ZcdE6bE="

def _get_fernet() -> Fernet:
    raw_key = (settings.BYOK_ENCRYPTION_KEY or "").strip()
    if not raw_key:
        key_bytes = _DEFAULT_PLACEHOLDER_KEY
    else:
        try:
            key_bytes = raw_key.encode("utf-8")
            # Test validity
            Fernet(key_bytes)
        except Exception:
            key_bytes = _DEFAULT_PLACEHOLDER_KEY
    return Fernet(key_bytes)

def encrypt_key(plaintext: str) -> str:
    """
    Encrypts an API key string using Fernet symmetric encryption.
    """
    if not plaintext:
        return ""
    f = _get_fernet()
    encrypted_bytes = f.encrypt(plaintext.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")

def decrypt_key(ciphertext: str) -> str:
    """
    Decrypts an encrypted API key ciphertext string.
    """
    if not ciphertext:
        return ""
    f = _get_fernet()
    decrypted_bytes = f.decrypt(ciphertext.encode("utf-8"))
    return decrypted_bytes.decode("utf-8")

async def resolve_byok_key(
    user_id: Any,
    provider_id: str,
    db: Optional[AsyncSession],
) -> Optional[str]:
    """
    Resolves and decrypts a user's stored custom API key for a given provider from user_provider_keys.
    Returns None if no stored key exists or if decryption fails.
    """
    if not user_id or not provider_id or db is None:
        return None

    try:
        user_uuid = uuid.UUID(str(user_id)) if not isinstance(user_id, uuid.UUID) else user_id
    except Exception:
        return None

    try:
        stmt = select(UserProviderKeyModel).where(
            UserProviderKeyModel.user_id == user_uuid,
            UserProviderKeyModel.provider_id == provider_id,
        )
        res = await db.execute(stmt)
        record = res.scalars().first()
        if not record or not record.encrypted_key:
            return None

        return decrypt_key(record.encrypted_key)
    except Exception as e:
        print(f"[KeyVault] Error resolving BYOK key for user {user_id}, provider {provider_id}: {e}")
        return None
