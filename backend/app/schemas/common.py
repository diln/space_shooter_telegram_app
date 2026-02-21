from datetime import datetime

from pydantic import BaseModel

from app.models.enums import Difficulty, JoinRequestStatus, UserStatus


class UserOut(BaseModel):
    id: int
    telegram_id: int
    username: str | None
    first_name: str
    last_name: str | None
    photo_url: str | None
    status: UserStatus

    model_config = {"from_attributes": True}


class JoinRequestOut(BaseModel):
    id: int
    user_id: int
    status: JoinRequestStatus
    comment: str | None
    decision_reason: str | None
    decided_by_admin_tg_id: int | None
    created_at: datetime
    decided_at: datetime | None

    model_config = {"from_attributes": True}


class ScoreOut(BaseModel):
    id: int
    user_id: int
    difficulty: Difficulty
    score: int
    created_at: datetime

    model_config = {"from_attributes": True}
