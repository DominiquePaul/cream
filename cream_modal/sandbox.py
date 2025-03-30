import asyncio
import time
import sys

from PIL import Image
import matplotlib.pyplot as plt
import numpy as np
import torch
from diffusers.pipelines.stable_diffusion_xl.pipeline_stable_diffusion_xl import StableDiffusionXLPipeline
from diffusers.pipelines.stable_diffusion_xl.pipeline_stable_diffusion_xl_img2img import StableDiffusionXLImg2ImgPipeline
from diffusers.pipelines.controlnet.pipeline_controlnet_sd_xl import StableDiffusionXLControlNetPipeline
from diffusers.models.unets.unet_2d_condition import UNet2DConditionModel
from diffusers.models.controlnets.controlnet import ControlNetModel
from diffusers.schedulers.scheduling_euler_discrete import EulerDiscreteScheduler
from diffusers.models.attention_processor import AttnProcessor2_0  # Import for SDPA
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from transformers import pipeline
import torch.amp

from src.utils.logger import logger


# Generate a depth map from an input image
def generate_depth_map(depth_estimator, image: Image.Image) -> Image.Image:
    """Generate a depth map from an input image."""
    # The depth estimator expects RGB images
    if image.mode != 'RGB':
        image = image.convert('RGB')
    
    # Get depth map from model
    print(f"Generating depth map for image of size {image.size}")
    start_time = time.time()
    outputs = depth_estimator(image)
    depth_time = time.time() - start_time
    print(f"Depth map generated in {depth_time:.2f}s")
    
    # Convert output tensor to numpy array
    if isinstance(outputs, dict):
        depth_map = outputs.get('predicted_depth')
        if depth_map is None:
            raise ValueError("Depth estimation failed: no depth map in output")
    else:
        depth_map = outputs
        
    if isinstance(depth_map, torch.Tensor):
        # If we're on GPU, move tensor to CPU before converting to numpy
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
    


# Modified function to accept a pre-loaded pipeline
async def process_with_sdxl_lightning(input_image, strength=0.7, num_steps=4, use_controlnet=False, prompt="Van Gogh style painting", 
                                      pipe=None, cached_depth_map=None, reuse_pipeline=False):
    """Process an image using SDXL-Lightning model directly, following the model card approach"""
    
    # Track timing for each part of the pipeline
    timings = {
        'unet_loading': 0.0,
        'checkpoint_loading': 0.0,
        'controlnet_loading': 0.0,
        'depth_map_generation': 0.0,
        'pipeline_creation': 0.0,
        'inference': 0.0,
        'total': 0.0,
        'optimization': 0.0
    }
    start_total = time.time()
    
    # Base model to use with Lightning
    base_model = "stabilityai/stable-diffusion-xl-base-1.0"
    repo = "ByteDance/SDXL-Lightning"
    controlnet_model_name = "diffusers/controlnet-depth-sdxl-1.0"
    
    # Determine which checkpoint to use based on inference steps
    if num_steps == 1:
        prediction_type = "sample"
        if not reuse_pipeline:
            print("Using 1-step SDXL-Lightning checkpoint")
            ckpt = "sdxl_lightning_1step_unet_x0.safetensors"
            # For 1-step models, we should use text-to-image as in the example
            print("Note: 1-step model is experimental and quality may be less stable")
            # ControlNet not well suited for 1-step models
            use_controlnet = False
            print("ControlNet disabled for 1-step model")
    elif num_steps <= 2:
        prediction_type = "epsilon"
        if not reuse_pipeline:
            print("Using 2-step SDXL-Lightning checkpoint")
            ckpt = "sdxl_lightning_2step_unet.safetensors"
    elif num_steps <= 4:
        prediction_type = "epsilon"
        if not reuse_pipeline:
            print("Using 4-step SDXL-Lightning checkpoint")
            ckpt = "sdxl_lightning_4step_unet.safetensors"
    else:
        prediction_type = "epsilon"
        if not reuse_pipeline:
            print("Using 8-step SDXL-Lightning checkpoint")
            ckpt = "sdxl_lightning_8step_unet.safetensors"
    
    # If we're reusing a pipeline, skip all the loading steps
    if pipe is None or not reuse_pipeline:
        if not reuse_pipeline:
            print("Setting up new SDXL-Lightning pipeline...")
        
        # Load UNet from configuration
        print(f"Loading UNet from {base_model}")
        start = time.time()
        unet = UNet2DConditionModel.from_pretrained(
            base_model, subfolder="unet", torch_dtype=torch.float16
        ).to("cuda") # type: ignore
        timings['unet_loading'] = time.time() - start
        print(f"UNet loaded in {timings['unet_loading']:.2f}s")
        
        # Download and load the checkpoint
        print(f"Downloading checkpoint: {ckpt}")
        start = time.time()
        ckpt_path = hf_hub_download(repo, ckpt)
        print(f"Loading checkpoint from: {ckpt_path}")
        unet.load_state_dict(load_file(ckpt_path, device="cuda"))
        timings['checkpoint_loading'] = time.time() - start
        print(f"Checkpoint loaded in {timings['checkpoint_loading']:.2f}s")
        
        # Initialize ControlNet if requested
        controlnet = None
        depth_map = cached_depth_map
        depth_estimator = None
        
        if use_controlnet and num_steps > 1:
            print(f"Loading ControlNet model: {controlnet_model_name}")
            try:
                # Load the ControlNet model
                start = time.time()
                controlnet = ControlNetModel.from_pretrained(
                    controlnet_model_name,
                    torch_dtype=torch.float16,
                    use_safetensors=True
                ).to("cuda") # type: ignore
                timings['controlnet_loading'] = time.time() - start
                print(f"ControlNet model loaded in {timings['controlnet_loading']:.2f}s")
                
                
                # Generate depth map if not already provided
                if depth_map is None:
                    # Initialize depth estimator
                    depth_estimator = pipeline('depth-estimation', device="cuda")
                    
                    # Generate depth map
                    start = time.time()
                    depth_map = generate_depth_map(depth_estimator, input_image)
                    timings['depth_map_generation'] = time.time() - start
                    print(f"Depth map generated in {timings['depth_map_generation']:.2f}s")
                else:
                    print("Using cached depth map")
                
            except Exception as e:
                print(f"Error loading ControlNet or generating depth map: {e}")
                print("Continuing without ControlNet")
                use_controlnet = False
                controlnet = None
                depth_map = None
        
        # Create pipeline based on number of steps and ControlNet usage
        start = time.time()
        if num_steps == 1:
            # For 1-step, use the StableDiffusionXLPipeline directly as in model card
            print(f"Creating txt2img pipeline with {base_model} for 1-step model")
            pipe = StableDiffusionXLPipeline.from_pretrained(
                base_model, unet=unet, torch_dtype=torch.float16, variant="fp16"
            ).to("cuda")
        elif use_controlnet and controlnet is not None:
            # For multi-step with ControlNet, use StableDiffusionXLControlNetPipeline
            print(f"Creating ControlNet pipeline with {base_model}")
            pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                base_model, 
                unet=unet, 
                controlnet=controlnet,
                torch_dtype=torch.float16, 
                variant="fp16"
            ).to("cuda")
        else:
            # For multi-step without ControlNet, use img2img pipeline
            print(f"Creating img2img pipeline with {base_model}")
            pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
                base_model, unet=unet, torch_dtype=torch.float16, variant="fp16"
            ).to("cuda")
        
        # Configure scheduler based on model requirements
        print(f"Configuring scheduler with prediction_type={prediction_type}")
        pipe.scheduler = EulerDiscreteScheduler.from_config(
            pipe.scheduler.config, 
            timestep_spacing="trailing",
            prediction_type=prediction_type
        )
        
        # ===== Add Speed Optimizations =====
        print("Applying performance optimizations...")
        opt_start = time.time()
        
        if hasattr(pipe, "enable_attention_slicing"):
            pipe.enable_attention_slicing()
        
        # Enable xFormers memory efficient attention if available
        try:
            if hasattr(pipe, "enable_xformers_memory_efficient_attention"):
                pipe.enable_xformers_memory_efficient_attention()
                print("Enabled xFormers memory efficient attention")
        except Exception as e:
            print(f"Error enabling xFormers: {e}")
            # Try using SDPA as fallback
            try:
                print("Trying to use Scaled Dot Product Attention (SDPA) as alternative")
                pipe.unet.set_attn_processor(AttnProcessor2_0())
                pipe.vae.set_attn_processor(AttnProcessor2_0())
                print("Enabled SDPA attention mechanism")
            except Exception as e2:
                print(f"Error enabling SDPA: {e2}")
        
        # Do NOT use CPU offloading when using torch.compile as they conflict
        print("Skipping model CPU offloading (not compatible with torch.compile)")
        
        # Set torch CUDA operations to be non-blocking for better parallelism
        torch.backends.cudnn.benchmark = True
        
        timings['optimization'] += time.time() - opt_start
        print(f"Performance optimizations applied in {timings['optimization']:.2f}s")
        
        timings['pipeline_creation'] = time.time() - start
        print(f"Pipeline created in {timings['pipeline_creation']:.2f}s")
    else:
        print(f"Using cached pipeline for step count: {num_steps}")
        depth_map = cached_depth_map
    
    try:
        # Process the image
        print("Processing image...")
        start = time.time()
        
        # Standard autocast implementation 
        try:
            if num_steps == 1:
                # For 1-step, generate a new image (text-to-image)
                # Since we can't use img2img properly with 1-step model
                print("Using text-to-image generation for 1-step model")
                try:
                    # Set a timeout for inference to prevent hanging
                    print(f"Starting text2img inference with steps={num_steps}")
                    output = pipe(
                        prompt=prompt,
                        num_steps=num_steps,
                        guidance_scale=1.0,  # Slight guidance helps with stability
                    )
                    print("Text2img inference completed successfully")
                except Exception as e:
                    print(f"Error during text2img inference: {e}")
                    return input_image, timings, pipe, depth_map
                
                # Image extraction for text2img
                result_image = None
                try:
                    # Most diffusers pipelines return an object with images attribute
                    if hasattr(output, 'images') and len(output.images) > 0:
                        result_image = output.images[0]
                    elif isinstance(output, (tuple, list)) and len(output) > 0:
                        result_image = output[0] if isinstance(output[0], Image.Image) else None
                    
                    # If still no image, return input
                    if result_image is None:
                        print("Warning: Could not extract output image, returning input image")
                        result_image = input_image
                    else:
                        print("Image generated successfully!")
                except Exception as e:
                    print(f"Error extracting image from output: {e}")
                    result_image = input_image
            else:
                # For multi-step using appropriate pipeline
                print(f"Using image processing with {num_steps} steps")
                
                # Use ControlNet if available
                if use_controlnet and depth_map is not None and isinstance(pipe, StableDiffusionXLControlNetPipeline):
                    print("Using ControlNet with depth map")
                    try:
                        print(f"Starting ControlNet inference with strength={strength}, steps={num_steps}")
                        output = pipe(
                            prompt=prompt,
                            image=input_image,
                            control_image=depth_map,
                            num_steps=num_steps,
                            guidance_scale=1.0,  # Slight guidance helps with stability
                            controlnet_conditioning_scale=0.5,  # Adjust this as needed
                            strength=strength,
                        )
                        print("ControlNet inference completed successfully")
                    except Exception as e:
                        print(f"Error during ControlNet inference: {e}")
                        return input_image, timings, pipe, depth_map
                else:
                    # Standard img2img without ControlNet
                    print("Using standard img2img without ControlNet")
                    try:
                        # Add a small timeout for debugging
                        print(f"Starting inference with strength={strength}, steps={num_steps}")
                        output = pipe(
                            prompt=prompt,
                            image=input_image,
                            strength=strength,
                            num_steps=num_steps,
                            guidance_scale=1.0,  # Slight guidance helps with stability
                        )
                        print("Inference completed successfully")
                    except Exception as e:
                        print(f"Error during img2img inference: {e}")
                        return input_image, timings, pipe, depth_map
                
                # Image extraction for img2img
                result_image = None
                # Most diffusers pipelines return an object with images attribute
                if hasattr(output, 'images') and len(output.images) > 0:
                    result_image = output.images[0]
                elif isinstance(output, (tuple, list)) and len(output) > 0:
                    result_image = output[0] if isinstance(output[0], Image.Image) else None
                
                # If still no image, return input
                if result_image is None:
                    logger.error("Warning: Could not extract output image, returning input image")
                    result_image = input_image
        except Exception as e:
            print(f"Unexpected error during image processing: {e}")
            import traceback
            traceback.print_exc()
            return input_image, timings, pipe, depth_map
        
        timings['inference'] = time.time() - start
        print(f"Inference completed in {timings['inference']:.2f}s")
        # Calculate total time
        timings['total'] = time.time() - start_total
        
        # Print timing summary
        print("\n--- Timing Summary ---")
        if not reuse_pipeline:
            print(f"UNet loading: {timings['unet_loading']:.2f}s")
            print(f"Checkpoint loading: {timings['checkpoint_loading']:.2f}s")
            if use_controlnet and num_steps > 1:
                print(f"ControlNet loading: {timings['controlnet_loading']:.2f}s")
                print(f"Depth map generation: {timings['depth_map_generation']:.2f}s")
            print(f"Pipeline creation: {timings['pipeline_creation']:.2f}s")
            print(f"Optimizations: {timings['optimization']:.2f}s")
        print(f"Inference: {timings['inference']:.2f}s")
        print(f"Total time: {timings['total']:.2f}s")
        print("---------------------\n")
        
        return result_image, timings, pipe, depth_map
        
    except Exception as e:
        print(f"Error processing with SDXL-Lightning: {e}")
        import traceback
        traceback.print_exc()
        timings['total'] = time.time() - start_total
        return input_image, timings, pipe, depth_map  # Return original image on error


# Add a utility function to shorten prompts for display
def shorten_prompt(prompt, max_length=40):
    """Shorten a prompt for display in captions"""
    if len(prompt) <= max_length:
        return prompt
    return prompt[:max_length] + "..."


async def main(strength: float = 0.2, use_controlnet: bool = False, prompt: str = "Van Gogh style painting of a living room", steps = None):
    """
    Main function to process images with SDXL-Lightning.
    
    Args:
        strength: Strength parameter for img2img (lower = faster but less change)
        num_generations: Number of images to generate
        use_controlnet: Whether to use ControlNet for additional guidance
        prompt: Text prompt for image generation
        steps: List of step counts to try, defaults to [4] if None
    """
    print("Starting image processing...")
    total_time = 0
    timing_data = {
        'processor_init': 0.0,
        'image_processing': 0.0,
        'visualization': 0.0
    }
    
    # Store all processed images for combined display
    all_processed_frames = []
    generation_times = []
    inference_times = []  # New array to track just inference times
    step_counts = []
    captions = []
    depth_map = None
    detailed_timings = {}
    
    # Load input frame once
    input_path = 'img/img_in/living_room.jpg'
    print(f"Loading input image from {input_path}")
    input_frame = Image.open(input_path)
    
    # Try different step counts
    if steps is None:
        steps_to_try = [4]
    else:
        steps_to_try = steps
    
    print(f"Will process with step counts: {steps_to_try}")
    
    # Cache for loaded pipelines and depth maps
    cached_pipelines = {}
    cached_depth_maps = {}
    
    # For each step count
    for i, num_steps in enumerate(steps_to_try):
        gen_start_time = time.time()
        
        # Use run number in the caption for repeated steps
        run_number = 1
        for j in range(i):
            if steps_to_try[j] == num_steps:
                run_number += 1
        
        print(f"\n===== Starting generation {i+1} of {len(steps_to_try)} with {num_steps} steps (Run #{run_number}) =====")
        
        # Use a different prompt for each run if available
        current_prompt = prompt
        if '__main__' in globals() and 'prompts' in globals()['__main__'].__dict__:
            prompts_list = globals()['__main__'].__dict__['prompts']
            if i < len(prompts_list):
                current_prompt = prompts_list[i]
                print(f"Using prompt variation {i+1}: '{current_prompt}'")
        
        # Check if we already have this pipeline cached
        reuse_pipeline = False
        cached_pipe = cached_pipelines.get(num_steps)
        cached_depth = cached_depth_maps.get(num_steps)
        
        if cached_pipe is not None:
            print(f"Reusing cached pipeline and models for {num_steps}-step (Run #{run_number})")
            reuse_pipeline = True
        else:
            print(f"Creating new pipeline for {num_steps}-step (Run #{run_number})")
            
        # For debugging the caching system
        print(f"Cache status: Available pipelines for steps: {list(cached_pipelines.keys())}")
        
        # Process the image with SDXL-Lightning
        process_start = time.time()
        processed_frame, timings, pipe, depth_map = await process_with_sdxl_lightning(
            input_frame,
            strength=strength,
            num_steps=num_steps,
            use_controlnet=use_controlnet,
            prompt=current_prompt,
            pipe=cached_pipe,
            cached_depth_map=cached_depth,
            reuse_pipeline=reuse_pipeline
        )
        
        # Always cache the resulting pipeline
        cached_pipelines[num_steps] = pipe
        if depth_map is not None:
            cached_depth_maps[num_steps] = depth_map
            
        process_time = time.time() - process_start
        timing_data['image_processing'] += process_time
        print(f"Image processed in {process_time:.2f}s")
        detailed_timings[f"{num_steps}-step-run{run_number}"] = timings
        
        # Add to processed frames
        all_processed_frames.append(processed_frame)
        step_counts.append(num_steps)
        controlnet_label = "with ControlNet" if use_controlnet else "without ControlNet"
        
        # Create a more informative caption that includes prompt information
        short_prompt = shorten_prompt(current_prompt)
        caption = f"{num_steps}-step {controlnet_label} (Run #{run_number})\nPrompt: {short_prompt}"
        captions.append(caption)
        
        # Track inference time separately
        inference_times.append(timings.get('inference', 0))
        
        gen_time = time.time() - gen_start_time
        generation_times.append(gen_time)
        total_time += gen_time
        print(f"Total generation time: {gen_time:.2f}s")
        print(f"Inference time: {timings.get('inference', 0):.2f}s")
        
        # Compare inference times
        if run_number > 1:
            # Find previous run with same number of steps
            prev_inference_times = []
            for k, (prev_steps, prev_time) in enumerate(zip(step_counts[:-1], inference_times[:-1])):
                if prev_steps == num_steps:
                    prev_inference_times.append(prev_time)
            
            if prev_inference_times:
                first_time = prev_inference_times[0]
                current_time = timings.get('inference', 0)
                change = ((current_time - first_time) / first_time) * 100
                print(f"Inference speed comparison: {change:+.2f}% change from first run")
                
                if len(prev_inference_times) > 0:
                    prev_time = prev_inference_times[-1]
                    change_from_prev = ((current_time - prev_time) / prev_time) * 100
                    print(f"Change from previous run: {change_from_prev:+.2f}%")
    
    # Time visualization
    viz_start = time.time()
    try:
        # Determine how many images we need to display
        num_processed = len(all_processed_frames)
        
        # Create modified captions to emphasize inference speed differences
        for i in range(len(all_processed_frames)):
            run_num = 0
            for j in range(i+1):
                if step_counts[j] == step_counts[i]:
                    run_num += 1
            
            frames_title = f'SDXL-Lightning {step_counts[i]}-step (Run #{run_num})'
            
            if run_num == 1:
                frames_title += f' - Inference: {inference_times[i]:.2f}s'
            else:
                first_inference_time = None
                # Find the first run with this step count
                for k, (steps, time_val) in enumerate(zip(step_counts, inference_times)):
                    if steps == step_counts[i]:
                        first_inference_time = time_val
                        break
                
                if first_inference_time is not None:
                    change = ((inference_times[i] - first_inference_time) / first_inference_time) * 100
                    frames_title += f' - Inference: {inference_times[i]:.2f}s ({change:+.1f}%)'
            
            # Update the caption to include inference time comparison
            captions[i] = frames_title
        
        # Special visualization for inference time comparison
        print("\n=== Creating Inference Speed Visualization ===")
        
        # Create a special bar chart to compare inference times
        plt.figure(figsize=(10, 6))
        
        # Find unique step counts
        unique_steps = sorted(list(set(step_counts)))
        
        for step_count in unique_steps:
            # Get all inference times for this step count
            step_indices = [i for i, s in enumerate(step_counts) if s == step_count]
            step_inference_times = [inference_times[i] for i in step_indices]
            
            # Set up bar positions and labels
            run_labels = [f"Run #{i+1}" for i in range(len(step_inference_times))]
            bar_positions = list(range(len(step_inference_times)))
            
            # Plot bars for this step count
            bars = plt.bar(bar_positions, step_inference_times, 
                   label=f"{step_count}-step model", alpha=0.8)
            
            # Add percentage change labels for runs after the first
            if len(step_inference_times) > 1:
                first_time = step_inference_times[0]
                for i in range(1, len(step_inference_times)):
                    change = ((step_inference_times[i] - first_time) / first_time) * 100
                    plt.text(bar_positions[i], step_inference_times[i] + 0.01, 
                            f"{change:+.1f}%", ha='center', fontsize=9)
            
            # Add actual time values on top of bars
            for i, v in enumerate(step_inference_times):
                plt.text(bar_positions[i], v + 0.05, f"{v:.2f}s", ha='center')
            
            plt.xticks(bar_positions, run_labels)
        
        plt.ylabel('Inference Time (seconds)')
        plt.title('SDXL-Lightning Inference Speed Comparison')
        plt.grid(axis='y', linestyle='--', alpha=0.7)
        
        if len(unique_steps) > 1:
            plt.legend()
            
        plt.tight_layout()
        plt.show()
        
        # Now show regular image comparison
        if num_processed > 1:
            # When we have multiple step counts to compare
            if use_controlnet and depth_map is not None:
                # Layout: input, depth map, followed by all processed images in a row
                # Calculate rows needed: 2 for input & depth + rows needed for outputs
                num_output_rows = (num_processed + 1) // 2  # 2 images per row, rounded up
                total_rows = 2 + num_output_rows
                
                plt.figure(figsize=(12, 5 * total_rows))
                
                # Display input frame
                plt.subplot(total_rows, 2, 1)
                plt.imshow(input_frame)
                plt.title('Input Frame')
                plt.axis('off')
                
                # Display depth map
                plt.subplot(total_rows, 2, 2)
                plt.imshow(depth_map, cmap='viridis')
                plt.title('Depth Map (ControlNet Input)')
                plt.axis('off')
                
                # Display all processed frames
                for i, (frame, steps, time_taken) in enumerate(zip(all_processed_frames, step_counts, generation_times)):
                    plt.subplot(total_rows, 2, i + 3)  # +3 because we already used positions 1 and 2
                    plt.imshow(frame)
                    plt.title(captions[i])
                    plt.axis('off')
                
            else:
                # Without ControlNet, just show input and all outputs
                # Calculate rows needed: 1 for input + rows needed for outputs
                num_output_rows = (num_processed + 1) // 2  # 2 images per row, rounded up
                total_rows = 1 + num_output_rows
                
                plt.figure(figsize=(12, 5 * total_rows))
                
                # Display input frame
                plt.subplot(total_rows, 2, 1)
                plt.imshow(input_frame)
                plt.title('Input Frame')
                plt.axis('off')
                
                # Display all processed frames
                for i, (frame, steps, time_taken) in enumerate(zip(all_processed_frames, step_counts, generation_times)):
                    plt.subplot(total_rows, 2, i + 2)  # +2 because we already used position 1
                    plt.imshow(frame)
                    plt.title(captions[i])
                    plt.axis('off')
        
        else:
            # Original code for single image visualization
            if use_controlnet and depth_map is not None:
                # Create a plot with input, depth map, and output
                plt.figure(figsize=(6, 15))
                
                # Display input frame
                plt.subplot(3, 1, 1)
                plt.imshow(input_frame)
                plt.title('Input Frame')
                plt.axis('off')
                
                # Display depth map
                plt.subplot(3, 1, 2)
                plt.imshow(depth_map, cmap='viridis')  # Using viridis colormap for depth
                plt.title('Depth Map (ControlNet Input)')
                plt.axis('off')
                
                # Display output frame
                plt.subplot(3, 1, 3)
                plt.imshow(all_processed_frames[0])
                steps = step_counts[0]
                time_taken = generation_times[0]
                plt.title(captions[0])
                plt.axis('off')
            else:
                # Create a simple comparison between input and output
                plt.figure(figsize=(6, 12))
                
                # Display input frame
                plt.subplot(2, 1, 1)
                plt.imshow(input_frame)
                plt.title('Input Frame')
                plt.axis('off')
                
                # Display output frame
                plt.subplot(2, 1, 2)
                plt.imshow(all_processed_frames[0])
                steps = step_counts[0]
                time_taken = generation_times[0]
                plt.title(captions[0])
                plt.axis('off')
        
        plt.tight_layout()
        plt.show()
    except Exception as e:
        print(f"Error during visualization: {e}")
        import traceback
        traceback.print_exc()
    
    timing_data['visualization'] = time.time() - viz_start
    
    # Print overall timing statistics
    controlnet_status = "with ControlNet" if use_controlnet else "without ControlNet"
    print(f"\n=== Overall Timing Analysis for SDXL-Lightning {controlnet_status} ===")
    for i, (steps, time_taken, caption) in enumerate(zip(step_counts, generation_times, captions)):
        print(f"  {caption}: {time_taken:.2f}s")
        
        # Print detailed breakdown
        step_timings = detailed_timings.get(f"{steps}-step-run{i+1}", {})
        if step_timings:
            print("  Detailed breakdown:")
            print(f"    • Model loading: {step_timings.get('unet_loading', 0) + step_timings.get('checkpoint_loading', 0):.2f}s")
            if use_controlnet:
                print(f"    • ControlNet setup: {step_timings.get('controlnet_loading', 0) + step_timings.get('depth_map_generation', 0):.2f}s")
            print(f"    • Pipeline creation: {step_timings.get('pipeline_creation', 0):.2f}s")
            print(f"    • Inference: {step_timings.get('inference', 0):.2f}s")
    
    print(f"Total processing time: {total_time:.2f}s")
    print(f"Visualization time: {timing_data['visualization']:.2f}s")
    print("=" * 70)
    
    # Create a timing pie chart
    try:
        # Only create if we have detailed timings
        if detailed_timings:
            # Get the first timing dictionary
            first_timing = next(iter(detailed_timings.values()))
            
            # Create the pie chart data
            pie_labels = []
            pie_values = []
            
            # Add the core steps
            if 'unet_loading' in first_timing:
                pie_labels.append('UNet Loading')
                pie_values.append(first_timing['unet_loading'])
            
            if 'checkpoint_loading' in first_timing:
                pie_labels.append('Checkpoint Loading')
                pie_values.append(first_timing['checkpoint_loading'])
            
            if use_controlnet:
                if 'controlnet_loading' in first_timing:
                    pie_labels.append('ControlNet Loading')
                    pie_values.append(first_timing['controlnet_loading'])
                
                if 'depth_map_generation' in first_timing:
                    pie_labels.append('Depth Map Gen')
                    pie_values.append(first_timing['depth_map_generation'])
            
            if 'pipeline_creation' in first_timing:
                pie_labels.append('Pipeline Creation')
                pie_values.append(first_timing['pipeline_creation'])
            
            if 'inference' in first_timing:
                pie_labels.append('Inference')
                pie_values.append(first_timing['inference'])
            
            # Create and show the pie chart without saving
            plt.figure(figsize=(8, 8))
            plt.pie(pie_values, labels=pie_labels, autopct='%1.1f%%')
            plt.title(f'SDXL-Lightning {controlnet_status} Timing Breakdown')
            plt.show()
            
    except Exception as e:
        print(f"Error creating timing chart: {e}")
    
    return all_processed_frames[0] if all_processed_frames else None


# Run the async main function
if __name__ == "__main__":
    # Configurable parameters - optimized for comparison of strength values
    num_steps = 4  # Fixed number of steps for all generations
    use_controlnet = True  # Use ControlNet for better guidance
    
    # Define strength values to compare
    strength_values = [0.2, 0.4, 0.6, 0.8, 1.0]  # Range from subtle to complete transformation
    
    # Use a consistent prompt for better comparison of strength values
    base_prompt = "Oil painting of people relaxing in a cozy living room, warm colors"
    
    print(f"Running on Python {sys.version}")
    print(f"Base prompt: '{base_prompt}'")
    print(f"Fixed steps: {num_steps}")
    print(f"Comparing different strength values: {strength_values}")
    print(f"ControlNet: {use_controlnet}")
    print("Optimizations enabled: xFormers, attention slicing, and more")
    
    # Define a async function to perform a warm-up run and then the strength comparison
    async def run_strength_comparison():
        print("\n=== Performing warm-up run to prime GPU and cache ===")
        # Simple warm-up run to initialize CUDA
        input_path = 'img/img_in/living_room.jpg'
        input_frame = Image.open(input_path)
        
        # Run a quick warm-up inference to prime the GPU caches
        _, _, pipe, depth_map = await process_with_sdxl_lightning(
            input_frame,
            strength=0.5,  # Middle strength for warm-up
            num_steps=num_steps,
            use_controlnet=use_controlnet,
            prompt=base_prompt,
            pipe=None,
            cached_depth_map=None,
            reuse_pipeline=False
        )
        
        # Clear GPU cache to ensure a clean state for benchmarking
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        print("=== Warm-up complete, starting strength comparison ===\n")
        
        # Store all processed images for comparison display
        all_processed_frames = []
        generation_times = []
        inference_times = []
        strength_values_used = []
        captions = []
        
        # Process the image with different strength values, reusing the pipeline
        for i, strength_val in enumerate(strength_values):
            print(f"\n===== Starting generation {i+1} of {len(strength_values)} with strength={strength_val} =====")
            
            process_start = time.time()
            processed_frame, timings, pipe, depth_map = await process_with_sdxl_lightning(
                input_frame,
                strength=strength_val,
                num_steps=num_steps,
                use_controlnet=use_controlnet,
                prompt=base_prompt,
                pipe=pipe,  # Reuse pipeline for efficiency
                cached_depth_map=depth_map,  # Reuse depth map
                reuse_pipeline=True
            )
            
            process_time = time.time() - process_start
            
            # Add to processed frames
            all_processed_frames.append(processed_frame)
            strength_values_used.append(strength_val)
            caption = f"Strength = {strength_val}, Inference: {timings.get('inference', 0):.2f}s"
            captions.append(caption)
            
            # Print output image size
            print(f"Output image size: {processed_frame.size}")
            
            # Track times
            inference_times.append(timings.get('inference', 0))
            generation_times.append(process_time)
            
            print(f"Total generation time: {process_time:.2f}s")
            print(f"Inference time: {timings.get('inference', 0):.2f}s")
        
        # Visualize the strength comparison
        print("\n=== Creating Strength Comparison Visualization ===")
        
        # Get number of images
        num_images = len(all_processed_frames)
        
        # Create a comparison grid
        # Calculate rows and columns needed for all images plus the input
        cols = min(3, num_images + 1)  # Max 3 columns
        rows = (num_images + 2) // cols  # +1 for input, +1 for depth map if using controlnet, rounded up
        
        if use_controlnet and depth_map is not None:
            # Add an extra row for the depth map
            rows += 1
        
        plt.figure(figsize=(6 * cols, 6 * rows))
        
        # Display input frame
        plt.subplot(rows, cols, 1)
        plt.imshow(input_frame)
        plt.title('Input Image')
        plt.axis('off')
        
        # Display depth map if using controlnet
        if use_controlnet and depth_map is not None:
            plt.subplot(rows, cols, 2)
            plt.imshow(depth_map, cmap='viridis')
            plt.title('Depth Map (ControlNet Input)')
            plt.axis('off')
            start_pos = 3  # First 2 positions taken by input and depth map
        else:
            start_pos = 2  # First position taken by input
        
        # Display all processed frames
        for i, (frame, strength_val, time_taken) in enumerate(zip(all_processed_frames, strength_values_used, inference_times)):
            plt.subplot(rows, cols, i + start_pos)
            plt.imshow(frame)
            plt.title(captions[i])
            plt.axis('off')
        
        plt.tight_layout()
        plt.show()
        
        
    
    if 'ipykernel' in sys.modules:
        # For notebook environment, needs to be manually wrapped
        print("Running in notebook environment")
        async def run_in_notebook():
            await run_strength_comparison()
        import nest_asyncio
        nest_asyncio.apply()
        asyncio.run(run_in_notebook())
    else:
        print("Running in script environment")
        asyncio.run(run_strength_comparison())