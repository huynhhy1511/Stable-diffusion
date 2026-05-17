from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Kết nối SQLite cục bộ. Cờ check_same_thread=False là bắt buộc đối với SQLite trong FastAPI
engine = create_engine(
    settings.DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    """Dependency cung cấp session DB cho từng request FastAPI và tự động đóng khi hoàn thành"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
