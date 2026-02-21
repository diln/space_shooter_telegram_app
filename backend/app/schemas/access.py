from pydantic import BaseModel, Field

from app.models.enums import JoinRequestStatus, UserStatus


class AccessRequestCreate(BaseModel):
    comment: str | None = Field(default=None, max_length=1024)


class AccessRequestInfo(BaseModel):
    id: int
    status: JoinRequestStatus
    comment: str | None
    decision_reason: str | None


class AccessStatusResponse(BaseModel):
    status: UserStatus
    request: AccessRequestInfo | None = None


class OkResponse(BaseModel):
    ok: bool = True
