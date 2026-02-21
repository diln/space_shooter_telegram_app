from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import JoinRequestStatus, UserStatus


class AdminDecisionRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=1024)


class AdminRequestItem(BaseModel):
    request_id: int
    created_at: datetime
    status: JoinRequestStatus
    comment: str | None
    decision_reason: str | None
    telegram_id: int
    username: str | None
    first_name: str
    last_name: str | None


class AdminUserItem(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    last_name: str | None
    status: UserStatus
    created_at: datetime
