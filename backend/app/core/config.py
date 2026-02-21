from functools import lru_cache
from typing import Annotated, List

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", case_sensitive=False)

    app_name: str = "space-shooter-backend"
    environment: str = "development"

    database_url: str = "postgresql+psycopg2://app:app@postgres:5432/spaceapp"
    bot_token: str

    jwt_secret: str
    jwt_expire_hours: int = 24
    session_cookie_name: str = "space_session"
    session_cookie_secure: bool = False
    webapp_auth_max_age_seconds: int = 86400

    admin_telegram_ids: Annotated[List[int], NoDecode] = Field(default_factory=list)
    allowed_origins: Annotated[List[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:8080"])

    bot_internal_url: str = "http://bot:8081"
    bot_internal_token: str = ""
    mini_app_url: str = "http://localhost:8080"

    @field_validator("admin_telegram_ids", mode="before")
    @classmethod
    def parse_admin_ids(cls, value: str | List[int]) -> List[int]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [int(item.strip()) for item in value.split(",") if item.strip()]

    @field_validator("allowed_origins", mode="before")
    @classmethod
    def parse_allowed_origins(cls, value: str | List[str]) -> List[str]:
        if isinstance(value, list):
            return value
        if not value:
            return []
        return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
