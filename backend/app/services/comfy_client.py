import uuid
import json
import asyncio
import urllib.parse
from typing import Dict, Any, Optional, List
import websockets
import aiohttp

class ComfyUIClient:
    """
    Client tương tác với ComfyUI API. 
    Xử lý việc gửi Workflow JSON, theo dõi progress qua WebSocket, và lấy kết quả ảnh.
    ComfyUI quản lý VRAM cực kỳ tốt (tự động unload/load) nên việc giao tiếp qua API
    là phương án hoàn hảo để tránh OOM (Out-Of-Memory).
    """
    def __init__(self, server_address="127.0.0.1:8188"):
        self.server_address = server_address
        self.client_id = str(uuid.uuid4())

    async def get_image(self, filename: str, subfolder: str, folder_type: str) -> bytes:
        """Tải dữ liệu ảnh trả về từ ComfyUI"""
        data = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        url_values = urllib.parse.urlencode(data)
        url = f"http://{self.server_address}/view?{url_values}"
        
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.read()

    async def get_history(self, prompt_id: str) -> dict:
        """Lấy lịch sử workflow từ prompt_id để biết node nào đã lưu ảnh"""
        url = f"http://{self.server_address}/history/{prompt_id}"
        async with aiohttp.ClientSession() as session:
            async with session.get(url) as response:
                return await response.json()

    async def queue_prompt(self, prompt_workflow: Dict[str, Any]) -> str:
        """Gửi Workflow JSON lên ComfyUI queue"""
        payload = {"prompt": prompt_workflow, "client_id": self.client_id}
        url = f"http://{self.server_address}/prompt"
        
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                data = await response.json()
                return data['prompt_id']

    async def generate_and_wait(self, prompt_workflow: Dict[str, Any], progress_queue: Optional[asyncio.Queue] = None) -> List[bytes]:
        """
        Thực thi toàn bộ quá trình:
        1. Gửi JSON workflow.
        2. Mở kết nối WebSocket lắng nghe progress.
        3. Tải ảnh khi hoàn thành.
        """
        ws_url = f"ws://{self.server_address}/ws?clientId={self.client_id}"
        
        # Push workflow vào hàng đợi
        prompt_id = await self.queue_prompt(prompt_workflow)
        output_images = []
        
        # Mở Websocket để nghe ngóng tình trạng chạy model
        async with websockets.connect(ws_url) as websocket:
            while True:
                out = await websocket.recv()
                if isinstance(out, str):
                    message = json.loads(out)
                    msg_type = message.get('type')
                    data = message.get('data', {})

                    # Bắt tiến trình (progress bar)
                    if msg_type == 'progress':
                        if progress_queue:
                            await progress_queue.put({
                                "type": "progress",
                                "step": data.get('value', 0),
                                "total_steps": data.get('max', 100),
                            })

                    # Bắt sự kiện hoàn thành executing
                    if msg_type == 'executing':
                        if data.get('node') is None and data.get('prompt_id') == prompt_id:
                            break # Quá trình sinh ảnh kết thúc
                            
        # Khi xong, gọi API history để quét tìm file ảnh đã tạo
        history = await self.get_history(prompt_id)
        history_data = history.get(prompt_id, {})
        
        # Duyệt qua các Outputs (Thường là Node ID số 9 - SaveImage)
        for node_id, node_output in history_data.get('outputs', {}).items():
            if 'images' in node_output:
                for image in node_output['images']:
                    image_data = await self.get_image(image['filename'], image['subfolder'], image['type'])
                    output_images.append(image_data)

        return output_images
