from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.models.enums import JoinRequestStatus, UserStatus
from app.models.join_request import JoinRequest
from app.models.user import User
from app.schemas.access import AccessRequestCreate, AccessRequestInfo, AccessStatusResponse, OkResponse
from app.services.notifier import notify_admins_about_request

router = APIRouter(prefix="/access", tags=["access"])


@router.get("/status", response_model=AccessStatusResponse)
def get_access_status(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> AccessStatusResponse:
    latest_request = db.scalar(
        select(JoinRequest)
        .where(JoinRequest.user_id == current_user.id)
        .order_by(desc(JoinRequest.created_at), desc(JoinRequest.id))
        .limit(1)
    )

    request_info = None
    if latest_request is not None:
        request_info = AccessRequestInfo(
            id=latest_request.id,
            status=latest_request.status,
            comment=latest_request.comment,
            decision_reason=latest_request.decision_reason,
        )

    return AccessStatusResponse(status=current_user.status, request=request_info)


@router.post("/request", response_model=OkResponse)
def create_access_request(
    payload: AccessRequestCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    settings: Settings = Depends(get_settings),
) -> OkResponse:
    if current_user.status == UserStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already approved")

    pending_request = db.scalar(
        select(JoinRequest)
        .where(JoinRequest.user_id == current_user.id, JoinRequest.status == JoinRequestStatus.PENDING)
        .limit(1)
    )
    if pending_request:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Pending request already exists")

    join_request = JoinRequest(
        user_id=current_user.id,
        status=JoinRequestStatus.PENDING,
        comment=payload.comment,
    )
    db.add(join_request)

    current_user.status = UserStatus.REQUESTED

    db.commit()
    db.refresh(join_request)
    db.refresh(current_user)

    notify_admins_about_request(settings, current_user, join_request)

    return OkResponse(ok=True)
