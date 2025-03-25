import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Setup Express app
const app = express();
app.use(cors());
app.use(express.json());

// In-memory storage for active streams
const streams = new Map();

// Counters for frames
const socketStats = new WeakMap();

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('WebSocket server is running');
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('Client connected');
  
  // Initialize stats for this socket
  socketStats.set(ws, {
    framesReceived: 0,
    framesSent: 0
  });

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'start_stream':
          // Create new stream
          const streamId = Math.random().toString(36).substring(7);
          streams.set(streamId, {
            id: streamId,
            broadcaster: ws,
            viewers: new Set()
          });
          
          // Send stream ID back to broadcaster
          ws.send(JSON.stringify({
            type: 'stream_created',
            streamId
          }));
          console.log(`Stream created: ${streamId}`);
          break;

        case 'join_stream':
          // Add viewer to stream
          const stream = streams.get(data.streamId);
          if (stream) {
            stream.viewers.add(ws);
            ws.send(JSON.stringify({
              type: 'joined_stream',
              streamId: data.streamId
            }));
            console.log(`Viewer joined stream: ${data.streamId}`);
          } else {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Stream not found'
            }));
          }
          break;

        case 'frame':
          // Increment frames received counter
          const stats = socketStats.get(ws);
          stats.framesReceived++;
          
          // Broadcast frame to all viewers
          const streamToBroadcast = streams.get(data.streamId);
          if (streamToBroadcast) {
            const viewerCount = streamToBroadcast.viewers.size;
            console.log(`Received frame from broadcaster for stream ${data.streamId}. Viewers: ${viewerCount}. Total frames received: ${stats.framesReceived}`);
            const frameData = JSON.stringify({
              type: 'frame',
              frame: data.frame,
              timestamp: Date.now()
            });
            
            streamToBroadcast.viewers.forEach(viewer => {
              if (viewer.readyState === ws.OPEN) {
                viewer.send(frameData);
                
                // Increment frames sent counter for the viewer
                const viewerStats = socketStats.get(viewer);
                if (viewerStats) {
                  viewerStats.framesSent++;
                }
              }
            });
          } else {
            console.log(`Received frame for non-existent stream ${data.streamId}`);
          }
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });

  ws.on('close', () => {
    // Log frame stats on disconnect
    const stats = socketStats.get(ws);
    console.log(`Client disconnected. Frames received: ${stats?.framesReceived || 0}, Frames sent: ${stats?.framesSent || 0}`);
    
    // Clean up streams when broadcaster disconnects
    for (const [streamId, stream] of streams.entries()) {
      if (stream.broadcaster === ws) {
        // Notify viewers that stream has ended
        stream.viewers.forEach(viewer => {
          viewer.send(JSON.stringify({
            type: 'stream_ended',
            streamId
          }));
        });
        console.log(`Stream ended: ${streamId}`);
        streams.delete(streamId);
        break;
      }
    }
  });
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
}); 