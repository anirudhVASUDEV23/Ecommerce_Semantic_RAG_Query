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

    # ── Pinecone (FAQ Vector Store) ──────────────────────────────────────────
    PINECONE_API_KEY: str
    PINECONE_INDEX_NAME: str = "faqembeddings"
    PINECONE_INDEX_HOST: str = "https://faqembeddings-noqswio.svc.aped-4627-b74a.pinecone.io"


settings = Settings()
