import hashlib
import hmac
import json
from datetime import UTC, datetime
from urllib.parse import parse_qsl

from fastapi import HTTPException, status


def verify_telegram_init_data(init_data: str, bot_token: str, max_age_seconds: int) -> dict:
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)

    if not received_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing initData hash")

    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items(), key=lambda item: item[0]))
    secret_key = hmac.new(b"WebAppData", bot_token.encode("utf-8"), hashlib.sha256).digest()
    calculated_hash = hmac.new(secret_key, data_check_string.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram initData hash")

    auth_date_raw = pairs.get("auth_date")
    if not auth_date_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing auth_date")

    auth_date = datetime.fromtimestamp(int(auth_date_raw), tz=UTC)
    age_seconds = (datetime.now(UTC) - auth_date).total_seconds()
    if age_seconds > max_age_seconds:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Telegram auth data expired")

    user_raw = pairs.get("user")
    if not user_raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Telegram user payload")

    try:
        return json.loads(user_raw)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Telegram user payload") from exc
