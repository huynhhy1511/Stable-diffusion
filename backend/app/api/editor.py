from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, File, UploadFile, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
import uuid
import asyncio

from app.db.session import get_db, SessionLocal
from app.db.models import User, ImageRecord
from app.api.auth import get_current_user
from app.services.comfy_client import ComfyUIClient
from app.services.workflow_builder import build_inpaint_workflow
from app.services.sam_service import sam_service

router = APIRouter(prefix="/api/editor", tags=["AI Canvas Editor"])

comfy_client = ComfyUIClient(server_address="127.0.0.1:8188")
STORAGE_DIR = "../storage"

# Chia sẻ active_jobs cho websocket
active_jobs = {}

class InpaintRequest(BaseModel):
    original_url: str
    mask_url: str
    prompt: str

# Tác vụ ngầm xử lý inpainting qua ComfyUI và ghi lại lịch sử vào SQLite
async def inpaint_generate_task(job_id: str, original_url: str, mask_url: str, prompt: str, db_session_maker, user_id: str):
    queue = active_jobs.get(job_id)
    if not queue: return

    try:
        # Tách tên file từ URL (định dạng http://127.0.0.1:8000/api/uploads/xxx.png)
        orig_filename = original_url.split("/")[-1]
        mask_filename = mask_url.split("/")[-1]
        
        # Bước 1: Khởi dựng workflow Inpainting
        workflow = build_inpaint_workflow(
            prompt=prompt,
            negative_prompt="blurry, bad anatomy, bad hands, low quality, watermark",
            base_image_name=orig_filename,
            mask_image_name=mask_filename
        )
        
        # Bước 2: Sinh ảnh và lắng nghe tiến trình
        output_images = await comfy_client.generate_and_wait(workflow, progress_queue=queue)
        
        if output_images:
            output_filename = f"{job_id}.png"
            output_path = f"{STORAGE_DIR}/outputs/{output_filename}"
            with open(output_path, "wb") as f:
                f.write(output_images[0])
                
            result_url = f"http://127.0.0.1:8000/api/images/{output_filename}"
            
            # Bước 3: Ghi nhận lịch sử chỉnh sửa ảnh vào SQLite Database
            db = db_session_maker()
            try:
                record = ImageRecord(
                    user_id=user_id,
                    original_url=original_url,
                    mask_url=mask_url,
                    result_url=result_url,
                    prompt=prompt,
                    mode="inpaint"
                )
                db.add(record)
                db.commit()
            finally:
                db.close()
                
            # Báo kết quả cho Front-end
            await queue.put({
                "type": "done",
                "job_id": job_id,
                "image_url": result_url
            })
        else:
            raise Exception("ComfyUI không trả về dữ liệu ảnh đã inpaint.")
            
    except Exception as e:
        await queue.put({"type": "error", "message": str(e), "job_id": job_id})

@router.post("/sam/segment")
async def sam_segment(
    image: UploadFile = File(...), 
    x: int = Form(...), 
    y: int = Form(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Tiếp nhận ảnh gốc từ FE, chạy bóc lớp SAM trên CPU, trả về ảnh mặt nạ"""
    job_id = str(uuid.uuid4())
    upload_path = f"{STORAGE_DIR}/uploads/{job_id}.png"
    
    # 1. Lưu ảnh gốc
    with open(upload_path, "wb") as f:
        f.write(await image.read())
        
    # 2. Xử lý lấy Mask từ SAM (chạy CPU cực an toàn, nhường GPU)
    mask_image = sam_service.segment(upload_path, x, y)
    
    mask_path = f"{STORAGE_DIR}/masks/{job_id}_mask.png"
    mask_image.save(mask_path)
    
    original_url = f"http://127.0.0.1:8000/api/uploads/{job_id}.png"
    mask_url = f"http://127.0.0.1:8000/api/masks/{job_id}_mask.png"
    
    # Ghi nhận log khởi đầu của chỉnh sửa
    record = ImageRecord(
        user_id=current_user.id,
        original_url=original_url,
        mask_url=mask_url,
        mode="mask"
    )
    db.add(record)
    db.commit()
    
    return {
        "job_id": job_id,
        "mask_url": mask_url,
        "original_url": original_url
    }

@router.post("/inpaint")
def inpaint(
    req: InpaintRequest, 
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    """Tiếp nhận request Inpaint, đẩy vào hàng đợi background"""
    job_id = str(uuid.uuid4())
    active_jobs[job_id] = asyncio.Queue()
    
    # Đẩy tác vụ chạy ngầm luồng độc lập
    background_tasks.add_task(
        inpaint_generate_task, 
        job_id, 
        req.original_url, 
        req.mask_url, 
        req.prompt, 
        SessionLocal, 
        current_user.id
    )
    
    return {"job_id": job_id, "status": "pending"}

@router.get("/history")
def get_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Lấy danh sách các bức ảnh đã chỉnh sửa thành công của người dùng hiện tại"""
    records = db.query(ImageRecord).filter(
        ImageRecord.user_id == current_user.id,
        ImageRecord.result_url != None
    ).order_by(ImageRecord.created_at.desc()).all()
    return records
