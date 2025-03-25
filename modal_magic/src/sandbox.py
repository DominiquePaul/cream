import torch
from diffusers.models.controlnets.controlnet import ControlNetModel
from diffusers.pipelines.auto_pipeline import AutoPipelineForImage2Image
from diffusers.utils.loading_utils import load_image
from diffusers.utils.pil_utils import make_image_grid
import matplotlib.pyplot as plt
import numpy as np
import time
from typing import List, Tuple, Optional, Dict, Any
from PIL import Image
from transformers import pipeline


class ImageGenerator:
    def __init__(self, use_controlnet: bool = True):
        self.use_controlnet = use_controlnet
        self.setup_pipeline()
        if use_controlnet:
            self.depth_estimator = pipeline('depth-estimation')
        
    def generate_depth_map(self, image: Image.Image) -> Image.Image:
        """Generate a depth map from an input image."""
        if not self.use_controlnet:
            raise ValueError("Depth map generation is only available when use_controlnet=True")
        
        # The depth estimator expects RGB images
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Get depth map from model
        outputs = self.depth_estimator(image)
        
        # Convert output tensor to numpy array
        if isinstance(outputs, Dict):
            depth_map = outputs.get('predicted_depth')
            if depth_map is None:
                raise ValueError("Depth estimation failed: no depth map in output")
        else:
            depth_map = outputs
            
        if isinstance(depth_map, torch.Tensor):
            depth_map = depth_map.detach().cpu().numpy()
            
        if not isinstance(depth_map, np.ndarray):
            raise ValueError(f"Unexpected depth map type: {type(depth_map)}")
        
        # Ensure we have a 2D array
        if len(depth_map.shape) > 2:
            depth_map = depth_map.squeeze()
        
        # Normalize to 0-255 range
        depth_min = float(depth_map.min())
        depth_max = float(depth_map.max())
        normalized_depth = (255 * (depth_map - depth_min) / (depth_max - depth_min)).astype(np.uint8)
        
        # Convert to PIL Image
        depth_image = Image.fromarray(normalized_depth)
        
        # Ensure the depth map is the same size as the input image
        if depth_image.size != image.size:
            depth_image = depth_image.resize(image.size, Image.Resampling.LANCZOS)
        
        return depth_image
        
    def setup_pipeline(self):
        """Initialize the pipeline with or without ControlNet."""
        if self.use_controlnet:
            controlnet = ControlNetModel.from_pretrained(
                "lllyasviel/control_v11f1p_sd15_depth",
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True
            )
            self.pipeline = AutoPipelineForImage2Image.from_pretrained(
                "runwayml/stable-diffusion-v1-5",
                controlnet=controlnet,
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True
            )
        else:
            self.pipeline = AutoPipelineForImage2Image.from_pretrained(
                "stabilityai/stable-diffusion-xl-refiner-1.0",
                torch_dtype=torch.float16,
                variant="fp16",
                use_safetensors=True
            )
        
        self.pipeline.enable_model_cpu_offload()
        # Enable xformers optimization if available
        try:
            self.pipeline.enable_xformers_memory_efficient_attention()
            print("Enabled xformers memory efficient attention")
        except Exception as e:
            print(f"Could not enable xformers: {e}")
    
    def generate_images(
        self,
        init_image: Image.Image,
        prompt: str,
        depth_image: Optional[Image.Image] = None,
        strength_range: Tuple[float, float] = (0.05, 0.95),
        num_images: int = 9,
        guidance_scale: float = 7.5,
        negative_prompt: Optional[str] = None
    ) -> Tuple[List[Image.Image], List[float], float, float]:
        """
        Generate a series of images with different strength values.
        
        Args:
            init_image: Initial input image
            prompt: Text prompt for generation
            depth_image: Depth map for ControlNet (optional, will be generated if None)
            strength_range: Range of strength values (min, max)
            num_images: Number of images to generate
            guidance_scale: Guidance scale for the diffusion model
            negative_prompt: Optional negative prompt to guide generation
            
        Returns:
            Tuple containing:
            - List of generated images
            - List of generation times
            - Total generation time
            - Average generation time
        """
        if self.use_controlnet and depth_image is None:
            print("Generating depth map...")
            depth_image = self.generate_depth_map(init_image)
            # Save the depth map for reference
            depth_image.save("img/img_out/depth_map.jpg")
            print("Depth map generated and saved to img/img_out/depth_map.jpg")
        
        strengths = np.linspace(strength_range[0], strength_range[1], num_images)
        generated_images = [init_image]
        generation_times = []
        
        total_start_time = time.time()
        
        for strength in strengths:
            print(f"Generating image with strength {strength:.2f}...")
            start_time = time.time()
            
            if self.use_controlnet and depth_image is not None:
                image = self.pipeline(
                    prompt,
                    image=init_image,
                    control_image=depth_image,
                    strength=float(strength),
                    guidance_scale=guidance_scale,
                    negative_prompt=negative_prompt
                ).images[0]
            else:
                image = self.pipeline(
                    prompt,
                    image=init_image,
                    strength=float(strength),
                    guidance_scale=guidance_scale,
                    negative_prompt=negative_prompt
                ).images[0]
            
            end_time = time.time()
            generation_time = end_time - start_time
            generation_times.append(generation_time)
            generated_images.append(image)
            print(f"Image generation took {generation_time:.2f} seconds")
        
        total_time = time.time() - total_start_time
        avg_time = sum(generation_times) / len(generation_times)
        print(f"Total generation time: {total_time:.2f} seconds")
        print(f"Average generation time per image: {avg_time:.2f} seconds")
        
        return generated_images, generation_times, total_time, avg_time


def visualize_results(
    generated_images: List[Image.Image],
    strengths: np.ndarray,
    output_path: str = "img/img_out/strength_comparison.jpg"
):
    """
    Create and save a visualization grid of the generated images.
    
    Args:
        generated_images: List of generated images including the original
        strengths: Array of strength values used
        output_path: Path to save the output image
    """
    plt.figure(figsize=(15, 16))
    plt.suptitle("Images at Different Adherence Strengths", fontsize=16)
    
    # Display the original image at the top
    plt.subplot(4, 3, 2)
    plt.imshow(np.array(generated_images[0]))
    plt.title("Original", fontsize=14)
    plt.axis('off')
    
    # Display the generated images in a 3x3 grid below
    for i in range(len(strengths)):
        plt.subplot(4, 3, i + 4)
        plt.imshow(np.array(generated_images[i + 1]))
        plt.title(f"Strength: {strengths[i]:.2f}", fontsize=12)
        plt.axis('off')
    
    plt.tight_layout(rect=(0, 0, 1, 0.95))
    plt.savefig(output_path, dpi=300)
    plt.show()


def main():
    # Initialize generator
    generator = ImageGenerator(use_controlnet=True)
    
    # Load input image
    init_image = load_image("img/img_in/bar1.jpg")
    
    # Generate images (depth map will be generated automatically)
    prompt = "People in a bar, Van Gogh style"
    negative_prompt = "ugly, deformed, disfigured, poor details, bad anatomy"
    strengths = np.linspace(0.05, 0.95, 9)
    generated_images, _, _, _ = generator.generate_images(
        init_image=init_image,
        prompt=prompt,
        guidance_scale=7.5,
        negative_prompt=negative_prompt
    )
    
    # Visualize results
    visualize_results(generated_images, strengths)


if __name__ == "__main__":
    main()