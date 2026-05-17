from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import asyncio

from app.db.session import get_db, SessionLocal
from app.db.models import User, ChatSession, ChatMessage
from app.api.auth import get_current_user
from app.services.comfy_client import ComfyUIClient
from app.services.workflow_builder import build_txt2img_workflow

router = APIRouter(prefix="/api/chat", tags=["AI Chat Assistant"])

comfy_client = ComfyUIClient(server_address="127.0.0.1:8188")
STORAGE_DIR = "../storage"

# Chia sẻ luồng active_jobs với main.py để WebSockets có thể map progress
active_jobs = {}

class SessionCreate(BaseModel):
    title: str

class MessageSend(BaseModel):
    prompt: str

# Tác vụ chạy ngầm sinh ảnh trong Chat, lưu kết quả vào SQLite
async def chat_generate_task(job_id: str, session_id: str, prompt: str, db_session_maker, user_id: str):
    queue = active_jobs.get(job_id)
    if not queue: return

    try:
        # Bước 1: Build file JSON Workflow cho ComfyUI
        workflow = build_txt2img_workflow(prompt, negative_prompt="blurry, low quality, watermark, bad hands", width=512, height=512)
        
        # Bước 2: Gửi lên ComfyUI và đợi WebSocket phản hồi các bytes ảnh
        output_images = await comfy_client.generate_and_wait(workflow, progress_queue=queue)
        
        if output_images:
            output_filename = f"{job_id}.png"
            output_path = f"{STORAGE_DIR}/outputs/{output_filename}"
            with open(output_path, "wb") as f:
                f.write(output_images[0])
                
            image_url = f"http://127.0.0.1:8000/api/images/{output_filename}"
            
            # Bước 3: Lưu câu trả lời của Bot (Assistant) kèm URL ảnh kết quả vào SQLite
            db = db_session_maker()
            try:
                bot_message = ChatMessage(
                    session_id=session_id,
                    role="assistant",
                    content=f"Đã vẽ xong bức ảnh theo prompt của bạn: '{prompt}'",
                    image_url=image_url
                )
                db.add(bot_message)
                db.commit()
            finally:
                db.close()
                
            # Đẩy tín hiệu Hoàn Thành cho WebSocket phía React
            await queue.put({
                "type": "done",
                "job_id": job_id,
                "image_url": image_url
            })
        else:
            raise Exception("ComfyUI không phản hồi bất kỳ dữ liệu ảnh nào.")
            
    except Exception as e:
        await queue.put({"type": "error", "message": str(e), "job_id": job_id})

@router.get("/sessions")
def get_sessions(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lấy danh sách các cuộc hội thoại cũ của riêng người dùng này"""
    sessions = db.query(ChatSession).filter(ChatSession.user_id == current_user.id).order_by(ChatSession.created_at.desc()).all()
    return sessions

@router.post("/sessions")
def create_session(data: SessionCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Khởi tạo một cuộc hội thoại mới"""
    new_session = ChatSession(user_id=current_user.id, title=data.title)
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return new_session

@router.get("/sessions/{session_id}/messages")
def get_messages(session_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lấy toàn bộ tin nhắn trong một cuộc hội thoại (yêu cầu phân quyền sở hữu)"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên trò chuyện của bạn")
        
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    return messages

@router.post("/sessions/{session_id}/send")
def send_message(session_id: str, data: MessageSend, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """User gửi một prompt mới. Khởi động background task để sinh ảnh bằng SD"""
    session = db.query(ChatSession).filter(ChatSession.id == session_id, ChatSession.user_id == current_user.id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên trò chuyện")
        
    # 1. Lưu câu hỏi (Prompt) của User vào Database
    user_message = ChatMessage(session_id=session_id, role="user", content=data.prompt)
    db.add(user_message)
    db.commit()
    
    # 2. Khởi tạo Job Queue cho Websocket
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = asyncio.Queue()
    
    # 3. Đẩy tác vụ sinh ảnh chạy ngầm luồng độc lập, tránh nghẽn luồng chính FastAPI
    background_tasks.add_task(chat_generate_task, job_id, session_id, data.prompt, SessionLocal, current_user.id)
    
    return {"job_id": job_id, "status": "pending"}
