import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.db.session import engine, Base
from app.api import auth, chat, editor
from app.api.chat import active_jobs as chat_jobs
from app.api.editor import active_jobs as editor_jobs

# Khởi động SQLite Tables nếu chưa tồn tại
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Professional AI Creative Studio API",
    description="Backend API cao cấp phân quyền người dùng, quản lý chat-bot sinh ảnh và chỉnh sửa ảnh bằng AI (SAM + SD)",
    version="2.0.0"
)

# Cấu hình CORS mở rộng cho cả localhost và IP loopback để tránh tuyệt đối lỗi CORS trên mọi trình duyệt
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đảm bảo các thư mục lưu trữ cục bộ luôn tồn tại
STORAGE_DIR = "../storage"
os.makedirs(f"{STORAGE_DIR}/uploads", exist_ok=True)
os.makedirs(f"{STORAGE_DIR}/outputs", exist_ok=True)
os.makedirs(f"{STORAGE_DIR}/masks", exist_ok=True)

# Mount các thư mục ảnh tĩnh để Frontend lấy về hiển thị qua URL trực tiếp
app.mount("/api/uploads", StaticFiles(directory=f"{STORAGE_DIR}/uploads"), name="uploads")
app.mount("/api/images", StaticFiles(directory=f"{STORAGE_DIR}/outputs"), name="outputs")
app.mount("/api/masks", StaticFiles(directory=f"{STORAGE_DIR}/masks"), name="masks")

# Đăng ký các Router tính năng
app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(editor.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "message": "Chào mừng bạn đến với Professional AI Creative Studio API v2.0",
        "engine": "ComfyUI + MobileSAM"
    }

# WebSocket hợp nhất lắng nghe tiến trình thời gian thực cho cả Chat và Editor
@app.websocket("/ws/progress/{job_id}")
async def websocket_progress(websocket: WebSocket, job_id: str):
    await websocket.accept()
    
    # Tìm kiếm hàng đợi của job tương ứng trong phân khu Chat hoặc Editor
    queue = chat_jobs.get(job_id) or editor_jobs.get(job_id)
    
    if not queue:
        await websocket.send_json({"type": "error", "message": "Mã Job ID không tồn tại hoặc đã hết hạn."})
        await websocket.close()
        return
        
    try:
        while True:
            # Chờ đợi dữ liệu tiến độ từ Background Task gửi vào Queue
            data = await queue.get()
            await websocket.send_json(data)
            
            # Kết thúc luồng WebSocket nếu nhận tín hiệu done hoặc error
            if data.get("type") in ["done", "error"]:
                break
    except WebSocketDisconnect:
        print(f"Người dùng đã ngắt kết nối WebSocket cho Job: {job_id}")
    finally:
        # Dọn dẹp RAM xóa queue đã hoàn thành
        if job_id in chat_jobs:
            chat_jobs.pop(job_id, None)
        if job_id in editor_jobs:
            editor_jobs.pop(job_id, None)
