"""
Unified interface for diffusion processors.

This module provides a unified interface to access both the standard diffusion
processor and the SDXL Lightning diffusion processor.
"""

from typing import Optional, Union, Tuple, Literal
from PIL import Image

from src.utils.logger import logger

# Import diffusion_pipeline dynamically to handle cases where it might not be available
import src.standard_diffusion as sd

HAS_STANDARD_PROCESSOR = True


# Import lightning_diffusion dynamically to handle cases where it might not be available
import src.lightning_diffusion as ld
HAS_LIGHTNING_PROCESSOR = True

ProcessorType = Literal["standard", "lightning"]

def get_diffusion_processor(
    processor_type: ProcessorType = "standard",
    **kwargs
) -> Union[sd.LivestreamImageProcessor, ld.LightningDiffusionProcessor]:
    """
    Get the appropriate diffusion processor based on the specified type.
    
    Args:
        processor_type: Which diffusion processor to use ("standard" or "lightning")
        **kwargs: Additional keyword arguments forwarded to the specific processor function.
            Common parameters for both processors:
              - use_controlnet: Whether to use ControlNet for better structure preservation
              - style_prompt: The style prompt to apply to all frames
              - strength: How strongly to apply the diffusion (0.0-1.0)
            
            Standard processor additional parameters:
              - guidance_scale: Guidance scale for the diffusion model
              - negative_prompt: Negative prompt to guide generation
              - num_steps: Number of diffusion steps
              - model_name: Model name for standard processor
              - controlnet_model_name: ControlNet model name for standard processor
              - image_size: Target size for model input
              - processing_size: Size for initial processing
              
            Lightning processor additional parameters:
              - guidance_scale: Guidance scale for the diffusion model
              - negative_prompt: Negative prompt to guide generation
              - num_steps: Number of diffusion steps (1, 2, 4, or 8)
        
    Returns:
        The appropriate diffusion processor instance
    
    Raises:
        ImportError: If the requested processor type is not available
        RuntimeError: If no processor types are available
    """
    if not (HAS_STANDARD_PROCESSOR or HAS_LIGHTNING_PROCESSOR):
        raise RuntimeError("No diffusion processors are available")
    
    if processor_type == "lightning":
        if not HAS_LIGHTNING_PROCESSOR:
            logger.warning("Lightning processor requested but not available, falling back to standard")
            processor_type = "standard"
            if not HAS_STANDARD_PROCESSOR:
                raise ImportError("Lightning processor requested but neither processor is available")
    elif processor_type == "standard":
        if not HAS_STANDARD_PROCESSOR:
            logger.warning("Standard processor requested but not available, falling back to lightning")
            processor_type = "lightning"
            if not HAS_LIGHTNING_PROCESSOR:
                raise ImportError("Standard processor requested but neither processor is available")
    else:
        raise ValueError(f"Unknown processor type: {processor_type}")
    
    logger.info(f"Using {processor_type} diffusion processor")
    
    if processor_type == "lightning":
        return ld.get_processor(**kwargs)
    else:  # standard
        return sd.get_processor(**kwargs)

async def process_base64_frame(
    base64_frame: str,
    processor: Union[sd.LivestreamImageProcessor, ld.LightningDiffusionProcessor],
    prompt: str,
    negative_prompt: str | None = None,
    strength: float | None = None
) -> str:
    """
    Process a base64 encoded frame using the provided processor.
    
    This function delegates to the appropriate base64 processing function
    based on the type of the provided processor.
    
    Args:
        base64_frame: Base64 encoded image (with or without data:image prefix)
        processor: Diffusion processor instance (either standard or lightning)
        prompt: Optional style prompt
        negative_prompt: Optional negative prompt
        strength: Optional strength value to override processor default (0.0-1.0)
        
    Returns:
        Base64 encoded processed image (without data:image prefix)
    """
    if HAS_LIGHTNING_PROCESSOR and isinstance(processor, ld.LightningDiffusionProcessor):
        # Type-safe call for Lightning processor
        from typing import cast
        lightning_processor = cast(ld.LightningDiffusionProcessor, processor)
        return await ld.process_base64_frame(base64_frame, lightning_processor, prompt, negative_prompt, strength)
    elif HAS_STANDARD_PROCESSOR:
        # Type-safe call for Standard processor
        from typing import cast
        standard_processor = cast(sd.LivestreamImageProcessor, processor)
        return await sd.process_base64_frame(base64_frame, standard_processor, prompt, negative_prompt, strength)
    else:
        logger.error(f"Unknown processor type: {type(processor)}")
        return base64_frame

async def apply_diffusion(
    img_data: bytes,
    prompt: str,
    processor_type: ProcessorType = "standard",
    negative_prompt: str = "ugly, deformed, disfigured, poor details, bad anatomy",
    guidance_scale: float = 7.0,
    use_controlnet: bool = True,
    style_prompt: str = "Van Gogh style painting",
    strength: float = 0.7,
    num_steps: int = 25,
    output_size: Optional[Tuple[int, int]] = None
) -> tuple[bytes, Image.Image | None]:
    """
    Apply diffusion to an image using either standard or lightning processor.
    
    This is a unified interface that works with both processor types.
    
    Args:
        img_data: Raw bytes of the image
        processor_type: Which diffusion processor to use ("standard" or "lightning")
        prompt: Text prompt for generation (uses default style if None)
        negative_prompt: Negative prompt to guide generation
        guidance_scale: Guidance scale for the diffusion model
        use_controlnet: Whether to use ControlNet for better structure preservation
        style_prompt: The style prompt to apply if prompt is None
        strength: How strongly to apply the diffusion (0.0-1.0)
        num_steps: Number of diffusion steps
        output_size: Optional tuple of (width, height) to resize the output image
        
    Returns:
        Processed image bytes
    """
    if processor_type == "lightning" and HAS_LIGHTNING_PROCESSOR:
        from src.lightning_diffusion import apply_lightning_diffusion
        return await apply_lightning_diffusion(
            img_data=img_data,
            prompt=prompt,
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            use_controlnet=use_controlnet,
            strength=strength,
            num_steps=num_steps,
        )
    elif processor_type == "standard" and HAS_STANDARD_PROCESSOR:
        from src.standard_diffusion import apply_diffusion_model
        return await apply_diffusion_model(
            img_data=img_data,
            prompt=prompt,
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            use_controlnet=use_controlnet,
            style_prompt=style_prompt,
            strength=strength,
            output_size=output_size
        )
    else:
        available = []
        if HAS_STANDARD_PROCESSOR:
            available.append("standard")
        if HAS_LIGHTNING_PROCESSOR:
            available.append("lightning")
            
        if not available:
            raise RuntimeError("No diffusion processors are available")
            
        # Fall back to an available processor
        logger.warning(f"Requested processor '{processor_type}' not available. Using {available[0]}")
        return await apply_diffusion(
            img_data=img_data,
            processor_type=available[0],
            prompt=prompt,
            negative_prompt=negative_prompt,
            guidance_scale=guidance_scale,
            use_controlnet=use_controlnet,
            style_prompt=style_prompt,
            strength=strength,
            num_steps=num_steps,
            output_size=output_size
        ) 