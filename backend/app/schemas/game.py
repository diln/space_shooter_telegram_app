from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import Difficulty


class ScoreCreate(BaseModel):
    difficulty: Difficulty
    score: int = Field(ge=0, le=1000000)


class LeaderboardEntry(BaseModel):
    user_id: int
    telegram_id: int
    username: str | None
    first_name: str
    score: int
    achieved_at: datetime
