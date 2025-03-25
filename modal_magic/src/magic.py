import os
from io import BytesIO
from PIL import Image
import requests
import torch
from diffusers import AutoPipelineForImage2Image, StableDiffusionXLPipeline

class SDXLModel:
    def __init__(self):
        # Initialize text-to-image pipeline
        self.txt2img_pipe = StableDiffusionXLPipeline.from_pretrained(
            "stabilityai/stable-diffusion-xl-base-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
            use_safetensors=True
        ).to("cuda")
        
        # Initialize image-to-image pipeline
        self.img2img_pipe = AutoPipelineForImage2Image.from_pretrained(
            "stabilityai/stable-diffusion-xl-refiner-1.0",
            torch_dtype=torch.float16,
            variant="fp16",
            use_safetensors=True
        ).to("cuda")

        # Enable optimizations
        for pipe in [self.txt2img_pipe, self.img2img_pipe]:
            pipe.enable_model_cpu_offload()
            # Enable xformers if not using PyTorch 2.0
            if not torch.__version__.startswith("2"):
                pipe.enable_xformers_memory_efficient_attention()

    def inference(self, prompt: str, negative_prompt: str = None, steps: int = 30) -> bytes:
        """Generate an image from text prompt"""
        print("Generating image...")
        with torch.no_grad():
            image = self.txt2img_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                num_inference_steps=steps,
                output_type="pil",
            ).images[0]

        byte_stream = BytesIO()
        image.save(byte_stream, format="JPEG")
        return byte_stream.getvalue()

    def style_transfer(
        self, 
        image_url: str, 
        prompt: str, 
        negative_prompt: str = None,
        steps: int = 30, 
        strength: float = 0.7,
        guidance_scale: float = 7.5
    ) -> bytes:
        """Apply style transfer to an input image"""
        print("Loading input image...")
        if image_url.startswith(('http://', 'https://')):
            print("Downloading input image from URL...")
            response = requests.get(image_url)
            init_image = Image.open(BytesIO(response.content))
        else:
            print("Loading input image from local file...")
            init_image = Image.open(image_url)
        
        print("Applying style transfer...")
        with torch.no_grad():
            image = self.img2img_pipe(
                prompt=prompt,
                negative_prompt=negative_prompt,
                image=init_image,
                num_inference_steps=steps,
                strength=strength,
                guidance_scale=guidance_scale,
                output_type="pil",
            ).images[0]

        byte_stream = BytesIO()
        image.save(byte_stream, format="JPEG")
        return byte_stream.getvalue()

if __name__ == "__main__":
    # Reset CUDA memory before loading the model
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.reset_peak_memory_stats()
        print("CUDA memory has been reset")
    else:
        print("CUDA is not available")
    
    os.makedirs("img/img_out", exist_ok=True)
    
    model = SDXLModel()
    
    # Example usage
image_bytes = model.style_transfer(
    "img/img_in/bar1.jpg",
    prompt="van gogh style",
    negative_prompt="ugly, blurry, bad quality",
    steps=50,
    strength=0.5
)

with open("img/img_out/styled_image.jpg", "wb") as f:
    f.write(image_bytes)
print("Image saved to img/img_out/styled_image.jpg")
