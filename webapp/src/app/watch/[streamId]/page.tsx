"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";

export default function WatchPage() {
  const params = useParams();
  const streamId = params?.streamId as string;
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Connecting...");
  const [lastFrameTimestamp, setLastFrameTimestamp] = useState<number | null>(null);
  const [framesReceived, setFramesReceived] = useState(0);
  const [imageData, setImageData] = useState<string | null>(null);
  const router = useRouter();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectedRef = useRef(false);
  const framesReceivedRef = useRef(0);
  
  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);
  
  useEffect(() => {
    framesReceivedRef.current = framesReceived;
  }, [framesReceived]);
  
  // Function to establish WebSocket connection
  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    console.log(`Setting up WebSocket to watch stream: ${streamId}`);
    
    // Use the environment variable for WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
        } catch (err) {
          console.error("Error sending ping:", err);
        }
      }
    }, 30000); // Send ping every 30 seconds to keep connection alive
    
    ws.onopen = () => {
      console.log("WebSocket connection established, joining stream");
      setStatus("Connected, joining stream...");
      setWsConnected(true);
      
      // Request to join stream
      try {
        ws.send(JSON.stringify({
          type: 'join_stream',
          streamId: streamId
        }));
      } catch (err) {
        console.error("Error joining stream:", err);
        setError("Failed to join stream: " + (err instanceof Error ? err.message : String(err)));
      }
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WATCH DEBUG: Received message type:", data.type);
        
        if (data.type === 'joined_stream') {
          console.log(`Successfully joined stream: ${data.streamId}`);
          setConnected(true);
          setStatus("Connected to stream. Waiting for frames...");
        } 
        else if (data.type === 'frame') {
          // Update status on first frame received
          if (framesReceivedRef.current === 0) {
            setStatus("Receiving frames");
            console.log("WATCH DEBUG: Received first frame!");
          }
          
          if (!data.frame) {
            console.error("WATCH DEBUG: Received frame message with no frame data");
            return;
          }
          
          const frameSize = data.frame.length;
          console.log(`WATCH DEBUG: Received frame #${framesReceivedRef.current + 1}, size: ${frameSize} bytes`);
          
          // Log data.frame prefix to check if it's valid data
          console.log(`WATCH DEBUG: Frame data prefix: ${data.frame.substring(0, 50)}...`);
          
          // Validate the frame data (should be a valid data URL)
          if (!data.frame.startsWith('data:image')) {
            console.error(`WATCH DEBUG: Invalid frame data, doesn't start with 'data:image'`);
            return;
          }
          
          // Update image with received frame
          setImageData(data.frame);
          const newFrameCount = framesReceivedRef.current + 1;
          setFramesReceived(newFrameCount);
          
          // Calculate and display latency
          if (data.timestamp) {
            const latency = Date.now() - data.timestamp;
            setLastFrameTimestamp(latency);
            
            if (newFrameCount % 10 === 0) {
              console.log(`Received frame #${newFrameCount}, latency: ${latency}ms`);
            }
          }
        } 
        else if (data.type === 'stream_ended') {
          console.log("Stream has ended");
          setStatus("Stream has ended");
          setConnected(false);
          setError("The broadcaster ended this stream");
        } 
        else if (data.type === 'error') {
          console.error("Error from server:", data.message);
          setError(data.message);
          setStatus("Error occurred");
        }
      } catch (err) {
        console.error("Error parsing WebSocket message:", err);
        setError("Failed to parse server message");
      }
    };
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      setError("WebSocket connection error occurred");
      setStatus("Connection error");
      setWsConnected(false);
    };
    
    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setWsConnected(false);
      
      // Only change connected state if we were previously connected
      if (connectedRef.current) {
        setConnected(false);
        setStatus("Disconnected from server");
      }
      
      // Clear the ping interval
      clearInterval(pingInterval);
      
      // Try to reconnect after a delay
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        setStatus("Reconnecting...");
        connectWebSocket();
      }, 3000);
    };
    
    // Clean up function
    return () => {
      console.log("Cleaning up WebSocket connection");
      clearInterval(pingInterval);
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [streamId]);
  
  // Set up the WebSocket connection on mount or streamId change
  useEffect(() => {
    const cleanup = connectWebSocket();
    
    return () => {
      if (cleanup) cleanup();
    };
  }, [connectWebSocket]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleBack = () => {
    router.push('/');
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Watching Stream</CardTitle>
          <CardDescription>
            Stream ID: {streamId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video rounded-md overflow-hidden bg-black flex items-center justify-center">
            {connected ? (
              imageData ? (
                <div className="relative w-full h-full">
                  <Image 
                    src={imageData}
                    alt="Live stream"
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                    unoptimized
                  />
                </div>
              ) : (
                <div className="text-white text-center p-8">
                  <p className="text-xl">Waiting for stream data...</p>
                </div>
              )
            ) : (
              <div className="text-white text-center p-8">
                <p className="text-xl">{status}</p>
                {error && <p className="text-red-400 mt-2">{error}</p>}
              </div>
            )}
          </div>
          
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-sm font-medium">Status: {status}</p>
            <p className="text-sm">WebSocket: {wsConnected ? "Connected" : "Disconnected"}</p>
            {connected && (
              <>
                <p className="text-sm">Frames received: {framesReceived}</p>
                {lastFrameTimestamp !== null && (
                  <p className="text-sm">Current latency: {lastFrameTimestamp}ms</p>
                )}
              </>
            )}
          </div>
          
          {error && (
            <div className="flex space-x-4">
              <button
                onClick={handleRetry}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Retry Connection
              </button>
              <button
                onClick={handleBack}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
              >
                Back to Home
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 