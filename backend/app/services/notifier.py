import logging

import httpx

from app.core.config import Settings
from app.models.join_request import JoinRequest
from app.models.user import User

logger = logging.getLogger(__name__)


def notify_admins_about_request(settings: Settings, user: User, join_request: JoinRequest) -> None:
    if not settings.bot_internal_token:
        return

    payload = {
        "request_id": join_request.id,
        "telegram_id": user.telegram_id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "comment": join_request.comment,
    }

    try:
        response = httpx.post(
            f"{settings.bot_internal_url}/internal/new-request",
            json=payload,
            headers={"X-Internal-Token": settings.bot_internal_token},
            timeout=5.0,
        )
        response.raise_for_status()
    except Exception as exc:
        logger.warning("Failed to notify bot service: %s", exc)
