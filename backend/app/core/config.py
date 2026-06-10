from __future__ import annotations

from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://orbital:orbital@localhost:5432/orbitalwatch"
    )
    REDIS_URL: str = Field(default="redis://localhost:6379/0")
    CORS_ORIGINS: List[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)


settings = Settings()
