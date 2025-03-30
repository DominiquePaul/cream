import asyncio
from modal import Image, App, fastapi_endpoint, asgi_app, Secret
import os
import logging
import time

from src.utils.logger import logger
from src.diffusion_processor import get_diffusion_processor, process_base64_frame

# Define default style prompt as a constant
DEFAULT_STYLE_PROMPT = "A painting in the style of van Gogh's 'Starry Night'"

app = App("cream-livestream-processor")

# Function to run during image building
def build_initialize_models():
    """
    This function runs during image building and calls the same initialization 
    function used at runtime to ensure consistency.
    """
    from src.utils.logger import logger
    
    logger.info("Initializing models during image building...")
    
    try:
        # Import the processor modules
        from src.diffusion_processor import get_diffusion_processor
        
        # Configuration for both processors - just for initialization
        standard_processor_config = {
            "use_controlnet": True,
            "style_prompt": "A painting in the style of van Gogh's 'Starry Night'",
            "strength": 0.9
        }

        lightning_processor_config = {
            "use_controlnet": True,
            "style_prompt": "A painting in the style of van Gogh's 'Starry Night'",
            "strength": 0.9,
            "num_steps": 4
        }
        
        # Initialize both processors during build
        logger.info("Initializing standard diffusion processor...")
        standard_processor = get_diffusion_processor(
            processor_type="standard",
            **standard_processor_config
        )
        
        logger.info("Initializing lightning diffusion processor...")
        lightning_processor = get_diffusion_processor(
            processor_type="lightning",
            **lightning_processor_config
        )
        
        # Free up memory (these won't be used yet)
        del standard_processor, lightning_processor
        
        # Try to clean up GPU memory
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            
        logger.info("All models successfully initialized during image build!")
        return True
    except Exception as e:
        logger.error(f"Error initializing models during build: {e}")
        # Include full traceback for debugging
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        # Re-raise to fail the build if initialization fails
        raise

# IMPORTANT: Modal requires the run_function call to come BEFORE add_local_* methods
ml_image = (Image
            .debian_slim(python_version="3.12")
            .run_commands(
                "pip install --upgrade pip",
            ) 
            .poetry_install_from_file(
                poetry_pyproject_toml="./pyproject.toml",
                poetry_lockfile="./poetry.lock",
                without=["dev"],
            )
            .run_function(build_initialize_models)  # Initialize models during build
            .add_local_python_source("src")
            .add_local_python_source("_remote_module_non_scriptable"))

# Global processors dictionary that will be populated during container startup
global_processors = {}

# Initialize processors once at startup
def init_global_processors():
    """Initialize the model processors once during container startup"""
    global global_processors
    
    if global_processors:  # Already initialized
        logger.info("Using existing initialized processors")
        return global_processors
    
    logger.info("Initializing global image processors during container startup...")
    
    # Configuration for both processors
    standard_processor_config = {
        "use_controlnet": True,
        "style_prompt": DEFAULT_STYLE_PROMPT,
        "strength": 0.9
    }

    lightning_processor_config = {
        "use_controlnet": True,
        "style_prompt": DEFAULT_STYLE_PROMPT,
        "strength": 0.9,
        "num_steps": 4
    }
    
    # Standard processor with more steps
    # standard_processor = get_diffusion_processor(
    #     processor_type="standard",
    #     **standard_processor_config
    # )
    
    # Lightning processor with fewer steps
    lightning_processor = get_diffusion_processor(
        processor_type="lightning",
        **lightning_processor_config
    )

    global_processors = {
        # "standard": standard_processor,
        "lightning": lightning_processor
    }
    
    logger.info("Global processors initialized successfully")
    return global_processors

init_global_processors()

# Health check endpoint - no need for GPU
@app.function(image=ml_image, allow_concurrent_inputs=50, secrets=[Secret.from_name("custom-secret"), Secret.from_name("huggingface")])
@fastapi_endpoint(method="GET")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "livestream-processor"}

# Native Modal WebSocket server
@app.function(
    image=ml_image, 
    allow_concurrent_inputs=10, 
    secrets=[Secret.from_name("custom-secret"), Secret.from_name("huggingface")], 
    gpu="H100",
    timeout=600  # Increase timeout to 10 minutes
)
@asgi_app()
def websocket_server():
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Query
    
    app = FastAPI(title="Livestream Processor WebSocket Server")
    active_connections = {}
    streams = {}
    
    # Use the pre-initialized global processors
    logger.info(f"WebSocket server using pre-initialized processors: {list(global_processors.keys())}")
    
    @app.websocket("/ws/{client_type}/{stream_id}")
    async def websocket_endpoint(
        websocket: WebSocket, 
        client_type: str, 
        stream_id: str,
        processor_type: str = Query("lightning", description="Processor type: 'standard' or 'lightning'")
    ):
        # Validate processor type
        if processor_type not in global_processors:
            logger.warning(f"Invalid processor type: {processor_type}, using standard")
            processor_type = "standard"
                
        logger.info(f"Using {processor_type} processor for stream {stream_id}")
        
        await websocket.accept()
        
        # Initialize connections for this stream
        if stream_id not in active_connections:
            active_connections[stream_id] = {"broadcasters": [], "viewers": []}
        
        # Add this connection to the right group
        if client_type == "broadcaster":
            active_connections[stream_id]["broadcasters"].append(websocket)
            logger.info(f"Broadcaster connected to stream {stream_id}")
            
            # Initialize stream data
            if stream_id not in streams:
                streams[stream_id] = {
                    "processing": False,
                    "latest_frame": None,
                    "style_prompt": DEFAULT_STYLE_PROMPT,
                    "negative_prompt": "ugly, deformed, disfigured, poor details, bad anatomy",
                    "processor_type": processor_type,
                    "strength": 0.9  # Add default strength parameter
                }
            else:
                # Update processor type for existing stream
                streams[stream_id]["processor_type"] = processor_type
                
            # Notify broadcaster of selected processor type
            await websocket.send_json({
                "type": "processor_info",
                "processor_type": processor_type,
                "message": f"Using {processor_type} processor for image processing"
            })
            
        elif client_type == "viewer":
            active_connections[stream_id]["viewers"].append(websocket)
            logger.info(f"Viewer connected to stream {stream_id}")
            
            # Send the current style prompt to new viewer
            if stream_id in streams and "style_prompt" in streams[stream_id]:
                current_prompt = streams[stream_id]["style_prompt"]
                current_processor = streams[stream_id].get("processor_type", "standard")
                
                await websocket.send_json({
                    "type": "style_updated",
                    "prompt": current_prompt,
                    "processor_type": current_processor
                })
                logger.info(f"Sent current style prompt to new viewer for stream {stream_id}: '{current_prompt}'")
        else:
            await websocket.close(code=1008, reason="Invalid client type")
            return
            
        try:
            while True:
                with logger.span("websocket_receive"):
                    data = await websocket.receive_json()
                    
                    if "type" not in data:
                        await websocket.send_json({"error": "Invalid message format"})
                        continue
                    
                    if data["type"] == "frame" and client_type == "broadcaster":
                        with logger.span("process_frame"):
                            # Get frame data
                            frame = data.get("frame", "")
                            
                            # Validate frame data
                            if not frame:
                                logger.warning(f"Empty frame data received for stream {stream_id}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "Empty frame data received"
                                })
                                continue
                            
                            # Check if it's a data URL and extract the base64 part if needed
                            if isinstance(frame, str) and frame.startswith('data:'):
                                try:
                                    # Extract the actual base64 content
                                    frame = frame.split(',', 1)[1]
                                    logger.debug(f"Extracted base64 data from data URL for stream {stream_id}")
                                except IndexError:
                                    logger.warning(f"Invalid data URL format for stream {stream_id}")
                                    await websocket.send_json({
                                        "type": "error",
                                        "message": "Invalid data URL format"
                                    })
                                    continue
                            
                            # Check frame size (Modal has a 2MB limit on WebSocket messages)
                            frame_size_mb = len(frame) / (1024 * 1024)
                            if frame_size_mb > 1.9:  # Leave some margin below 2MB
                                logger.warning(f"Frame size too large: {frame_size_mb:.2f}MB, max allowed is 1.9MB")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"Frame size too large: {frame_size_mb:.2f}MB, max allowed is 1.9MB"
                                })
                                continue
                                
                            # Store the latest frame
                            streams[stream_id]["latest_frame"] = frame
                            
                            # Process frame if not already processing
                            if not streams[stream_id]["processing"]:
                                # Mark as processing
                                streams[stream_id]["processing"] = True
                                
                                # Get the appropriate processor
                                current_processor_type = streams[stream_id].get("processor_type", "standard")
                                processor = global_processors[current_processor_type]
                                
                                logger.info(f"Starting to process frame for stream {stream_id}")
                                
                                # Process frame asynchronously
                                asyncio.create_task(
                                    process_and_broadcast_frame(
                                        stream_id, 
                                        streams[stream_id]["latest_frame"],
                                        active_connections[stream_id]["viewers"],
                                        processor,
                                        current_processor_type
                                    )
                                )
                            else:
                                # Already processing - just store the latest frame and notify the client that we're skipping immediate processing
                                await websocket.send_json({
                                    "type": "frame_skipped",
                                    "message": "Frame received but skipped processing (will be processed later if still the latest frame)"
                                })
                                logger.info(f"Received frame for stream {stream_id} - stored as latest frame but skipping immediate processing")
                    
                    # Handle prompt updates from broadcaster
                    elif data["type"] == "update_prompt" and client_type == "broadcaster":
                        with logger.span("update_prompt") as prompt_span:
                            new_prompt = data.get("prompt", "")
                            
                            if not new_prompt:
                                logger.warning(f"Empty prompt received for stream {stream_id}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": "Empty prompt received"
                                })
                                continue
                            
                            # Update the prompt for this stream
                            if stream_id in streams:
                                old_prompt = streams[stream_id]["style_prompt"]
                                streams[stream_id]["style_prompt"] = new_prompt
                                logger.info(f"Updated prompt for stream {stream_id}: '{old_prompt}' -> '{new_prompt}'")
                                
                                # Confirm to the broadcaster
                                await websocket.send_json({
                                    "type": "prompt_updated",
                                    "prompt": new_prompt
                                })
                                
                                # Also notify viewers about the style change
                                for viewer in active_connections[stream_id]["viewers"]:
                                    try:
                                        await viewer.send_json({
                                            "type": "style_updated",
                                            "prompt": new_prompt
                                        })
                                    except Exception as e:
                                        logger.error(f"Error notifying viewer of style update: {e}")
                    
                    # Handle processor type updates from broadcaster
                    elif data["type"] == "update_processor" and client_type == "broadcaster":
                        with logger.span("update_processor") as processor_span:
                            new_processor_type = data.get("processor_type", "standard")
                            
                            # Validate processor type
                            if new_processor_type not in global_processors:
                                logger.warning(f"Invalid processor type: {new_processor_type}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"Invalid processor type: {new_processor_type}"
                                })
                                continue
                        
                            
                            # Update the processor type for this stream
                            if stream_id in streams:
                                old_processor_type = streams[stream_id].get("processor_type", "standard")
                                streams[stream_id]["processor_type"] = new_processor_type
                                logger.info(f"Updated processor type for stream {stream_id}: '{old_processor_type}' -> '{new_processor_type}'")
                                
                                # Confirm to the broadcaster
                                await websocket.send_json({
                                    "type": "processor_updated",
                                    "processor_type": new_processor_type
                                })
                                
                                # Also notify viewers about the processor change
                                for viewer in active_connections[stream_id]["viewers"]:
                                    try:
                                        await viewer.send_json({
                                            "type": "processor_updated",
                                            "processor_type": new_processor_type
                                        })
                                    except Exception as e:
                                        logger.error(f"Error notifying viewer of processor update: {e}")
                    
                    # Handle negative prompt updates from broadcaster
                    elif data["type"] == "update_negative_prompt" and client_type == "broadcaster":
                        with logger.span("update_negative_prompt") as neg_prompt_span:
                            new_negative_prompt = data.get("negative_prompt", "")
                            
                            # Update the negative prompt for this stream
                            if stream_id in streams:
                                old_negative_prompt = streams[stream_id].get("negative_prompt", "")
                                streams[stream_id]["negative_prompt"] = new_negative_prompt
                                logger.info(f"Updated negative prompt for stream {stream_id}: '{old_negative_prompt}' -> '{new_negative_prompt}'")
                                
                                # Confirm to the broadcaster
                                await websocket.send_json({
                                    "type": "negative_prompt_updated",
                                    "negative_prompt": new_negative_prompt
                                })
                                
                                # Also notify viewers about the negative prompt change
                                for viewer in active_connections[stream_id]["viewers"]:
                                    try:
                                        await viewer.send_json({
                                            "type": "negative_prompt_updated",
                                            "negative_prompt": new_negative_prompt
                                        })
                                    except Exception as e:
                                        logger.error(f"Error notifying viewer of negative prompt update: {e}")
                    
                    # Handle strength parameter updates from broadcaster
                    elif data["type"] == "update_strength" and client_type == "broadcaster":
                        with logger.span("update_strength") as strength_span:
                            try:
                                new_strength = float(data.get("strength", 0.9))
                                # Validate strength is within valid range
                                if not (0.1 <= new_strength <= 1.0):
                                    raise ValueError(f"Strength must be between 0.1 and 1.0, got {new_strength}")
                                
                                # Update the strength for this stream
                                if stream_id in streams:
                                    old_strength = streams[stream_id].get("strength", 0.9)
                                    streams[stream_id]["strength"] = new_strength
                                    logger.info(f"Updated strength for stream {stream_id}: {old_strength} -> {new_strength}")
                                    
                                    # Confirm to the broadcaster
                                    await websocket.send_json({
                                        "type": "strength_updated",
                                        "strength": new_strength
                                    })
                                    
                                    # Also notify viewers about the strength change
                                    for viewer in active_connections[stream_id]["viewers"]:
                                        try:
                                            await viewer.send_json({
                                                "type": "strength_updated",
                                                "strength": new_strength
                                            })
                                        except Exception as e:
                                            logger.error(f"Error notifying viewer of strength update: {e}")
                            except (ValueError, TypeError) as e:
                                logger.warning(f"Invalid strength value: {e}")
                                await websocket.send_json({
                                    "type": "error",
                                    "message": f"Invalid strength value: {e}"
                                })
                    
                    elif data["type"] == "ping":
                        with logger.span("ping"):
                            await websocket.send_json({"type": "pong"})
                    
                    # Handle request for current style prompt
                    elif data["type"] == "get_style_prompt" and client_type == "viewer":
                        with logger.span("get_style_prompt") as style_span:
                            if stream_id in streams and "style_prompt" in streams[stream_id]:
                                current_prompt = streams[stream_id]["style_prompt"]
                                await websocket.send_json({
                                    "type": "style_updated",
                                    "prompt": current_prompt
                                })
                                logger.info(f"Sent current style prompt in response to request for stream {stream_id}: '{current_prompt}'")
                    
                    # Handle request for processor info
                    elif data["type"] == "get_processor_info":
                        with logger.span("get_processor_info") as info_span:
                            if stream_id in streams and "processor_type" in streams[stream_id]:
                                current_processor = streams[stream_id]["processor_type"]
                                await websocket.send_json({
                                    "type": "processor_info",
                                    "processor_type": current_processor
                                })
                                logger.info(f"Sent processor info in response to request for stream {stream_id}: '{current_processor}'")
        except WebSocketDisconnect:
            # Remove connection on disconnect
            if client_type == "broadcaster":
                active_connections[stream_id]["broadcasters"].remove(websocket)
                logger.info(f"Broadcaster disconnected from stream {stream_id}")
            else:
                active_connections[stream_id]["viewers"].remove(websocket)
                logger.info(f"Viewer disconnected from stream {stream_id}")
                
            # Clean up if no connections remain for this stream
            if (len(active_connections[stream_id]["broadcasters"]) == 0 and 
                len(active_connections[stream_id]["viewers"]) == 0):
                del active_connections[stream_id]
                if stream_id in streams:
                    del streams[stream_id]
                logger.info(f"Stream {stream_id} cleaned up")
    
    async def process_and_broadcast_frame(stream_id, frame_data, viewers, processor, processor_type):
        """Process a frame and broadcast to all viewers"""
        try:
            # Process the frame using the shared processor
            try:
                processing_start = asyncio.get_event_loop().time()
                
                # Use the stream-specific prompt instead of hardcoded one
                current_prompt = streams[stream_id]["style_prompt"]
                current_strength = streams[stream_id].get("strength", 0.9)  # Get the current strength
                
                logger.info(f"Processing frame for stream {stream_id} with prompt: '{current_prompt}' using {processor_type} processor (strength: {current_strength})")
                
                # Process the frame, passing the strength parameter directly to process_base64_frame
                processed_base64 = await process_base64_frame(
                    frame_data, 
                    processor,
                    prompt=current_prompt,
                    negative_prompt=streams[stream_id].get("negative_prompt", None),
                    strength=current_strength 
                )
                processing_time = asyncio.get_event_loop().time() - processing_start
                
                logger.info(f"Frame for stream {stream_id} processed in {processing_time:.2f}s using {processor_type} processor (strength: {current_strength})")
                
                # Broadcast to all viewers
                await broadcast_frame(stream_id, processed_base64, viewers, processor_type=processor_type)
            except Exception as e:
                logger.error(f"Frame processing error: {e}")
                # Capture and log traceback
                import traceback
                logger.error(f"Traceback: {traceback.format_exc()}")
                # Send error message to viewers
                for viewer in viewers:
                    try:
                        await viewer.send_json({
                            "type": "error",
                            "message": "Frame processing failed, please try again",
                            "details": str(e)
                        })
                    except Exception:
                        pass
                
                # Also echo the original frame back if processing fails
                # If frame_data doesn't start with 'data:', add the prefix
                if frame_data and isinstance(frame_data, str) and not frame_data.startswith('data:'):
                    frame_data = f"data:image/jpeg;base64,{frame_data}"
                    logger.debug(f"Added data URL prefix to original frame for error fallback")
                
                await broadcast_frame(stream_id, frame_data, viewers, is_original=True, processor_type=processor_type)
            
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
        finally:
            # Reset processing flag
            if stream_id in streams:
                # Check if the latest frame is different from the one we just processed
                # If so, process the latest frame immediately (skipping any intermediate frames)
                latest_frame = streams[stream_id]["latest_frame"]
                is_new_frame = latest_frame != frame_data
                
                # Set processing to False ONLY if we're not going to process a new frame immediately
                if not is_new_frame:
                    streams[stream_id]["processing"] = False
                    logger.info(f"Processing complete for stream {stream_id}, no new frames waiting")
                else:
                    # There's a newer frame - process it immediately (skipping any intermediate frames)
                    # We keep processing=True to prevent any other incoming frames from being processed
                    logger.info(f"Processing latest frame for stream {stream_id} (skipping any intermediate frames)")
                    
                    # Get the current processor type
                    current_processor_type = streams[stream_id].get("processor_type", "standard")
                    processor = global_processors[current_processor_type]
                    
                    # Launch task to process the latest frame
                    asyncio.create_task(
                        process_and_broadcast_frame(
                            stream_id, 
                            latest_frame,
                            viewers,
                            processor,
                            current_processor_type
                        )
                    )
    
    async def broadcast_frame(stream_id, processed_frame, viewers, is_original=False, processor_type="standard"):
        """Broadcast a processed frame to all viewers"""
        # Make a copy of the viewers list to avoid modification during iteration
        current_viewers = viewers.copy()
        
        # Track disconnected viewers to remove
        disconnected = []
        
        # Format the frame as a data URL if it's not already
        if processed_frame and isinstance(processed_frame, str) and not processed_frame.startswith('data:'):
            # Add proper data URL prefix for JPEG images
            processed_frame = f"data:image/jpeg;base64,{processed_frame}"
            logger.debug(f"Added data URL prefix to frame for stream {stream_id}")
        
        # Get current style prompt and strength
        current_prompt = None
        current_strength = None
        if stream_id in streams:
            if "style_prompt" in streams[stream_id]:
                current_prompt = streams[stream_id]["style_prompt"]
            if "strength" in streams[stream_id]:
                current_strength = streams[stream_id]["strength"]
        
        # Use timestamp in milliseconds since epoch (like JavaScript's Date.now())
        current_timestamp_ms = int(time.time() * 1000)
        
        for i, viewer in enumerate(current_viewers):
            try:
                message = {
                    "type": "frame",
                    "streamId": stream_id,
                    "frame": processed_frame,
                    "timestamp": current_timestamp_ms,
                    "is_original": is_original,
                    "processor_type": processor_type
                }
                
                # Include style prompt with each frame if available
                if current_prompt:
                    message["style_prompt"] = current_prompt
                
                # Include strength with each frame if available
                if current_strength is not None:
                    message["strength"] = current_strength
                
                await viewer.send_json(message)
            except Exception as e:
                logger.error(f"Error sending to viewer {i}: {e}")
                disconnected.append(viewer)
        
        # Remove disconnected viewers
        for viewer in disconnected:
            if viewer in viewers:
                viewers.remove(viewer)
    
    @app.get("/")
    async def root():
        return {"status": "ok", "service": "livestream-processor-websocket"}
    
    @app.get("/streams")
    async def get_streams():
        return {
            "active_streams": [{
                "id": stream_id,
                "broadcasters": len(conns["broadcasters"]),
                "viewers": len(conns["viewers"]),
                "processor_type": streams[stream_id].get("processor_type", "standard") if stream_id in streams else "standard",
                "strength": streams[stream_id].get("strength", 0.9) if stream_id in streams else 0.9
            } for stream_id, conns in active_connections.items()]
        }
    
    @app.get("/processors")
    async def get_available_processors():
        """Return information about the available processors"""
        processors = ["standard", "lightning"]
            
        return {
            "available_processors": processors,
            "default_processor": "lightning"
        }
    
    return app