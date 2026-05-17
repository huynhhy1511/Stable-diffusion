def build_txt2img_workflow(prompt: str, negative_prompt: str, width: int = 512, height: int = 512, seed: int = 42, model_name: str = "v1-5-pruned-emaonly.safetensors", steps: int = 20, cfg: float = 7.0):
    """Tạo payload JSON của ComfyUI cho Text-to-Image"""
    workflow = {
        "3": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model_name}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_prompt, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "txt2img", "images": ["8", 0]}}
    }
    return workflow

def build_inpaint_workflow(prompt: str, negative_prompt: str, base_image_name: str, mask_image_name: str, seed: int = 42, model_name: str = "v1-5-pruned-emaonly.safetensors", steps: int = 25, cfg: float = 7.5):
    """Tạo payload JSON của ComfyUI cho chức năng Inpainting"""
    workflow = {
        "3": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 0.85, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["10", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": model_name}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_prompt, "clip": ["4", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "inpaint", "images": ["8", 0]}},
        "10": {"class_type": "VAEEncodeForInpaint", "inputs": {"grow_mask_by": 6, "pixels": ["11", 0], "vae": ["4", 2], "mask": ["12", 0]}},
        "11": {"class_type": "LoadImage", "inputs": {"image": base_image_name, "upload": "image"}},
        "12": {"class_type": "LoadImage", "inputs": {"image": mask_image_name, "upload": "image"}}
    }
    return workflow
