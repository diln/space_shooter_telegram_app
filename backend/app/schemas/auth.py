from pydantic import BaseModel

from app.models.enums import UserStatus
from app.schemas.common import UserOut


class TelegramAuthRequest(BaseModel):
    initData: str


class TelegramAuthResponse(BaseModel):
    user: UserOut
    status: UserStatus
    is_admin: bool
