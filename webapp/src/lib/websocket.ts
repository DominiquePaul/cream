import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';

interface Stream {
  id: string;
  broadcaster: WebSocket;
  viewers: Set<WebSocket>;
}

const streams = new Map<string, Stream>();

export function initWebSocketServer(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on('connection', (ws: WebSocket) => {
    ws.on('message', async (message: string) => {
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
                if (viewer.readyState === WebSocket.OPEN) {
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

  return wss;
} 