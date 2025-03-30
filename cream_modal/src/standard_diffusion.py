import time
import io
import base64
from typing import Optional, Dict

import torch
import numpy as np
from PIL import Image
from transformers import pipeline
from diffusers.models.controlnets.controlnet import ControlNetModel
from diffusers.pipelines.auto_pipeline import AutoPipelineForImage2Image

from src.utils.logger import logger

class LivestreamImageProcessor:
    def __init__(self, 
                 use_controlnet: bool, 
                 style_prompt: str, 
                 strength: float):
        """
        Initialize the livestream image processor.
        
        Args:
            use_controlnet: Whether to use ControlNet for better structure preservation
            style_prompt: The style prompt to apply to all frames
            strength: How strongly to apply the diffusion (0.0-1.0)
        """
        self.use_controlnet = use_controlnet
        self.style_prompt = style_prompt
        self.strength = strength
        
        # Setup pipeline first 
        self.setup_pipeline()
        
        # Initialize depth estimator if using ControlNet
        if use_controlnet:
            # Use CUDA if available, otherwise CPU
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info(f"Initializing depth estimator on {device}")
            
            try:
                self.depth_estimator = pipeline('depth-estimation', device=device)
                logger.info(f"Depth estimator initialized on {device}")
            except Exception as e:
                logger.error(f"Error initializing depth estimator on {device}: {e}")
                # Try with auto device mapping as fallback
                try:
                    self.depth_estimator = pipeline('depth-estimation', device_map="auto")
                    logger.info("Depth estimator initialized with auto device mapping")
                except Exception as e2:
                    logger.error(f"Error initializing depth estimator with auto mapping: {e2}")
                    raise RuntimeError(f"Failed to initialize depth estimator: {e2}")
        
        # Track metrics for monitoring
        self.processed_frames = 0
        self.total_processing_time = 0.0
        self.last_processing_time = 0.0
        
    def generate_depth_map(self, image: Image.Image) -> Image.Image:
        """Generate a depth map from an input image."""
        if not self.use_controlnet:
            raise ValueError("Depth map generation is only available when use_controlnet=True")
        
        # The depth estimator expects RGB images
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Get depth map from model
        try:
            logger.info(f"Generating depth map for image of size {image.size}")
            start_time = time.time()
            outputs = self.depth_estimator(image)
            depth_time = time.time() - start_time
            logger.info(f"Depth map generated in {depth_time:.2f}s")
            
            # Convert output tensor to numpy array
            if isinstance(outputs, Dict):
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
            
        except Exception as e:
            logger.info(f"Error in depth map generation: {e}")
            import traceback
            traceback.print_exc()
            
            # Create a fallback grayscale image from the input
            logger.info("Creating fallback depth map")
            # Convert to grayscale as a simple fallback
            gray_image = image.convert('L')
            return gray_image
        
    def setup_pipeline(self):
        """Initialize the pipeline with or without ControlNet."""
        # Determine device based on availability
        device = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"Setting up pipeline on {device}")
        
        # Use half precision for GPU, full precision for CPU
        torch_dtype = torch.float16 if device == "cuda" else torch.float32
        
        # Clear CUDA cache if using GPU
        if device == "cuda":
            try:
                torch.cuda.empty_cache()
                torch.cuda.synchronize()
                logger.info("Cleared CUDA cache and synchronized")
            except Exception as e:
                logger.warning(f"Error clearing CUDA cache: {e}")
        
        # Try to initialize with a few retries
        max_retries = 3
        current_retry = 0
        success = False
        
        while not success and current_retry < max_retries:
            if current_retry > 0:
                logger.info(f"Retry attempt {current_retry}/{max_retries} for pipeline setup")
                time.sleep(5 * current_retry)
                if device == "cuda":
                    try:
                        torch.cuda.empty_cache()
                        torch.cuda.synchronize()
                        logger.info("Re-cleared CUDA cache before retry")
                    except Exception:
                        pass
            
            try:
                # Load the models
                if self.use_controlnet:
                    logger.info(f"Setting up pipeline with ControlNet on {device}")
                    controlnet = ControlNetModel.from_pretrained(
                        "lllyasviel/control_v11f1p_sd15_depth",
                        torch_dtype=torch_dtype,
                        use_safetensors=True
                    )
                    self.pipeline = AutoPipelineForImage2Image.from_pretrained(
                        "runwayml/stable-diffusion-v1-5",
                        controlnet=controlnet,
                        torch_dtype=torch_dtype,
                        use_safetensors=True
                    )
                else:
                    logger.info(f"Setting up basic pipeline on {device}")
                    self.pipeline = AutoPipelineForImage2Image.from_pretrained(
                        "stabilityai/stable-diffusion-xl-refiner-1.0", 
                        torch_dtype=torch_dtype,
                        use_safetensors=True
                    )
                
                # Move pipeline to the selected device
                logger.info(f"Moving pipeline to {device}")
                self.pipeline.to(device)
                logger.info(f"Pipeline successfully moved to {device}")
                
                # Apply memory optimizations if on CUDA
                if device == "cuda":
                    # Enable attention slicing for lower memory usage
                    if hasattr(self.pipeline, "enable_attention_slicing"):
                        self.pipeline.enable_attention_slicing()
                        logger.info("Enabled attention slicing for memory optimization")
                    
                    # Enable xformers memory efficient attention if available
                    try:
                        if hasattr(self.pipeline, "enable_xformers_memory_efficient_attention"):
                            self.pipeline.enable_xformers_memory_efficient_attention()
                            logger.info("Enabled xformers memory efficient attention")
                    except ImportError:
                        logger.info("xformers not available, continuing without it")
                    
                    # Optimize for inference
                    if hasattr(self.pipeline, "enable_model_cpu_offload"):
                        self.pipeline.enable_model_cpu_offload()
                        logger.info("Enabled model CPU offload")
            
                # Store the device for later use
                self.device = device
                
                logger.info(f"Pipeline configured to run on {device} with {torch_dtype}")
                
                # Log device information
                if device == "cuda":
                    logger.info(f"CUDA available: {torch.cuda.is_available()}")
                    logger.info(f"CUDA device count: {torch.cuda.device_count()}")
                    logger.info(f"CUDA device name: {torch.cuda.get_device_name(0)}")
                    logger.info(f"CUDA device capability: {torch.cuda.get_device_capability(0)}")
                    logger.info(f"CUDA memory allocated: {torch.cuda.memory_allocated() / 1024**2:.2f} MB")
                    logger.info(f"CUDA memory reserved: {torch.cuda.memory_reserved() / 1024**2:.2f} MB")
                else:
                    logger.info("Running on CPU - performance may be limited")
                
                # Mark setup as successful
                success = True
                return True
                
            except Exception as e:
                logger.error(f"Error during pipeline setup (attempt {current_retry+1}/{max_retries}): {e}")
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                
                # Increment retry counter
                current_retry += 1
        
        # If we get here, all retries failed
        if not success:
            logger.error(f"All {max_retries} setup attempts failed")
            raise RuntimeError("Failed to initialize pipeline after multiple attempts")
    async def process_frame(
        self,
        frame_data: bytes,
        prompt: Optional[str] = None,
        negative_prompt: str | None = None,
        guidance_scale: float = 7.0,
        strength: float | None = None  # Add optional strength parameter
    ) -> tuple[bytes, Image.Image | None]:
        """
        Process a single frame for livestreaming.
        
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
        
        # Use the class default prompt if none provided
        if prompt is None:
            prompt = self.style_prompt
            
        # Validate input
        if not frame_data or len(frame_data) == 0:
            logger.info("Error: Empty frame data received")
            return frame_data, None
            
        logger.info(f"Processing frame with {len(frame_data)} bytes")
            
        # Convert bytes to PIL Image
        try:
            input_buffer = io.BytesIO(frame_data)
            input_image = Image.open(input_buffer)
            
            # Log image details for debugging
            logger.info(f"Image format: {input_image.format}, size: {input_image.size}, mode: {input_image.mode}")
            
            # Ensure RGB mode
            if input_image.mode != 'RGB':
                input_image = input_image.convert('RGB')
                
            # Store original dimensions to restore later
            original_width, original_height = input_image.size
        except Exception as e:
            logger.error(f"Error opening image: {e}")
            # Try to get more info about the data
            try:
                header_bytes = frame_data[:20]
                header_hex = ' '.join(f'{b:02x}' for b in header_bytes)
                logger.info(f"Image data header: {header_hex}")
            except Exception:
                pass
            # Return original frame on error

            return frame_data, None
        
        # Resize for processing while maintaining aspect ratio
        # Using a balanced size that's good for diffusion model performance
        processing_size = 768  # Higher quality processing size
        target_size = 512     # Size for model input
        
        # Calculate resize dimensions for processing while preserving aspect ratio
        if original_width > original_height:
            # Landscape orientation
            new_width = min(processing_size, original_width)
            new_height = int(original_height * (new_width / original_width))
        else:
            # Portrait or square orientation
            new_height = min(processing_size, original_height)
            new_width = int(original_width * (new_height / original_height))
                
        logger.info(f"Resizing from {original_width}x{original_height} to {new_width}x{new_height} for processing")
        processing_image = input_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
        
        # For diffusion model input, we might need to further resize to target_size
        # but we'll keep the processing_image at higher resolution
        if new_width > target_size or new_height > target_size:
            if new_width > new_height:
                model_width = target_size
                model_height = int(new_height * (target_size / new_width))
            else:
                model_height = target_size
                model_width = int(new_width * (target_size / new_height))
            
            logger.info(f"Resizing to {model_width}x{model_height} for model input")
            model_input_image = processing_image.resize((model_width, model_height), Image.Resampling.LANCZOS)
        else:
            # Image is already small enough for model input
            model_input_image = processing_image
        
        try:
            # Free CUDA memory if needed
            torch.cuda.empty_cache()
            
            # Process with the appropriate pipeline
            if self.use_controlnet:
                # Generate depth map for ControlNet
                depth_image = self.generate_depth_map(model_input_image)
                
                # Process with ControlNet
                generation_start = time.time()
                logger.info(f"Processing with controlnet pipeline, strength={current_strength}")
                result_image = self.pipeline(
                    prompt,
                    image=model_input_image,
                    control_image=depth_image,
                    strength=current_strength,  # Use custom strength if provided
                    guidance_scale=guidance_scale,
                    negative_prompt=negative_prompt,
                    num_steps=25,  # Slightly increased for better quality
                ).images[0]
                generation_time = time.time() - generation_start
                logger.info(f"Image generation took {generation_time:.2f}s")
            else:
                # Process without ControlNet
                generation_start = time.time()
                logger.info(f"Processing with standard pipeline, strength={current_strength}")
                result_image = self.pipeline(
                    prompt,
                    image=model_input_image,
                    strength=current_strength,  # Use custom strength if provided
                    guidance_scale=guidance_scale,
                    negative_prompt=negative_prompt,
                    num_steps=25,  # Slightly increased for better quality
                ).images[0]
                generation_time = time.time() - generation_start
                logger.info(f"Image generation took {generation_time:.2f}s")
                depth_image = None
            
            # Resize back to original dimensions
            logger.info(f"Resizing result back to original dimensions: {original_width}x{original_height}")
            result_image = result_image.resize((original_width, original_height), Image.Resampling.LANCZOS)
                
            # Convert result back to bytes with higher quality
            output_buffer = io.BytesIO()
            result_image.save(output_buffer, format="JPEG", quality=95)  # Higher quality output
            processed_data = output_buffer.getvalue()
            
            # Update statistics
            self.processed_frames += 1
            self.last_processing_time = time.time() - start_time
            self.total_processing_time += self.last_processing_time
            
            logger.info(f"Frame processed in {self.last_processing_time:.2f}s (avg: {self.total_processing_time/self.processed_frames:.2f}s)")
            
            # Free memory
            torch.cuda.empty_cache()
                
            return processed_data, depth_image
            
        except Exception as e:
            logger.info(f"Error processing frame: {e}")
            import traceback
            traceback.print_exc()
            # Return original frame on error
            return frame_data, None

    def get_stats(self) -> Dict[str, float]:
        """Get processing statistics."""
        return {
            "processed_frames": self.processed_frames,
            "total_time": self.total_processing_time,
            "average_time": self.total_processing_time / max(1, self.processed_frames),
            "last_time": self.last_processing_time
        }


# Function to process a base64 encoded frame
async def process_base64_frame(
    base64_frame: str, 
    processor: LivestreamImageProcessor,
    prompt: Optional[str] = None,
    negative_prompt: str | None = None,
    strength: float | None = None  # Add optional strength parameter
) -> str:
    """
    Process a base64 encoded frame and return the result as base64.
    
    Args:
        base64_frame: Base64 encoded image (with or without data:image prefix)
        processor: LivestreamImageProcessor instance
        prompt: Optional style prompt
        negative_prompt: Optional negative prompt
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
            # Extract the actual base64 content
            try:
                clean_base64 = base64_frame.split(',', 1)[1]
                logger.debug("Extracted base64 data from data URL prefix")
            except IndexError:
                logger.warning("Invalid data URL format")
                return base64_frame
        
        # Decode base64 to bytes
        try:
            img_data = base64.b64decode(clean_base64)
            logger.debug(f"Successfully decoded base64 data, size: {len(img_data)} bytes")
        except Exception as e:
            logger.warning(f"Base64 decoding error: {e}")
            return base64_frame
            
        # Process the frame
        processed_data, _ = await processor.process_frame(
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


# Create a singleton processor instance
# This allows reusing the same model across requests
processor = None
processor_lock = None  # Lock to prevent race conditions
processor_init_in_progress = False  # Flag to track initialization status

def get_processor(
    use_controlnet: bool = True, 
    style_prompt: str = "Van Gogh style painting",
    strength: float = 0.6
) -> LivestreamImageProcessor:
    """Get or create the processor singleton with robust error handling."""
    global processor, processor_lock, processor_init_in_progress
    
    # Initialize lock if not already created
    if processor_lock is None:
        import threading
        processor_lock = threading.Lock()
    
    # Before acquiring the lock, check if processor exists to avoid unnecessary waiting
    if processor is not None:
        logger.info("Reusing existing processor instance (fast path)")
        return processor
    
    # Use the lock to prevent race conditions when creating the processor
    acquired = False
    try:
        # Try to acquire the lock with a timeout to prevent deadlocks
        acquired = processor_lock.acquire(timeout=60)  # 60 second timeout (increased)
        if not acquired:
            # Only one process should be allowed to create the processor at a time
            # If we can't acquire the lock, raise an error
            raise RuntimeError(
                "Cannot acquire lock to initialize processor. " 
                "Another process is likely initializing it. "
                "To prevent CUDA contention, only one GPU process can run at a time."
            )
        
        # Double-check after acquiring the lock (double-checked locking pattern)
        if processor is not None:
            logger.info("Processor already initialized by another thread")
            return processor
        
        # Check if initialization is already in progress
        if processor_init_in_progress:
            raise RuntimeError(
                "Processor initialization is already in progress by another thread. "
                "To prevent CUDA contention, please retry later."
            )
        
        # Mark initialization as in progress
        processor_init_in_progress = True
        
        # Create the processor - we'll never fall back to CPU
        logger.info("Creating new image processor instance with GPU")
        try:
            processor = LivestreamImageProcessor(
                use_controlnet=use_controlnet, 
                style_prompt=style_prompt,
                strength=strength
            )
            logger.info("Processor created and models loaded successfully")
            
            # Initialization complete
            processor_init_in_progress = False
            return processor
        except Exception as e:
            # Reset initialization flag on error
            processor_init_in_progress = False
            logger.error(f"Error creating processor: {e}")
            # Re-raise the exception - we don't want to fall back to CPU
            raise
    finally:
        # Always release the lock if we acquired it
        if acquired:
            processor_lock.release()


# For modal.com integration
async def apply_diffusion_model(
    img_data: bytes,
    prompt: str,
    negative_prompt: str | None = "ugly, deformed, disfigured, poor details, bad anatomy",
    guidance_scale: float = 7.0,
    use_controlnet: bool = True,
    style_prompt: str = "Van Gogh style painting",
    strength: float = 0.6,
    output_size: Optional[tuple] = None
) -> tuple[bytes, Image.Image | None]:
    """
    Apply the diffusion model to an image.
    This function is called from the WebSocket handler.
    
    Args:
        img_data: Raw bytes of the image
        prompt: Text prompt for generation (uses default style if None)
        negative_prompt: Negative prompt to guide generation
        guidance_scale: Guidance scale for the diffusion model
        use_controlnet: Whether to use ControlNet for better structure preservation
        style_prompt: The style prompt to apply if prompt is None
        strength: How strongly to apply the diffusion (0.0-1.0)
        output_size: Optional tuple of (width, height) to resize the output image
        
    Returns:
        Processed image bytes
    """
    # Get or create processor
    proc = get_processor(
        use_controlnet=use_controlnet,
        style_prompt=style_prompt,
        strength=strength
    )
    
    # Process the frame
    processed_bytes, depth_image = await proc.process_frame(
        img_data,
        prompt=prompt,
        negative_prompt=negative_prompt,
        guidance_scale=guidance_scale
    )
    
    # Resize the output if requested
    if output_size is not None and len(output_size) == 2:
        try:
            # Convert bytes to PIL Image
            output_buffer = io.BytesIO(processed_bytes)
            output_image = Image.open(output_buffer)
            
            # Ensure RGB mode
            if output_image.mode != 'RGB':
                output_image = output_image.convert('RGB')
                
            # Resize to requested dimensions
            width, height = output_size
            logger.info(f"Resizing output to requested dimensions: {width}x{height}")
            resized_image = output_image.resize((width, height), Image.Resampling.LANCZOS)
            
            # Convert back to bytes
            resized_buffer = io.BytesIO()
            resized_image.save(resized_buffer, format="JPEG", quality=95)
            return resized_buffer.getvalue(), depth_image
        except Exception as e:
            logger.error(f"Error resizing output image: {e}")
            # Return the processed image without resizing on error
            return processed_bytes, depth_image
    
    return processed_bytes, depth_image