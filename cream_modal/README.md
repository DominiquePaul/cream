# DreamStream - Livestream Image Style Processor

This application processes livestream frames with diffusion models to apply artistic styles in real-time.

## Features

- Web UI for livestreaming your artistic creations
- WebSocket API for custom integrations
- Multiple diffusion processor options:
  - Standard diffusion processor: high quality results with longer processing time
  - SDXL-Lightning processor: faster inference with fewer steps

## Diffusion Processors

### Standard Processor

The standard processor uses a full Stable Diffusion v1.5 model with ControlNet depth guidance.
It delivers high-quality transformations but requires more processing time and steps (typically 20-25).

### SDXL-Lightning Processor

The SDXL-Lightning processor uses a specialized model trained for fast inference with very few steps.
It can run with as few as 1, a2, 4, or 8 diffusion steps, making it significantly faster than the
standard processor while still producing good results.

## Usage

### Choose a Processor

You can easily select which processor to use in your application:

```python
from src.diffusion_processor import get_diffusion_processor

# Use the standard processor (default)
processor = get_diffusion_processor(
    processor_type="standard",
    use_controlnet=True,
    style_prompt="Van Gogh style painting",
    strength=0.7,
    num_steps=25
)

# OR use the SDXL-Lightning processor for faster results
processor = get_diffusion_processor(
    processor_type="lightning",
    use_controlnet=True,
    style_prompt="Van Gogh style painting",
    strength=0.7,
    num_steps=4  # Lightning supports 1, 2, 4, or 8 steps
)
```

### Process Images

Process images the same way regardless of which processor you're using:

```python
from src.diffusion_processor import process_base64_frame

# Process a base64-encoded image
result = await process_base64_frame(
    base64_frame=image_data,
    processor=processor,
    prompt="Monet-style watercolor"
)
```

### Direct Processing

You can also process images directly without instantiating a processor:

```python
from src.diffusion_processor import apply_diffusion

# Process with the standard processor
result_standard = await apply_diffusion(
    img_data=image_bytes,
    processor_type="standard",
    prompt="Monet-style watercolor",
    use_controlnet=True,
    strength=0.7,
    num_steps=25
)

# Process with the Lightning processor
result_lightning = await apply_diffusion(
    img_data=image_bytes,
    processor_type="lightning",
    prompt="Monet-style watercolor",
    use_controlnet=True,
    strength=0.7,
    num_steps=4
)
```

## Example: Compare Processors

Run the example script to compare both processors on the same image:

```bash
python examples/compare_processors.py --image path/to/image.jpg --prompt "Oil painting in autumn colors"
```

## Modal Deployment

This application is designed to run on Modal.com's infrastructure:

```bash
modal deploy app.py
```

## WebSocket Server

The application includes a WebSocket server for real-time image processing:

1. Connect as a broadcaster to send frames
2. Connect as a viewer to receive processed frames

```javascript
// Connect as a broadcaster
const socket = new WebSocket('wss://your-modal-app.modal.run/ws/broadcaster/stream123');

// Send a frame
socket.send(JSON.stringify({
  type: 'frame',
  frame: base64ImageData
}));

// Connect as a viewer
const viewerSocket = new WebSocket('wss://your-modal-app.modal.run/ws/viewer/stream123');
viewerSocket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'frame') {
    // Display the processed frame
    document.getElementById('output').src = data.frame;
  }
};
```

## Performance Considerations

- The Lightning processor is much faster but may produce slightly different results
- The standard processor gives higher quality but takes longer
- Both processors support ControlNet for maintaining image structure
- SDXL-Lightning currently supports 1, 2, 4, or 8 steps (we recommend 4 for a good balance)
- The standard processor typically uses 20-30 steps
