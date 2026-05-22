import os
from PIL import Image

# Đưa các thư viện nặng vào khối try-except để tránh làm sập khởi động FastAPI (Uvicorn) 
# khi các thư viện này chưa cài đặt xong trong môi trường ảo.
try:
    import torch
    import numpy as np
    from mobile_sam import sam_model_registry, SamPredictor
except ImportError:
    torch = None
    np = None
    SamPredictor = None

class MobileSAMService:
    """
    Dịch vụ lấy Mask ảnh dựa trên điểm Click của người dùng.
    MobileSAM cực kỳ nhẹ nên ta sẽ ép model này chạy hoàn toàn trên CPU, 
    nhường toàn bộ tài nguyên VRAM (4GB) cho Stable Diffusion.
    """
    def __init__(self):
        # Ép CPU để cứu VRAM theo yêu cầu
        self.device = "cpu" 
        self.predictor = None
        
    def load_model(self):
        if SamPredictor is None or torch is None or np is None:
            print("[WARNING] torch, numpy, or mobile-sam is not fully installed!")
            return
            
        model_type = "vit_t"
        sam_checkpoint = "../models/sam/mobile_sam.pt" # Đường dẫn model weight đã chuẩn bị sẵn
        
        if not os.path.exists(sam_checkpoint):
            print(f"[WARNING] SAM model weights not found at {sam_checkpoint}")
            return
            
        mobile_sam = sam_model_registry[model_type](checkpoint=sam_checkpoint)
        mobile_sam.to(device=self.device)
        mobile_sam.eval()
        self.predictor = SamPredictor(mobile_sam)
        print("Loaded MobileSAM on CPU successfully!")

    def segment(self, image_path: str, x: int, y: int, level: str = "coarse") -> Image.Image:
        # Nếu chưa cài đặt đủ thư viện nặng, trả về Mock Mask để chạy thử giao diện
        if SamPredictor is None or torch is None or np is None:
            print("Bypass SAM (Mocking mode due to missing torch/numpy/mobile-sam).")
            return Image.new('L', (512, 512), 0)

        if not self.predictor:
            self.load_model()
            if not self.predictor:
                print("Mocking Mask because model weights could not be loaded.")
                return Image.new('L', (512, 512), 0)
                
        image = Image.open(image_path).convert("RGB")
        image_array = np.array(image)
        
        # Load ảnh vào predictor
        self.predictor.set_image(image_array)
        
        # Tạo dữ liệu tọa độ
        input_point = np.array([[x, y]])
        input_label = np.array([1]) # Điểm click (foreground)
        
        masks, scores, logits = self.predictor.predict(
            point_coords=input_point,
            point_labels=input_label,
            multimask_output=True, # Dự đoán đa cấp độ (chi tiết, bộ phận, toàn bộ)
        )
        
        # Chọn mask theo cấp độ người dùng yêu cầu
        if level == "fine":
            mask = masks[0]
        elif level == "medium":
            mask = masks[1]
        else: # coarse
            # Sắp xếp các mask theo diện tích tăng dần và lấy lớn nhất
            sorted_masks = sorted(masks, key=lambda m: np.sum(m))
            mask = sorted_masks[-1]
            
        mask_image_array = (mask * 255).astype(np.uint8)
        mask_image = Image.fromarray(mask_image_array, mode='L')
        
        return mask_image

# Khởi tạo singleton service
sam_service = MobileSAMService()
