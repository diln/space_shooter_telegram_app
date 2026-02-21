from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.core.config import Settings, get_settings
from app.models.enums import UserStatus
from app.models.user import User



def require_approved_user(current_user: User = Depends(get_current_user)) -> User:
    if current_user.status != UserStatus.APPROVED:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User is not approved")
    return current_user



def require_admin_user(
    current_user: User = Depends(get_current_user), settings: Settings = Depends(get_settings)
) -> User:
    if current_user.telegram_id not in settings.admin_telegram_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
