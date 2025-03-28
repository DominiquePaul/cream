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
  const [processingStatus, setProcessingStatus] = useState<string>("");
  const [lastFrameTime, setLastFrameTime] = useState<Date | null>(null);
  const [aspectRatio, setAspectRatio] = useState("56.25%"); // Default 16:9 (9/16 * 100)
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
    
    // Format the URL with the proper path pattern for Modal
    const fullWsUrl = `${wsUrl}/viewer/${streamId}`;
    
    console.log(`Connecting to WebSocket at: ${fullWsUrl}`);
    const ws = new WebSocket(fullWsUrl);
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
      
      // No need to send join_stream message - the path parameters handle this
      setConnected(true);
      setStatus("Connected to stream. Waiting for frames...");
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("WATCH DEBUG: Received message type:", data.type);
        
        // We may not get a joined_stream message with the Modal app
        // The connection is already established by connecting to the correct path
        if (data.type === 'joined_stream') {
          console.log(`Successfully joined stream: ${data.streamId}`);
          setConnected(true);
          setStatus("Connected to stream. Waiting for frames...");
        } 
        else if (data.type === 'frame') {
          // Make sure we're marked as connected when receiving frames
          if (!connectedRef.current) {
            setConnected(true);
            console.log(`Implicitly joined stream by receiving frames`);
          }
          
          // Update status on first frame received
          if (framesReceivedRef.current === 0) {
            setStatus("Receiving AI-processed frames");
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
          
          // Calculate time since last frame
          const now = new Date();
          if (lastFrameTime) {
            const timeSinceLastFrame = (now.getTime() - lastFrameTime.getTime()) / 1000;
            setProcessingStatus(`Frame rate: ${timeSinceLastFrame.toFixed(1)}s per frame`);
          }
          setLastFrameTime(now);
          
          // Update image with received frame
          setImageData(data.frame);
          
          // Update aspect ratio from first frame (or when dimensions change)
          // We need to create a temporary image to get the dimensions
          if (data.frame.startsWith('data:image')) {
            const img = new window.Image();
            img.onload = () => {
              const ratio = (img.height / img.width) * 100;
              setAspectRatio(`${ratio}%`);
              console.log(`Set aspect ratio to ${ratio}% based on image dimensions ${img.width}x${img.height}`);
            };
            img.src = data.frame;
          }
          
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
          
          // If this was a processed frame, show that information
          if (data.processed) {
            setProcessingStatus("AI-processed frame");
          }
        } 
        else if (data.type === 'processing_update') {
          // Show processing status updates
          setProcessingStatus(data.status || "Processing frame...");
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
  }, [streamId, lastFrameTime]);
  
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
          <CardTitle>Watching AI-Stylized Stream</CardTitle>
          <CardDescription>
            Stream ID: {streamId}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="relative rounded-md overflow-hidden bg-black flex items-center justify-center"
            style={{ 
              paddingTop: aspectRatio, // Dynamic aspect ratio
              position: "relative" 
            }}
          >
            {connected ? (
              imageData ? (
                <div className="absolute inset-0 w-full h-full">
                  <Image 
                    src={imageData}
                    alt="Live stream"
                    fill
                    style={{ objectFit: 'contain' }}
                    priority
                    unoptimized
                    width={0}
                    height={0}
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-md text-sm">
                    {processingStatus || "AI-processed stream"}
                  </div>
                </div>
              ) : (
                <div className="text-white text-center p-8">
                  <p className="text-xl">Waiting for stream data...</p>
                  <p className="text-sm mt-2">Each frame is processed with AI stylization which takes ~5 seconds</p>
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
            <p className="text-sm">Note: Frames are processed with AI diffusion (~5 seconds per frame)</p>
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