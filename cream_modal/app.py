import asyncio
import json
import websockets
from modal import Image, App, fastapi_endpoint, asgi_app, Secret

from src.logger import logger
from src.diffusion_pipeline import get_processor, process_base64_frame

app = App("cream-livestream-processor")

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
            .add_local_python_source("src")
            .add_local_python_source("_remote_module_non_scriptable"))

# Health check endpoint - no need for GPU
@app.function(image=ml_image, allow_concurrent_inputs=50, secrets=[Secret.from_name("custom-secret")])
@fastapi_endpoint(method="GET")
async def health():
    """Health check endpoint"""
    return {"status": "ok", "service": "livestream-processor"}

# Native Modal WebSocket server
@app.function(image=ml_image, allow_concurrent_inputs=10, secrets=[Secret.from_name("custom-secret")], gpu="H100")
@asgi_app()
def websocket_server():
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect
    
    app = FastAPI(title="Livestream Processor WebSocket Server")
    active_connections = {}
    streams = {}
    
    # Initialize the processor once at startup
    logger.info("Initializing global image processor for WebSocket server...")
    global_processor = get_processor(
        use_controlnet=True,
        style_prompt="A painting in the style of van Gogh's 'Starry Night'",
        strength=1.0
    )
    logger.info("Global image processor initialized successfully")
    
    @app.websocket("/ws/{client_type}/{stream_id}")
    async def websocket_endpoint(websocket: WebSocket, client_type: str, stream_id: str):
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
                    "style_prompt": "A painting in the style of van Gogh's 'Starry Night'"  # Default prompt
                }
        elif client_type == "viewer":
            active_connections[stream_id]["viewers"].append(websocket)
            logger.info(f"Viewer connected to stream {stream_id}")
            
            # Send the current style prompt to new viewer
            if stream_id in streams and "style_prompt" in streams[stream_id]:
                current_prompt = streams[stream_id]["style_prompt"]
                await websocket.send_json({
                    "type": "style_updated",
                    "prompt": current_prompt
                })
                logger.info(f"Sent current style prompt to new viewer for stream {stream_id}: '{current_prompt}'")
        else:
            await websocket.close(code=1008, reason="Invalid client type")
            return
            
        try:
            while True:
                data = await websocket.receive_json()
                
                if "type" not in data:
                    await websocket.send_json({"error": "Invalid message format"})
                    continue
                
                if data["type"] == "frame" and client_type == "broadcaster":
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
                    if not streams[stream_id]["processing"] and streams[stream_id]["latest_frame"]:
                        # Mark as processing
                        streams[stream_id]["processing"] = True
                        
                        # Process frame asynchronously
                        asyncio.create_task(
                            process_and_broadcast_frame(
                                stream_id, 
                                streams[stream_id]["latest_frame"],
                                active_connections[stream_id]["viewers"],
                                global_processor  # Pass the existing processor
                            )
                        )
                
                # Handle prompt updates from broadcaster
                elif data["type"] == "update_prompt" and client_type == "broadcaster":
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
                
                elif data["type"] == "ping":
                    await websocket.send_json({"type": "pong"})
                
                # Handle request for current style prompt
                elif data["type"] == "get_style_prompt" and client_type == "viewer":
                    if stream_id in streams and "style_prompt" in streams[stream_id]:
                        current_prompt = streams[stream_id]["style_prompt"]
                        await websocket.send_json({
                            "type": "style_updated",
                            "prompt": current_prompt
                        })
                        logger.info(f"Sent current style prompt in response to request for stream {stream_id}: '{current_prompt}'")
        
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
    
    async def process_and_broadcast_frame(stream_id, frame_data, viewers, processor):
        """Process a frame and broadcast to all viewers"""
        try:
            # Process the frame using the shared processor
            try:
                processing_start = asyncio.get_event_loop().time()
                
                # Use the stream-specific prompt instead of hardcoded one
                current_prompt = streams[stream_id]["style_prompt"]
                logger.info(f"Processing frame for stream {stream_id} with prompt: '{current_prompt}'")
                
                processed_base64 = await process_base64_frame(
                    frame_data, 
                    processor,
                    prompt=current_prompt
                )
                processing_time = asyncio.get_event_loop().time() - processing_start
                
                logger.info(f"Frame for stream {stream_id} processed in {processing_time:.2f}s")
                
                # Broadcast to all viewers
                await broadcast_frame(stream_id, processed_base64, viewers)
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
                
                await broadcast_frame(stream_id, frame_data, viewers, is_original=True)
            
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
        finally:
            # Reset processing flag
            if stream_id in streams:
                streams[stream_id]["processing"] = False
                
                # If there's a new frame waiting, process it immediately
                if streams[stream_id]["latest_frame"] != frame_data:
                    streams[stream_id]["processing"] = True
                    asyncio.create_task(
                        process_and_broadcast_frame(
                            stream_id, 
                            streams[stream_id]["latest_frame"],
                            viewers,
                            processor  # Pass the existing processor
                        )
                    )
    
    async def broadcast_frame(stream_id, processed_frame, viewers, is_original=False):
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
        
        # Get current style prompt
        current_prompt = None
        if stream_id in streams and "style_prompt" in streams[stream_id]:
            current_prompt = streams[stream_id]["style_prompt"]
        
        for i, viewer in enumerate(current_viewers):
            try:
                message = {
                    "type": "frame",
                    "streamId": stream_id,
                    "frame": processed_frame,
                    "timestamp": asyncio.get_event_loop().time(),
                    "is_original": is_original
                }
                
                # Include style prompt with each frame if available
                if current_prompt:
                    message["style_prompt"] = current_prompt
                
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
                "viewers": len(conns["viewers"])
            } for stream_id, conns in active_connections.items()]
        }
    
    return app