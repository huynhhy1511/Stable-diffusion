from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str = "SUPER_SECRET_KEY_DONT_SHARE_1234567890_CREATIVE_STUDIO"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 600 # 10 tiếng
    DATABASE_URL: str = "sqlite:///./app_data.db"
    STORAGE_DIR: str = "../storage"

    class Config:
        env_file = ".env"

settings = Settings()
