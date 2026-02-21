from datetime import UTC, datetime, timedelta
from typing import Any, Dict

from jose import JWTError, jwt

from app.core.config import get_settings

ALGORITHM = "HS256"


class TokenError(Exception):
    pass


def create_session_token(user_id: int, telegram_id: int) -> str:
    settings = get_settings()
    expire = datetime.now(UTC) + timedelta(hours=settings.jwt_expire_hours)
    payload: Dict[str, Any] = {
        "sub": str(user_id),
        "telegram_id": telegram_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)


def decode_session_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise TokenError("Invalid session token") from exc
