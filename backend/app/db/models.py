import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.db.session import Base

def generate_uuid():
    return str(uuid.uuid4())

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    username = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Quan hệ liên kết (Mối quan hệ 1 - Nhiều)
    sessions = relationship("ChatSession", back_populates="user", cascade="all, delete-orphan")
    images = relationship("ImageRecord", back_populates="user", cascade="all, delete-orphan")

class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan")

class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    session_id = Column(String(36), ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(20), nullable=False)  # "user" hoặc "assistant"
    content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)  # Có giá trị nếu bot trả về ảnh kết quả
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")

class ImageRecord(Base):
    __tablename__ = "image_records"

    id = Column(String(36), primary_key=True, default=generate_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    original_url = Column(String(500), nullable=True)
    mask_url = Column(String(500), nullable=True)
    result_url = Column(String(500), nullable=True)
    prompt = Column(Text, nullable=True)
    mode = Column(String(50), nullable=False)  # "inpaint" hoặc "txt2img"
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="images")
