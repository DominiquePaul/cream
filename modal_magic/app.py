import time
from io import BytesIO
from pathlib import Path
from PIL import Image
import requests
from fastapi import FastAPI
from fastapi.responses import Response
import modal
import torch
import diffusers

from magic import Model

diffusers_commit_sha = "81cf3b2f155f1de322079af28f625349ee21ec6b"

cuda_dev_image = modal.Image.from_registry(
    "nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.11"
).entrypoint([])

flux_image = (
    cuda_dev_image.apt_install(
        "git",
        "libglib2.0-0",
        "libsm6",
        "libxrender1",
        "libxext6",
        "ffmpeg",
        "libgl1",
    )
    .pip_install(
        "invisible_watermark==0.2.0",
        "transformers==4.44.0",
        "huggingface_hub[hf_transfer]==0.26.2",
        "accelerate==0.33.0",
        "safetensors==0.4.4",
        "sentencepiece==0.2.0",
        "torch==2.5.0",
        f"git+https://github.com/huggingface/diffusers.git@{diffusers_commit_sha}",
        "numpy<2",
        "fastapi==0.109.0",
        "uvicorn==0.27.0",
    )
    .env({
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "HF_HOME": "/root/.cache/huggingface/transformers"
    })
)

app = modal.App("flux", image=flux_image)
web_app = FastAPI()

@app.cls(gpu="H100", timeout=3600, secrets=[modal.Secret.from_name("huggingface")])
class ModalModel:
    @modal.enter()
    def enter(self):
        pipe = diffusers.FluxPipeline.from_pretrained(
            "black-forest-labs/FLUX.1-dev", torch_dtype=torch.bfloat16
        ).to("cuda")
        self.model = Model(pipe)

    @modal.method()
    def inference(self, prompt: str) -> bytes:
        return self.model.inference(prompt)

    @modal.method()
    def style_transfer(self, image_url: str, prompt: str) -> bytes:
        return self.model.style_transfer(image_url, prompt)

@web_app.post("/generate")
async def generate_image(prompt: str):
    image_bytes = ModalModel().inference.remote(prompt)
    return Response(content=image_bytes, media_type="image/jpeg")

@web_app.post("/style-transfer")
async def style_transfer_endpoint(image_url: str, prompt: str):
    image_bytes = ModalModel().style_transfer.remote(image_url, prompt)
    return Response(content=image_bytes, media_type="image/jpeg")

@app.serve(name="flux-api")
def serve():
    return web_app