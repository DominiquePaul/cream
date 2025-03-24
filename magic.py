from io import BytesIO
from PIL import Image
import requests
import torch
import diffusers

class Model:
    def __init__(self, pipe):
        self.pipe = pipe

    def inference(self, prompt: str) -> bytes:
        print("Generating image...")
        image = self.pipe(
            prompt,
            output_type="pil",
            num_inference_steps=4,
        ).images[0]

        byte_stream = BytesIO()
        image.save(byte_stream, format="JPEG")
        return byte_stream.getvalue()

    def style_transfer(self, image_url: str, prompt: str) -> bytes:
        print("Downloading input image...")
        response = requests.get(image_url)
        init_image = Image.open(BytesIO(response.content))
        
        print("Applying style transfer...")
        image = self.pipe(
            prompt,
            image=init_image,
            output_type="pil",
            num_inference_steps=4,
            strength=0.75,
        ).images[0]

        byte_stream = BytesIO()
        image.save(byte_stream, format="JPEG")
        return byte_stream.getvalue() 
    

if __name__ == "__main__":
    pipe = diffusers.FluxPipeline.from_pretrained(
        "black-forest-labs/FLUX.1-dev", torch_dtype=torch.bfloat16
    ).to("cuda")
    model = Model(pipe)
    print(model.inference("A beautiful landscape with a river and mountains"))
