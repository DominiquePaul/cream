"use client";

import { useEffect, useRef, useState } from 'react';
import { WEBSOCKET_URL } from '@/lib/config';

export default function Broadcast() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);

  useEffect(() => {
    // Initialize WebSocket connection
    const ws = new WebSocket(WEBSOCKET_URL);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'stream_created') {
        setStreamId(data.streamId);
        setIsStreaming(true);
      }
    };

    return () => {
      ws.close();
    };
  }, []);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // Tell server to create a new stream
      wsRef.current?.send(JSON.stringify({
        type: 'start_stream'
      }));

      // Start sending frames
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = 640;
      canvas.height = 480;

      const sendFrame = () => {
        if (!isStreaming || !videoRef.current || !context || !wsRef.current || !streamId) return;

        context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.7);

        wsRef.current.send(JSON.stringify({
          type: 'frame',
          streamId,
          frame
        }));

        // Schedule next frame (2 FPS)
        setTimeout(sendFrame, 500);
      };

      sendFrame();
    } catch (error) {
      console.error('Error accessing webcam:', error);
    }
  };

  const stopStream = () => {
    setIsStreaming(false);
    if (videoRef.current?.srcObject) {
      const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Start Streaming</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg mb-4"
          />
          
          <div className="flex gap-4">
            <button
              onClick={startStream}
              disabled={isStreaming}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-gray-400"
            >
              Start Stream
            </button>
            
            <button
              onClick={stopStream}
              disabled={!isStreaming}
              className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 disabled:bg-gray-400"
            >
              Stop Stream
            </button>
          </div>

          {streamId && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-medium">Stream URL:</p>
              <p className="text-sm text-gray-600 break-all">
                {`${window.location.origin}/watch/${streamId}`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 