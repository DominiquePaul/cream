#!/usr/bin/env python3
"""
Test script for the SDXL Lightning Diffusion Processor.
This script tests the basic functionality of the LightningDiffusionProcessor
by processing a sample image with different configurations.
"""

import asyncio
import time
import os
from PIL import Image
import matplotlib.pyplot as plt
import argparse

from src.utils.logger import logger
from src.lightning_diffusion import (
    LightningDiffusionProcessor, 
    get_lightning_processor,
    apply_lightning_diffusion
)

async def test_with_image(
    image_path: str,
    prompt: str = "Van Gogh style painting",
    use_controlnet: bool = False,
    strength: float = 0.7,
    num_steps: int = 4,
    output_dir: str = "output"
):
    """Test the LightningDiffusionProcessor with a single image."""
    logger.info(f"Testing LightningDiffusionProcessor with image: {image_path}")
    
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Load image
    logger.info("Loading input image")
    input_image = Image.open(image_path)
    
    # Convert image to bytes
    import io
    img_buffer = io.BytesIO()
    input_image.save(img_buffer, format=input_image.format or "JPEG")
    img_data = img_buffer.getvalue()
    
    # Process image
    logger.info(f"Processing image with prompt: '{prompt}', controlnet: {use_controlnet}, strength: {strength}, steps: {num_steps}")
    start_time = time.time()
    
    # Use the apply_lightning_diffusion function (which gets or creates a processor instance)
    output_data = await apply_lightning_diffusion(
        img_data=img_data,
        prompt=prompt,
        use_controlnet=use_controlnet,
        style_prompt=prompt,  # Use same prompt for style if needed
        strength=strength,
        num_steps=num_steps
    )
    
    processing_time = time.time() - start_time
    logger.info(f"Image processed in {processing_time:.2f} seconds")
    
    # Convert result back to image
    output_buffer = io.BytesIO(output_data)
    output_image = Image.open(output_buffer)
    
    # Save output image
    controlnet_str = "with_controlnet" if use_controlnet else "no_controlnet"
    output_filename = f"{os.path.splitext(os.path.basename(image_path))[0]}_lightning_{num_steps}steps_{controlnet_str}.jpg"
    output_path = os.path.join(output_dir, output_filename)
    logger.info(f"Saving output image to: {output_path}")
    output_image.save(output_path, format="JPEG", quality=95)
    
    # Display images
    plt.figure(figsize=(12, 6))
    
    plt.subplot(1, 2, 1)
    plt.imshow(input_image)
    plt.title("Input Image")
    plt.axis("off")
    
    plt.subplot(1, 2, 2)
    plt.imshow(output_image)
    plt.title(f"Output Image - {num_steps} steps, {controlnet_str}")
    plt.axis("off")
    
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"{os.path.splitext(os.path.basename(image_path))[0]}_comparison.jpg"))
    plt.show()
    
    return output_image, processing_time

async def test_with_multiple_configs(
    image_path: str,
    prompt: str = "Van Gogh style painting",
    output_dir: str = "output"
):
    """Test multiple configurations (steps, controlnet, etc.)."""
    logger.info("Testing multiple configurations")
    
    # Define different test configurations
    configs = [
        {"num_steps": 4, "use_controlnet": False, "strength": 0.7},
        {"num_steps": 4, "use_controlnet": True, "strength": 0.7},
        {"num_steps": 2, "use_controlnet": False, "strength": 0.7},
        {"num_steps": 8, "use_controlnet": False, "strength": 0.7},
    ]
    
    results = []
    
    # Run each configuration
    for i, config in enumerate(configs):
        logger.info(f"Running configuration {i+1}/{len(configs)}: {config}")
        output_image, processing_time = await test_with_image(
            image_path=image_path,
            prompt=prompt,
            use_controlnet=config["use_controlnet"],
            strength=config["strength"],
            num_steps=config["num_steps"],
            output_dir=output_dir
        )
        
        results.append({
            "config": config,
            "processing_time": processing_time,
            "output_image": output_image
        })
    
    # Create a comparison grid
    rows = len(results)
    plt.figure(figsize=(12, 4 * rows))
    
    # Show input image
    plt.subplot(rows+1, 2, 1)
    input_image = Image.open(image_path)
    plt.imshow(input_image)
    plt.title("Input Image")
    plt.axis("off")
    
    # Show all output images
    for i, result in enumerate(results):
        plt.subplot(rows+1, 2, i*2+3)  # +3 to start after input image
        plt.imshow(result["output_image"])
        config = result["config"]
        control_text = "with ControlNet" if config["use_controlnet"] else "no ControlNet"
        plt.title(f"{config['num_steps']} steps, {control_text}, strength={config['strength']}")
        plt.axis("off")
        
        # Show timing information
        plt.subplot(rows+1, 2, i*2+4)
        plt.text(0.5, 0.5, f"Processing time: {result['processing_time']:.2f}s", 
                 horizontalalignment='center', verticalalignment='center',
                 transform=plt.gca().transAxes, fontsize=14)
        plt.axis("off")
    
    plt.tight_layout()
    comparison_path = os.path.join(output_dir, f"{os.path.splitext(os.path.basename(image_path))[0]}_all_comparisons.jpg")
    plt.savefig(comparison_path)
    logger.info(f"Saved full comparison to: {comparison_path}")
    plt.show()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Test the LightningDiffusionProcessor")
    parser.add_argument("--image", required=True, help="Path to input image")
    parser.add_argument("--prompt", default="Van Gogh style painting", help="Prompt for image generation")
    parser.add_argument("--controlnet", action="store_true", help="Use ControlNet for processing")
    parser.add_argument("--steps", type=int, default=4, choices=[1, 2, 4, 8], help="Number of inference steps")
    parser.add_argument("--strength", type=float, default=0.7, help="Strength parameter (0.0-1.0)")
    parser.add_argument("--output", default="output", help="Output directory")
    parser.add_argument("--multi", action="store_true", help="Test multiple configurations")
    
    args = parser.parse_args()
    
    if args.multi:
        asyncio.run(test_with_multiple_configs(
            image_path=args.image,
            prompt=args.prompt,
            output_dir=args.output
        ))
    else:
        asyncio.run(test_with_image(
            image_path=args.image,
            prompt=args.prompt,
            use_controlnet=args.controlnet,
            strength=args.strength,
            num_steps=args.steps,
            output_dir=args.output
        )) 