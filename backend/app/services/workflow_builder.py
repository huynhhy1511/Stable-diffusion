from deep_translator import GoogleTranslator

def translate_prompt(prompt: str) -> str:
    try:
        # Automatically translate prompt to English
        translated = GoogleTranslator(source='auto', target='en').translate(prompt)
        print("[Translation] Prompt translated successfully")
        return translated
    except Exception as e:
        print("[Translation Error] Could not translate prompt")
        return prompt

def build_txt2img_workflow(prompt: str, negative_prompt: str, width: int = 512, height: int = 512, seed: int = 42, model_name: str = "my_model.safetensors", steps: int = 20, cfg: float = 7.0):
    """Tạo payload JSON của ComfyUI cho Text-to-Image"""
    english_prompt = translate_prompt(prompt)
    
    # Bản đồ an toàn học thuật: my_model.safetensors là LoRA, cần chạy trên Base Checkpoint dreamshaper_8
    if model_name == "my_model.safetensors":
        base_ckpt = "dreamshaper_8.safetensors"
        lora_strength = 1.0
    else:
        base_ckpt = model_name
        lora_strength = 0.0

    workflow = {
        "3": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": 1.0, "model": ["10", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": base_ckpt}},
        "5": {"class_type": "EmptyLatentImage", "inputs": {"width": width, "height": height, "batch_size": 1}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": english_prompt, "clip": ["10", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_prompt, "clip": ["10", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "txt2img", "images": ["8", 0]}},
        "10": {"class_type": "LoraLoader", "inputs": {"model": ["4", 0], "clip": ["4", 1], "lora_name": "my_model.safetensors", "strength_model": lora_strength, "strength_clip": lora_strength}}
    }
    return workflow

def build_inpaint_workflow(prompt: str, negative_prompt: str, base_image_name: str, mask_image_name: str, seed: int = 42, model_name: str = "my_model.safetensors", steps: int = 25, cfg: float = 7.5, denoise: float = 0.85):
    """Tạo payload JSON của ComfyUI cho chức năng Inpainting"""
    english_prompt = translate_prompt(prompt)
    
    # Bản đồ an toàn học thuật: my_model.safetensors là LoRA, cần chạy trên Base Checkpoint dreamshaper_8
    if model_name == "my_model.safetensors":
        base_ckpt = "dreamshaper_8.safetensors"
        lora_strength = 1.0
    else:
        base_ckpt = model_name
        lora_strength = 0.0

    workflow = {
        "3": {"class_type": "KSampler", "inputs": {"seed": seed, "steps": steps, "cfg": cfg, "sampler_name": "euler_ancestral", "scheduler": "normal", "denoise": denoise, "model": ["15", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["14", 0]}},
        "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": base_ckpt}},
        "6": {"class_type": "CLIPTextEncode", "inputs": {"text": english_prompt, "clip": ["15", 1]}},
        "7": {"class_type": "CLIPTextEncode", "inputs": {"text": negative_prompt, "clip": ["15", 1]}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "inpaint", "images": ["8", 0]}},
        "10": {"class_type": "VAEEncode", "inputs": {"pixels": ["11", 0], "vae": ["4", 2]}},
        "11": {"class_type": "LoadImage", "inputs": {"image": base_image_name, "upload": "image"}},
        "12": {"class_type": "LoadImage", "inputs": {"image": mask_image_name, "upload": "image"}},
        "13": {"class_type": "ImageToMask", "inputs": {"image": ["12", 0], "channel": "red"}},
        "14": {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["10", 0], "mask": ["13", 0]}},
        "15": {"class_type": "LoraLoader", "inputs": {"model": ["4", 0], "clip": ["4", 1], "lora_name": "my_model.safetensors", "strength_model": lora_strength, "strength_clip": lora_strength}}
    }
    return workflow

