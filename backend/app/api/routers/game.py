from sqlalchemy import and_, desc, func, select
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.permissions import require_approved_user
from app.db.session import get_db
from app.models.enums import Difficulty, UserStatus
from app.models.score import Score
from app.models.user import User
from app.schemas.access import OkResponse
from app.schemas.game import LeaderboardEntry, ScoreCreate

router = APIRouter(prefix="/game", tags=["game"])


@router.post("/score", response_model=OkResponse)
def submit_score(
    payload: ScoreCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_user),
) -> OkResponse:
    db.add(Score(user_id=current_user.id, difficulty=payload.difficulty, score=payload.score))
    db.commit()
    return OkResponse(ok=True)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def get_leaderboard(
    difficulty: Difficulty = Query(default=Difficulty.EASY),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approved_user),
) -> list[LeaderboardEntry]:
    del current_user

    ranked_scores = (
        select(
            Score.user_id,
            func.max(Score.score).label("best_score"),
        )
        .join(User, User.id == Score.user_id)
        .where(and_(Score.difficulty == difficulty, User.status == UserStatus.APPROVED))
        .group_by(Score.user_id)
        .subquery()
    )

    query = (
        select(
            User.id,
            User.telegram_id,
            User.username,
            User.first_name,
            ranked_scores.c.best_score,
            func.max(Score.created_at).label("achieved_at"),
        )
        .join(ranked_scores, ranked_scores.c.user_id == User.id)
        .join(Score, and_(Score.user_id == User.id, Score.score == ranked_scores.c.best_score, Score.difficulty == difficulty))
        .group_by(User.id, User.telegram_id, User.username, User.first_name, ranked_scores.c.best_score)
        .order_by(desc(ranked_scores.c.best_score), User.id)
        .limit(10)
    )

    result = db.execute(query).all()

    return [
        LeaderboardEntry(
            user_id=row.id,
            telegram_id=row.telegram_id,
            username=row.username,
            first_name=row.first_name,
            score=int(row.best_score),
            achieved_at=row.achieved_at,
        )
        for row in result
    ]
