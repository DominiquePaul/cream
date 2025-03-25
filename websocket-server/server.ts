import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Memory usage monitoring
setInterval(() => {
  const memoryUsage = process.memoryUsage();
  console.log(`Memory usage: ${JSON.stringify({
    rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`
  })}`);
}, 60000); // Log every minute

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Setup Express app
const app = express();
app.use(cors());
app.use(express.json());

// Define types
interface StreamData {
  id: string;
  broadcaster: WebSocket;
  viewers: Set<WebSocket>;
}

interface SocketStats {
  framesReceived: number;
  framesSent: number;
}

interface MessageData {
  type: string;
  streamId?: string;
  frame?: string;
  timestamp?: number;
  message?: string;
}

// In-memory storage for active streams
const streams = new Map<string, StreamData>();

// Counters for frames
const socketStats = new WeakMap<WebSocket, SocketStats>();

// Simple health check endpoint
app.get('/', (req, res) => {
  res.send('WebSocket server is running');
});

// Debug endpoint to check active streams
app.get('/debug/streams', (req, res) => {
  const streamsInfo = Array.from(streams.entries()).map(([id, stream]) => {
    return {
      id,
      viewerCount: stream.viewers.size,
      isActive: stream.broadcaster.readyState === WebSocket.OPEN,
      framesReceived: socketStats.get(stream.broadcaster)?.framesReceived || 0,
      framesSent: Array.from(stream.viewers).reduce((total, viewer) => {
        return total + (socketStats.get(viewer)?.framesSent || 0);
      }, 0)
    };
  });
  
  res.json({
    activeStreams: streamsInfo,
    totalStreams: streams.size,
    totalConnections: wss.clients.size
  });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server });

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');
  
  // Initialize stats for this socket
  socketStats.set(ws, {
    framesReceived: 0,
    framesSent: 0
  });

  // Add error handler
  ws.on('error', (error: Error) => {
    console.error('WebSocket connection error:', error);
    // Don't rethrow the error
  });

  // Improve close handler
  ws.on('close', (code: number, reason: string) => {
    // Log frame stats on disconnect
    const stats = socketStats.get(ws);
    console.log(`Client disconnected with code ${code}. Reason: ${reason}. Frames received: ${stats?.framesReceived || 0}, Frames sent: ${stats?.framesSent || 0}`);
    
    // Clean up streams when broadcaster disconnects
    for (const [streamId, stream] of streams.entries()) {
      if (stream.broadcaster === ws) {
        // Notify viewers that stream has ended
        console.log(`Broadcaster disconnected from stream ${streamId}. Notifying ${stream.viewers.size} viewers.`);
        stream.viewers.forEach((viewer: WebSocket) => {
          if (viewer.readyState === WebSocket.OPEN) {
            try {
              viewer.send(JSON.stringify({
                type: 'stream_ended',
                streamId
              }));
            } catch (err) {
              console.error(`Error notifying viewer of stream end: ${err instanceof Error ? err.message : err}`);
            }
          }
        });
        console.log(`Stream ended: ${streamId}`);
        streams.delete(streamId);
        break;
      } else {
        // Also remove this connection from viewers if it exists
        if (stream.viewers.has(ws)) {
          console.log(`Viewer disconnected from stream ${streamId}`);
          stream.viewers.delete(ws);
        }
      }
    }
  });

  // Implement ping/pong to keep connection alive
  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    }
  }, 30000);

  // Clear interval when connection closes
  ws.on('close', () => {
    clearInterval(pingInterval);
  });

  ws.on('message', (message: WebSocket.RawData) => {
    try {
      const data = JSON.parse(message.toString()) as MessageData;
      
      // Validate message has required type
      if (!data.type) {
        throw new Error('Message missing type property');
      }
      
      switch (data.type) {
        case 'start_stream': {
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
        }

        case 'join_stream': {
          // Validate streamId exists
          if (!data.streamId) {
            throw new Error('Join stream message missing streamId');
          }
          
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
        }

        case 'frame': {
          // Validate frame data exists
          if (!data.streamId || !data.frame) {
            console.error(`FRAME ERROR: Missing required properties. Has streamId: ${!!data.streamId}, Has frame: ${!!data.frame}`);
            throw new Error('Frame message missing required properties');
          }
          
          const frameSize = data.frame.length;
          console.log(`FRAME DEBUG: Received frame data for stream ${data.streamId}. Frame size: ${frameSize} bytes`);
          
          // Increment frames received counter
          const stats = socketStats.get(ws);
          if (stats) {
            stats.framesReceived++;
          }
          
          // Broadcast frame to all viewers
          const streamToBroadcast = streams.get(data.streamId);
          if (streamToBroadcast) {
            // Verify this frame is coming from the broadcaster
            if (streamToBroadcast.broadcaster !== ws) {
              console.error(`Rejecting frame from non-broadcaster for stream ${data.streamId}`);
              return;
            }
            
            const viewerCount = streamToBroadcast.viewers.size;
            console.log(`Received frame from broadcaster for stream ${data.streamId}. Viewers: ${viewerCount}. Total frames received: ${stats?.framesReceived || 0}`);
            
            if (viewerCount === 0) {
              console.log(`No viewers for stream ${data.streamId}, skipping frame broadcast`);
              return;
            }
            
            // Clean up dead viewers before sending frames
            let removedViewers = 0;
            streamToBroadcast.viewers.forEach((viewer: WebSocket) => {
              if (viewer.readyState !== WebSocket.OPEN) {
                streamToBroadcast.viewers.delete(viewer);
                removedViewers++;
              }
            });
            
            if (removedViewers > 0) {
              console.log(`Removed ${removedViewers} dead viewers from stream ${data.streamId}`);
            }
            
            // Only proceed if we still have viewers
            const finalViewerCount = streamToBroadcast.viewers.size;
            if (finalViewerCount > 0) {
              console.log(`FRAME DEBUG: Preparing to send frame to ${finalViewerCount} viewers`);
              
              try {
                const frameData = JSON.stringify({
                  type: 'frame',
                  frame: data.frame,
                  timestamp: Date.now()
                });
                
                const framePayloadSize = frameData.length;
                console.log(`FRAME DEBUG: Frame payload size: ${framePayloadSize} bytes`);
                
                let viewersSent = 0;
                let viewersSkipped = 0;
                
                streamToBroadcast.viewers.forEach((viewer: WebSocket) => {
                  if (viewer.readyState === WebSocket.OPEN) {
                    try {
                      console.log(`FRAME DEBUG: Sending frame to viewer, socket state: ${viewer.readyState}`);
                      viewer.send(frameData);
                      viewersSent++;
                      
                      // Increment frames sent counter for the viewer
                      const viewerStats = socketStats.get(viewer);
                      if (viewerStats) {
                        viewerStats.framesSent++;
                      }
                    } catch (err) {
                      console.error(`Error sending frame to viewer: ${err instanceof Error ? err.message : err}`);
                    }
                  } else {
                    viewersSkipped++;
                    console.log(`Viewer socket not open, state: ${viewer.readyState}`);
                  }
                });
                
                console.log(`FRAME DEBUG: Sent frame to ${viewersSent}/${finalViewerCount} viewers, skipped ${viewersSkipped}`);
              } catch (err) {
                console.error(`FRAME ERROR: Failed to prepare or send frame: ${err instanceof Error ? err.message : err}`);
              }
            } else {
              console.log(`FRAME DEBUG: No active viewers for stream ${data.streamId} after cleanup`);
            }
          } else {
            console.log(`Received frame for non-existent stream ${data.streamId}`);
          }
          break;
        }
        
        case 'list_streams': {
          // Return list of active streams
          const activeStreams = Array.from(streams.keys());
          ws.send(JSON.stringify({
            type: 'streams_list',
            streams: activeStreams
          }));
          console.log(`Sent list of active streams: ${activeStreams.length}`);
          break;
        }
        
        case 'ping': {
          // Simple ping-pong to keep connection alive
          ws.send(JSON.stringify({
            type: 'pong'
          }));
          break;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format: ' + (error instanceof Error ? error.message : String(error))
          }));
        } catch (err) {
          console.error('Error sending error message:', err);
        }
      }
    }
  });
});

// Add server-level error handler
wss.on('error', (error: Error) => {
  console.error('WebSocket server error:', error);
});

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`WebSocket server is running on port ${PORT}`);
});