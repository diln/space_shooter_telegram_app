from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.api.permissions import require_admin_user
from app.db.session import get_db
from app.models.enums import JoinRequestStatus, UserStatus
from app.models.join_request import JoinRequest
from app.models.user import User
from app.schemas.access import OkResponse
from app.schemas.admin import AdminDecisionRequest, AdminRequestItem, AdminUserItem

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/requests", response_model=list[AdminRequestItem])
def list_requests(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
) -> list[AdminRequestItem]:
    del admin_user

    rows = db.execute(
        select(JoinRequest, User)
        .join(User, User.id == JoinRequest.user_id)
        .order_by(desc(JoinRequest.created_at), desc(JoinRequest.id))
    ).all()

    return [
        AdminRequestItem(
            request_id=req.id,
            created_at=req.created_at,
            status=req.status,
            comment=req.comment,
            decision_reason=req.decision_reason,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
        )
        for req, user in rows
    ]


@router.post("/requests/{request_id}/approve", response_model=OkResponse)
def approve_request(
    request_id: int,
    payload: AdminDecisionRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
) -> OkResponse:
    req = db.scalar(select(JoinRequest).where(JoinRequest.id == request_id))
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != JoinRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already decided")

    user = db.scalar(select(User).where(User.id == req.user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    req.status = JoinRequestStatus.APPROVED
    req.decision_reason = payload.reason
    req.decided_by_admin_tg_id = admin_user.telegram_id
    req.decided_at = datetime.now(UTC)

    user.status = UserStatus.APPROVED

    db.commit()
    return OkResponse(ok=True)


@router.post("/requests/{request_id}/reject", response_model=OkResponse)
def reject_request(
    request_id: int,
    payload: AdminDecisionRequest,
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
) -> OkResponse:
    req = db.scalar(select(JoinRequest).where(JoinRequest.id == request_id))
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status != JoinRequestStatus.PENDING:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Request already decided")

    user = db.scalar(select(User).where(User.id == req.user_id))
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    req.status = JoinRequestStatus.REJECTED
    req.decision_reason = payload.reason
    req.decided_by_admin_tg_id = admin_user.telegram_id
    req.decided_at = datetime.now(UTC)

    user.status = UserStatus.REJECTED

    db.commit()
    return OkResponse(ok=True)


@router.get("/users", response_model=list[AdminUserItem])
def list_users(
    db: Session = Depends(get_db),
    admin_user: User = Depends(require_admin_user),
) -> list[AdminUserItem]:
    del admin_user

    users = db.scalars(select(User).order_by(desc(User.created_at))).all()
    return [
        AdminUserItem(
            id=user.id,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            status=user.status,
            created_at=user.created_at,
        )
        for user in users
    ]
