import time
import io
import base64

from PIL import Image
import numpy as np
import torch
from diffusers.pipelines.stable_diffusion_xl.pipeline_stable_diffusion_xl import StableDiffusionXLPipeline
from diffusers.pipelines.stable_diffusion_xl.pipeline_stable_diffusion_xl_img2img import StableDiffusionXLImg2ImgPipeline
from diffusers.pipelines.controlnet.pipeline_controlnet_sd_xl import StableDiffusionXLControlNetPipeline
from diffusers.models.unets.unet_2d_condition import UNet2DConditionModel
from diffusers.models.controlnets.controlnet import ControlNetModel
from diffusers.schedulers.scheduling_euler_discrete import EulerDiscreteScheduler
from diffusers.models.attention_processor import AttnProcessor2_0
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file
from transformers import pipeline

from src.utils.logger import logger


class LightningDiffusionProcessor:
    """
    SDXL Lightning Diffusion Processor

    Note about linter errors:
    The current implementation may show linter errors related to the diffusers library and PyTorch
    type checking. This occurs because the static type checker has difficulty with the complex 
    return types of huggingface's diffusers library. These warnings can be safely ignored as the 
    code functions correctly at runtime.

    Common warnings include:
    1. "Cannot access attribute 'to' for class 'tuple[Unknown, ...]'" - This occurs when calling
    `.to("cuda")` on models loaded from pretrained weights.
    
    2. "Cannot access attribute 'images' for class 'tuple[...]'" - This happens when accessing
    the output images from diffusers pipelines.

    These are known limitations with the type system and the dynamic nature of the libraries used.
    """
    
    def __init__(self, 
                 use_controlnet: bool, 
                 strength: float,
                 num_steps: int):
        """
        Initialize the SDXL Lightning processor.
        
        Args:
            use_controlnet: Whether to use ControlNet for better structure preservation
            style_prompt: The style prompt to apply to all frames
            strength: How strongly to apply the diffusion (0.0-1.0)
            num_steps: Number of inference steps (1, 2, 4, or 8)
        """
        self.use_controlnet = use_controlnet
        self.strength = strength
        self.num_steps = num_steps
        
        
        # Initialize metrics for monitoring
        self.processed_frames = 0
        self.total_processing_time = 0.0
        self.last_processing_time = 0.0
        
        # Used to cache pipeline and depth map
        self.pipe = None
        self.depth_map = None
        self.depth_estimator = None
        
        # Track detailed timings
        self.timings = {
            'unet_loading': 0.0,
            'checkpoint_loading': 0.0,
            'controlnet_loading': 0.0,
            'depth_map_generation': 0.0,
            'pipeline_creation': 0.0,
            'inference': 0.0,
            'total': 0.0,
            'optimization': 0.0
        }
        
        # Setup pipeline and models
        with logger.span("Setting up SDXL-Lightning pipeline"):
            self.setup_pipeline()
        
    def setup_pipeline(self):
        """Initialize the pipeline based on the specified number of steps."""
        # Base model to use with Lightning
        base_model = "stabilityai/stable-diffusion-xl-base-1.0"
        repo = "ByteDance/SDXL-Lightning"
        controlnet_model_name = "diffusers/controlnet-depth-sdxl-1.0"
        
        # Determine device to use
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Using device: {device}")
        
        # Determine which checkpoint to use based on inference steps
        logger.info(f"Using {self.num_steps}-step SDXL-Lightning checkpoint")
        if self.num_steps == 1:
            prediction_type = "sample"
            logger.info("Using 1-step SDXL-Lightning checkpoint")
            ckpt = "sdxl_lightning_1step_unet_x0.safetensors"
            # For 1-step models, we should use text-to-image as in the example
            logger.info("Note: 1-step model is experimental and quality may be less stable.")
            # ControlNet not well suited for 1-step models
            if self.use_controlnet:
                logger.info("ControlNet disabled for 1-step model")
                self.use_controlnet = False
                
        elif self.num_steps <= 2:
            prediction_type = "epsilon"
            ckpt = "sdxl_lightning_2step_unet.safetensors"
        elif self.num_steps <= 4:
            prediction_type = "epsilon"
            ckpt = "sdxl_lightning_4step_unet.safetensors"
        else:
            prediction_type = "epsilon"
            ckpt = "sdxl_lightning_8step_unet.safetensors"
        
        # Clear CUDA cache before loading models if using GPU
        if device == "cuda":
            try:
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
            except Exception as e:
                logger.warning(f"Error clearing CUDA cache: {e}")
        
        # Load UNet from configuration
        with logger.span("Loading UNet"):
            # Ensure we get a properly typed model instance
            unet = UNet2DConditionModel.from_pretrained(
                base_model, subfolder="unet", torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                use_safetensors=True
            )
            # Cast to the right type to satisfy linter
            if not isinstance(unet, UNet2DConditionModel):
                logger.warning("UNet model is not the expected type")
            # Move to device as a separate step
            unet = unet.to(device) # type: ignore
        
        # Download and load the checkpoint
        with logger.span("Loading checkpoint"):
            ckpt_path = hf_hub_download(repo, ckpt)
            unet.load_state_dict(load_file(ckpt_path, device=device))
        
        # Initialize ControlNet if requested
        controlnet = None
        
        if self.use_controlnet and self.num_steps > 1:
            # Load the ControlNet model
            with logger.span("Loading ControlNet"):
                # Ensure we get a properly typed model instance
                controlnet = ControlNetModel.from_pretrained(
                    controlnet_model_name,
                    torch_dtype=torch.float16 if device == "cuda" else torch.float32,
                    use_safetensors=True
                )
                controlnet = controlnet.to(device) # type: ignore
                
                # Initialize depth estimator
                self.depth_estimator = pipeline('depth-estimation', device=device)
            
        # Create pipeline based on number of steps and ControlNet usage
        with logger.span("Creating pipeline"):
            dtype = torch.float16 if device == "cuda" else torch.float32
            if self.num_steps == 1:
                # For 1-step, use the StableDiffusionXLPipeline directly as in model card
                logger.info(f"Creating txt2img pipeline with {base_model} for 1-step model")
                self.pipe = StableDiffusionXLPipeline.from_pretrained(
                    base_model, unet=unet, torch_dtype=dtype, variant="fp16" if device == "cuda" else None,
                    use_safetensors=True
                ).to(device)
            elif self.use_controlnet and controlnet is not None:
                # For multi-step with ControlNet, use StableDiffusionXLControlNetPipeline
                logger.info(f"Creating ControlNet pipeline with {base_model}")
                self.pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                    base_model, 
                    unet=unet, 
                    controlnet=controlnet,
                    torch_dtype=dtype,
                    variant="fp16" if device == "cuda" else None,
                    use_safetensors=True
                ).to(device)
            else:
                # For multi-step without ControlNet, use img2img pipeline
                logger.info(f"Creating img2img pipeline with {base_model}")
                self.pipe = StableDiffusionXLImg2ImgPipeline.from_pretrained(
                    base_model, unet=unet, torch_dtype=dtype, variant="fp16" if device == "cuda" else None,
                    use_safetensors=True
                ).to(device)
        
        # Configure scheduler based on model requirements
        logger.info(f"Configuring scheduler with prediction_type={prediction_type}")
        self.pipe.scheduler = EulerDiscreteScheduler.from_config(
            self.pipe.scheduler.config, 
            timestep_spacing="trailing",
            # prediction_type=prediction_type
        )
        
        # Apply performance optimizations
        with logger.span("Applying performance optimizations"):
            if hasattr(self.pipe, "enable_attention_slicing"):
                self.pipe.enable_attention_slicing()
            
            # Enable xFormers memory efficient attention if available and on GPU
            if device == "cuda":
                try:
                    if hasattr(self.pipe, "enable_xformers_memory_efficient_attention"):
                        self.pipe.enable_xformers_memory_efficient_attention()
                        logger.info("Enabled xFormers memory efficient attention")
                except Exception as e:
                    logger.warning(f"Error enabling xFormers: {e}")
                    # Try using SDPA as fallback
                    try:
                        logger.info("Trying to use Scaled Dot Product Attention (SDPA) as alternative")
                        self.pipe.unet.set_attn_processor(AttnProcessor2_0())
                        self.pipe.vae.set_attn_processor(AttnProcessor2_0())
                        logger.info("Enabled SDPA attention mechanism")
                    except Exception as e2:
                        logger.warning(f"Error enabling SDPA: {e2}")
            
                # Set torch CUDA operations to be non-blocking for better parallelism
                torch.backends.cudnn.benchmark = True
    


    def generate_depth_map(self, image: Image.Image) -> Image.Image:
        """Generate a depth map from an input image."""
        if not self.use_controlnet:
            raise ValueError("Depth map generation is only available when use_controlnet=True")
        
        if self.depth_estimator is None:
            self.depth_estimator = pipeline('depth-estimation', device="cuda")
        
        # The depth estimator expects RGB images
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Get depth map from model
        outputs = self.depth_estimator(image)
            
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
    
    async def process_frame(
        self,
        frame_data: bytes,
        prompt: str,
        negative_prompt: str | None, #= "ugly, deformed, disfigured, poor details, bad anatomy",
        guidance_scale: float = 1.0,
        strength: float | None = None  # Add optional strength parameter
    ) -> tuple[bytes, Image.Image | None]:
        """
        Process a single frame with SDXL-Lightning.
        
        Args:
            frame_data: Raw bytes of the image frame
            prompt: Text prompt for generation (uses default style if None)
            negative_prompt: Negative prompt to guide generation
            guidance_scale: Guidance scale for the diffusion model
            strength: Optional strength to override the default value (0.0-1.0)
        Returns:
            Processed frame as bytes
        """           
        start_time = time.time()
        
        # Use provided strength or fall back to instance default
        current_strength = strength if strength is not None else self.strength
        
        # Validate input
        if not frame_data or len(frame_data) == 0:
            logger.error("Empty frame data received")
            return frame_data, None
            
        # Convert bytes to PIL Image
        input_buffer = io.BytesIO(frame_data)
        input_image = Image.open(input_buffer)
        
        # Log image details for debugging
        logger.info(f"Image: {input_image.format}, size: {input_image.size}, mode: {input_image.mode}. {len(frame_data)} bytes")
        
        # Ensure RGB mode
        if input_image.mode != 'RGB':
            input_image = input_image.convert('RGB')

        def resize_if_needed(image: Image.Image, max_size: int = 1500, min_size: int = 1200) -> Image.Image:
            """Resize image if larger dimension exceeds max_size or smaller dimension is below min_size while maintaining aspect ratio."""
            width, height = image.size
            larger_dim = max(width, height)
            smaller_dim = min(width, height)
            
            # Resize if image is too large or too small
            if larger_dim > max_size or smaller_dim < min_size:
                if larger_dim > max_size:
                    scale = max_size / larger_dim
                else:
                    scale = min_size / smaller_dim
                    
                new_width = int(width * scale)
                new_height = int(height * scale)
                
                logger.info(f"Resizing image from {width}x{height} to {new_width}x{new_height}")
                return image.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            return image

        model_input_image = resize_if_needed(input_image)
        
        try:
            # Free CUDA memory if needed
            torch.cuda.empty_cache()
            
            # Make sure pipe is initialized before calling it
            if self.pipe is None:
                logger.error("Pipeline was not properly initialized")
                return frame_data, None
            
            # Process with the appropriate pipeline
            generation_start = time.time()
            
            try:
                if self.num_steps == 1:
                    with logger.span("Processing with 1-step text-to-image pipeline"):
                        output = self.pipe(
                            prompt=prompt,
                            negative_prompt=negative_prompt,
                            num_inference_steps=self.num_steps,
                            guidance_scale=guidance_scale,
                            strength=current_strength,
                        )
                    
                elif self.use_controlnet:
                    with logger.span("Generating depth map"):
                        self.depth_map = self.generate_depth_map(input_image)
                    
                    # Process with ControlNet
                    with logger.span("Processing with controlnet pipeline"):
                        output = self.pipe(
                            prompt=prompt,
                            image=model_input_image,
                            control_image=self.depth_map,
                            negative_prompt=negative_prompt,
                            num_inference_steps=self.num_steps,
                            guidance_scale=guidance_scale,
                            controlnet_conditioning_scale=0.5,
                            strength=current_strength,
                        )
                    
                else:
                    # Standard img2img without ControlNet
                    if not isinstance(self.pipe, (StableDiffusionXLImg2ImgPipeline, StableDiffusionXLPipeline, StableDiffusionXLControlNetPipeline)):
                        logger.error(f"Pipeline type doesn't match the requested operation (Img2Img). Type found: {type(self.pipe)}")
                        return frame_data, None
                    
                    logger.info(f"Processing with img2img pipeline, steps={self.num_steps}, strength={current_strength}")
                    with logger.span("Processing with img2img pipeline"):
                        output = self.pipe(
                            prompt=prompt,
                            image=model_input_image,
                            negative_prompt=negative_prompt,
                            num_inference_steps=self.num_steps,
                            guidance_scale=guidance_scale,
                            strength=current_strength,
                        )
            except Exception as e:
                logger.error(f"Error during inference: {e}")
                return frame_data, None
            
            self.timings['inference'] = time.time() - generation_start
            logger.info(f"Inference completed in {self.timings['inference']:.2f}s")
            
            # Extract the output image
            result_image = None
            if hasattr(output, 'images') and isinstance(output.images, list) and len(output.images) > 0: # type: ignore
                result_image = output.images[0] # type: ignore
            elif isinstance(output, (tuple, list)) and len(output) > 0:
                result_image = output[0] if isinstance(output[0], Image.Image) else None
            
            if result_image is None:
                logger.error("No result image found")
                raise ValueError(f"Unexpected output type: {type(output)}")
                
            # # Resize back to original dimensions
            # logger.info(f"Resizing result back to original dimensions: {original_width}x{original_height}")
            # result_image = result_image.resize((original_width, original_height), Image.Resampling.LANCZOS)
                
            # Convert result back to bytes with higher quality
            output_buffer = io.BytesIO()
            result_image.save(output_buffer, format="JPEG", quality=95)
            processed_data = output_buffer.getvalue()
            
            # Update statistics
            self.processed_frames += 1
            self.last_processing_time = time.time() - start_time
            self.total_processing_time += self.last_processing_time
            
            logger.info(f"Frame processed in {self.last_processing_time:.2f}s (avg: {self.total_processing_time/self.processed_frames:.2f}s)")
            
            # Free memory
            torch.cuda.empty_cache()
                
            return processed_data, self.depth_map
            
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
            import traceback
            logger.error(traceback.format_exc())
            # Return original frame on error
            return frame_data, None

    def get_stats(self) -> dict[str, float]:
        """Get processing statistics."""
        return {
            "processed_frames": self.processed_frames,
            "total_time": self.total_processing_time,
            "average_time": self.total_processing_time / max(1, self.processed_frames),
            "last_time": self.last_processing_time,
            "inference_time": self.timings['inference']
        }


# Singleton processor and lock
processor = None
processor_lock = None
processor_init_in_progress = False

def get_processor(
    use_controlnet: bool, 
    strength: float,
    num_steps,
    **kwargs
) -> LightningDiffusionProcessor:
    """
    Get or create the Lightning processor singleton with robust error handling.
    
    Interface matches the diffusion_pipeline.py's get_processor function to allow
    for interchangeable use in the application.
    """
    global processor, processor_lock, processor_init_in_progress
    
    assert num_steps in [1, 2, 4, 8], f"Invalid number of steps: {num_steps}"
        
    # Initialize lock if not already created
    if processor_lock is None:
        import threading
        processor_lock = threading.Lock()
    
    # Before acquiring the lock, check if processor exists to avoid unnecessary waiting
    if processor is not None:
        logger.info("Reusing existing Lightning processor instance (fast path)")
        return processor
    
    # Use the lock to prevent race conditions when creating the processor
    acquired = False
    try:
        # Try to acquire the lock with a timeout to prevent deadlocks
        acquired = processor_lock.acquire(timeout=60)  # 60 second timeout
        if not acquired:
            raise RuntimeError(
                "Cannot acquire lock to initialize Lightning processor. " 
                "Another process is likely initializing it."
            )
        
        # Double-check after acquiring the lock (double-checked locking pattern)
        if processor is not None:
            logger.info("Lightning processor already initialized by another thread")
            return processor
        
        # Check if initialization is already in progress
        if processor_init_in_progress:
            raise RuntimeError(
                "Lightning processor initialization is already in progress by another thread. "
                "Please retry later."
            )
        
        # Mark initialization as in progress
        processor_init_in_progress = True
        
        # Create the processor
        logger.info(f"Creating new Lightning processor instance with {num_steps} steps")
        try:
            processor = LightningDiffusionProcessor(
                use_controlnet=use_controlnet, 
                strength=strength,
                num_steps=num_steps
            )
            
            # Initialization complete
            processor_init_in_progress = False
            return processor
        except Exception as e:
            # Reset initialization flag on error
            processor_init_in_progress = False
            logger.error(f"Error creating Lightning processor: {e}")
            raise
    finally:
        # Always release the lock if we acquired it
        if acquired:
            processor_lock.release()


# Function to process a base64 encoded frame
async def process_base64_frame(
    base64_frame: str, 
    processor: LightningDiffusionProcessor,
    prompt: str,
    negative_prompt: str | None,
    strength: float | None = None  # Add optional strength parameter
) -> str:
    """
    Process a base64 encoded frame and return the result as base64.
    
    Args:
        base64_frame: Base64 encoded image (with or without data:image prefix)
        processor: LightningDiffusionProcessor instance
        prompt: Optional style prompt
        negative_prompt: Negative prompt
        strength: Optional strength value to override processor default (0.0-1.0)
        
    Returns:
        Base64 encoded processed image (without data:image prefix)
    """
    try:
        # Validate the base64 string
        if not base64_frame or not isinstance(base64_frame, str):
            logger.warning(f"Invalid base64 frame: {type(base64_frame)}")
            return base64_frame
        
        # Remove potential data URL prefix (e.g., "data:image/jpeg;base64,")
        clean_base64 = base64_frame
        if base64_frame.startswith('data:'):
            try:
                clean_base64 = base64_frame.split(',', 1)[1]
                logger.debug("Extracted base64 data from data URL prefix")
            except IndexError:
                logger.warning("Invalid data URL format")
                return base64_frame
        
        # Decode base64 to bytes
        try:
            img_data = base64.b64decode(clean_base64, validate=True)
            logger.debug(f"Successfully decoded base64 data, size: {len(img_data)} bytes")
        except Exception as e:
            logger.warning(f"Base64 decoding error: {e}")
            return base64_frame
            
        # Process the frame
        processed_data, depth_image = await processor.process_frame(
            img_data, 
            prompt=prompt, 
            negative_prompt=negative_prompt,
            strength=strength  # Pass the strength parameter
        )
        
        # Encode back to base64
        processed_base64 = base64.b64encode(processed_data).decode('utf-8')
        logger.debug(f"Successfully encoded processed image, base64 size: {len(processed_base64)} chars")
        
        return processed_base64
    except Exception as e:
        logger.error(f"Error processing base64 frame: {e}")
        import traceback
        logger.error(traceback.format_exc())
        # Return original on error
        return base64_frame


# For modal.com integration
async def apply_lightning_diffusion(
    img_data: bytes,
    prompt: str,
    strength: float,
    num_steps: int,
    use_controlnet: bool,
    negative_prompt: str | None, #= "ugly, deformed, disfigured, poor details, bad anatomy",
    guidance_scale: float = 1.0,
) -> tuple[bytes, Image.Image | None]:
    """
    Apply the SDXL Lightning diffusion model to an image.
    
    Args:
        img_data: Raw bytes of the image
        prompt: Text prompt for generation (uses default style if None)
        negative_prompt: Negative prompt to guide generation
        guidance_scale: Guidance scale for the diffusion model
        use_controlnet: Whether to use ControlNet for better structure preservation
        strength: How strongly to apply the diffusion (0.0-1.0)
        num_steps: Number of inference steps (1, 2, 4, or 8)
        return_depth_map: Whether to return the depth map as well (only works with ControlNet)
        
    Returns:
        If return_depth_map is False or ControlNet is not used: Processed image bytes
        If return_depth_map is True and ControlNet is used: Tuple of (processed image bytes, depth map bytes)
    """
    # Get or create processor
    proc = get_processor(
        use_controlnet=use_controlnet,
        style_prompt=prompt,
        strength=strength,
        num_steps=num_steps
    )
    
    # Process the frame
    processed_bytes, depth_map = await proc.process_frame(
        img_data,
        prompt=prompt,
        negative_prompt=negative_prompt,
        guidance_scale=guidance_scale
    )
    
    return processed_bytes, depth_map