from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.security import create_session_token
from app.db.session import get_db
from app.models.enums import UserStatus
from app.models.user import User
from app.schemas.auth import TelegramAuthRequest, TelegramAuthResponse
from app.schemas.common import UserOut
from app.services.telegram_webapp import verify_telegram_init_data

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/telegram", response_model=TelegramAuthResponse)
def auth_telegram(
    payload: TelegramAuthRequest,
    response: Response,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> TelegramAuthResponse:
    tg_user = verify_telegram_init_data(payload.initData, settings.bot_token, settings.webapp_auth_max_age_seconds)

    telegram_id = tg_user["id"]
    user = db.scalar(select(User).where(User.telegram_id == telegram_id))

    if user is None:
        user = User(
            telegram_id=telegram_id,
            username=tg_user.get("username"),
            first_name=tg_user.get("first_name", "Unknown"),
            last_name=tg_user.get("last_name"),
            photo_url=tg_user.get("photo_url"),
            status=UserStatus.NEW,
        )
        db.add(user)
    else:
        user.username = tg_user.get("username")
        user.first_name = tg_user.get("first_name", user.first_name)
        user.last_name = tg_user.get("last_name")
        user.photo_url = tg_user.get("photo_url")

    db.commit()
    db.refresh(user)

    token = create_session_token(user.id, user.telegram_id)

    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        max_age=settings.jwt_expire_hours * 3600,
        path="/",
    )

    return TelegramAuthResponse(
        user=UserOut.model_validate(user),
        status=user.status,
        is_admin=user.telegram_id in settings.admin_telegram_ids,
    )
