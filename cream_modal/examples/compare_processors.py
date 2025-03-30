#!/usr/bin/env python3
"""
Compare Standard and Lightning Diffusion Processors

This example shows how to use both diffusion processors interchangeably
and compares the results and performance.

Example usage:
    python examples/compare_processors.py process_with_both_processors --image img/img_in/bar1.jpg --prompt "Van Gogh style painting"
"""

import asyncio
import time
import os
import sys
from datetime import datetime
from PIL import Image
import matplotlib.pyplot as plt
import fire
from dotenv import load_dotenv

load_dotenv()

# Add the project root to the Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.utils.logger import logger
from src.diffusion_processor import (
    apply_diffusion,
    ProcessorType
)

async def process_with_both_processors(
    image: str,
    prompt: str = "Van Gogh style painting",
    output: str = "img/comparison",
    no_controlnet: bool = False,
    strength: float = 0.9,
    guidance: float = 7.0
):
    """Process the same image with both diffusion processors for comparison.
    
    Args:
        image: Path to input image
        prompt: Style prompt to apply
        output: Output directory for processed images
        no_controlnet: If True, disables ControlNet
        strength: Strength of the diffusion effect (0.0-1.0)
        guidance: Guidance scale for diffusion
    """
    # Ensure output directory exists
    os.makedirs(output, exist_ok=True)
    
    # Load input image
    logger.info(f"Loading input image: {image}")
    input_image = Image.open(image)
    
    # Convert to bytes
    import io
    img_buffer = io.BytesIO()
    input_image.save(img_buffer, format=input_image.format or "JPEG")
    img_data = img_buffer.getvalue()
    
    # Process with both processors and track timing
    results = {}
    processor_types: list[ProcessorType] = ["standard", "lightning"]
    
    for processor_type in processor_types:
        try:
            logger.info(f"Processing with {processor_type} processor")
            
            # Process the image
            start_time = time.time()
            
            # For Lightning processor, we can try different step counts
            if processor_type == "lightning":
                # Lightning works best with 1, 2, 4, or 8 steps
                steps = 4
                logger.info(f"Using {steps} steps for Lightning processor")
            else:
                # Standard processor typically uses more steps
                steps = 25
                logger.info(f"Using {steps} steps for Standard processor")
            
            processed_data = await apply_diffusion(
                img_data=img_data,
                processor_type=processor_type,
                prompt=prompt,
                use_controlnet=not no_controlnet,
                strength=strength,
                guidance_scale=guidance,
                num_steps=steps
            )
            
            processing_time = time.time() - start_time
            
            # Convert result to image
            output_buffer = io.BytesIO(processed_data)
            output_image = Image.open(output_buffer)
            
            # Save the output image
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"{os.path.splitext(os.path.basename(image))[0]}_{processor_type}_{timestamp}.jpg"
            output_path = os.path.join(output, output_filename)
            output_image.save(output_path)
            logger.info(f"Saved {processor_type} output to {output_path}")
            
            # Store result for comparison
            results[processor_type] = {
                "image": output_image,
                "time": processing_time,
                "path": output_path,
                "steps": steps
            }
            
        except Exception as e:
            logger.error(f"Error processing with {processor_type}: {e}")
            import traceback
            logger.error(traceback.format_exc())
    
    # Create comparison visualization
    if len(results) > 0:
        plt.figure(figsize=(18, 6))
        
        # Input image
        plt.subplot(1, 3, 1)
        plt.imshow(input_image)
        plt.title("Input Image")
        plt.axis("off")
        
        # Output images
        for i, (processor_type, result) in enumerate(results.items(), start=2):
            plt.subplot(1, 3, i)
            plt.imshow(result["image"])
            time_str = f"{result['time']:.2f}s" 
            steps_str = f"{result['steps']} steps"
            plt.title(f"{processor_type.capitalize()} ({time_str}, {steps_str})")
            plt.axis("off")
        
        # Save comparison
        comparison_path = os.path.join(
            output, 
            f"{os.path.splitext(os.path.basename(image))[0]}_comparison.jpg"
        )
        plt.tight_layout()
        plt.savefig(comparison_path)
        logger.info(f"Saved comparison to {comparison_path}")
        plt.show()
        
        # Print timing comparison
        if len(results) > 1:
            logger.info("Performance comparison:")
            for processor_type, result in results.items():
                logger.info(f"  {processor_type}: {result['time']:.2f}s ({result['steps']} steps)")

if __name__ == "__main__":
    fire.Fire({
        "process_with_both_processors": lambda *args, **kwargs: asyncio.run(process_with_both_processors(*args, **kwargs))
    })