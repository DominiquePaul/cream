"use client";

import { useEffect, useRef, useState } from 'react';
import { WEBSOCKET_URL } from '@/lib/config';

export default function Watch({ params }: { params: { streamId: string } }) {
  const { streamId } = params;
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!streamId) return;

    const ws = new WebSocket(WEBSOCKET_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      // Join the stream
      ws.send(JSON.stringify({
        type: 'join_stream',
        streamId
      }));
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'frame' && videoRef.current) {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.width = 640;
          canvas.height = 480;
          
          if (context) {
            context.drawImage(img, 0, 0, canvas.width, canvas.height);
            videoRef.current!.srcObject = canvas.captureStream(2);
          }
        };
        img.src = data.frame;
      } else if (data.type === 'stream_ended') {
        alert('Stream has ended');
        window.location.href = '/';
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      ws.close();
    };
  }, [streamId]);

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Watching Stream</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg"
          />
          
          <div className="mt-4">
            <p className={`font-medium ${isConnected ? 'text-green-500' : 'text-red-500'}`}>
              {isConnected ? 'Connected to stream' : 'Disconnected'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 