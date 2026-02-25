from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=Path(__file__).parent / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    GROQ_API_KEY: str
    GROQ_MODEL: str
    CHROMA_DB_PATH: str = str(Path(__file__).parent / "chroma_db")


settings = Settings()
