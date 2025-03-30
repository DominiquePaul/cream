import asyncio
import fire
from PIL import Image
import os
import sys
import io
from dotenv import load_dotenv

load_dotenv()

# Add the parent directory to path so we can import the lightning_diffusion module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from src.lightning_diffusion import apply_lightning_diffusion
from src.utils.logger import logger

async def generate_image(
    input_image_path: str,
    output_image_path: str,
    prompt: str,
    strength: float,
    steps: int,
    use_controlnet: bool
):
    """
    Generate an image using SDXL-Lightning model.
    
    Args:
        input_image_path: Path to input image
        output_image_path: Path to save output image
        prompt: Text prompt for image generation
        strength: Strength of transformation (0.0-1.0)
        steps: Number of diffusion steps (1, 2, 4, or 8 recommended)
        use_controlnet: Whether to use ControlNet for depth-guided generation
    """
    print(f"Input params: input={input_image_path}, output={output_image_path}, prompt='{prompt}', strength={strength}, steps={steps}, controlnet={use_controlnet}")
    input_image = Image.open(input_image_path)
    
    # Ensure the image is in RGB mode
    if input_image.mode != 'RGB':
        input_image = input_image.convert('RGB')
    
    # Convert PIL Image to bytes using BytesIO
    img_byte_arr = io.BytesIO()
    input_image.save(img_byte_arr, format='JPEG')
    img_bytes = img_byte_arr.getvalue()
    
    # Process the image
    start_time = asyncio.get_event_loop().time()
    result = await apply_lightning_diffusion(
        img_data=img_bytes,
        prompt=prompt,
        strength=strength,
        num_steps=steps,
        use_controlnet=use_controlnet,
        negative_prompt=None, # "ugly, deformed, disfigured, poor details, bad anatomy",
        return_depth_map=True  # Add parameter to return depth map
    )
    
    # Check if we have both processed image and depth map
    if isinstance(result, tuple) and len(result) == 2:
        processed_bytes, depth_map = result
    else:
        processed_bytes = result
        depth_map_bytes = None
    
    # Make sure we got valid image data back
    if not processed_bytes or len(processed_bytes) == 0:
        print("Error: No processed image data returned")
        return None
        
    # Convert bytes back to PIL Image
    result_image = Image.open(io.BytesIO(processed_bytes))
    
    # Save the result
    os.makedirs(os.path.dirname(output_image_path), exist_ok=True)
    result_image.save(output_image_path)
    print(f"Image saved to {output_image_path}")
    
    # Save depth map if available
    if depth_map:
        depth_map_path = os.path.splitext(output_image_path)[0] + "_depth_map.jpg"
        depth_map.save(depth_map_path)
        print(f"Depth map saved to {depth_map_path}")
    
    # Calculate processing time
    total_time = asyncio.get_event_loop().time() - start_time
    print(f"\nGeneration took {total_time:.2f}s total")
    
    return result_image


def run_generate(
    input: str = "img/img_in/living_room.jpg",
    output: str = "img/img_out/generated.jpg",
    prompt: str = "Oil painting of people relaxing in a cozy living room, warm colors",
    strength: float = 0.8,
    steps: int = 4,
    controlnet: bool = True
):
    """
    CLI wrapper for the generate_image function.
    
    Args:
        input: Path to input image
        output: Path to save output image
        prompt: Text prompt for image generation
        strength: Strength of transformation (0.0-1.0)
        steps: Number of diffusion steps (1, 2, 4, or 8 recommended)
        controlnet: Whether to use ControlNet for depth-guided generation
    """
    asyncio.run(generate_image(
        input_image_path=input,
        output_image_path=output,
        prompt=prompt,
        strength=strength,
        steps=steps,
        use_controlnet=controlnet
    ))
    asyncio.run(generate_image(
        input_image_path=input,
        output_image_path=output,
        prompt=prompt,
        strength=strength,
        steps=steps,
        use_controlnet=controlnet
    ))
    

if __name__ == "__main__":
    with logger.span("Running generate_lightning.py"):
        import fire
        fire.Fire(run_generate)