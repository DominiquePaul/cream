import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { WebSocketServer } from 'ws';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// In-memory storage for active streams
const streams = new Map();

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws) => {
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
            }
            break;

          case 'frame':
            // Broadcast frame to all viewers
            const streamToBroadcast = streams.get(data.streamId);
            if (streamToBroadcast) {
              const frameData = JSON.stringify({
                type: 'frame',
                frame: data.frame,
                timestamp: Date.now()
              });
              
              streamToBroadcast.viewers.forEach(viewer => {
                if (viewer.readyState === ws.OPEN) {
                  viewer.send(frameData);
                }
              });
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
          streams.delete(streamId);
          break;
        }
      }
    });
  });

  server.listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on http://localhost:3000');
  });
}); 