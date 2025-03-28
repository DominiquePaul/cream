"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState, useCallback } from "react";

export default function BroadcastPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>("Idle");
  const frameCounterRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const isStreamingRef = useRef(false);
  const currentStreamIdRef = useRef<string | null>(null);
  const frameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [processingFrame, setProcessingFrame] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("56.25%"); // Default 16:9 (9/16 * 100)

  // Define sendFrames with useCallback before using it in useEffect
  const sendFrames = useCallback(() => {
    // Get the current streamId from the ref instead of the state
    const currentStreamId = currentStreamIdRef.current;
    
    if (!isStreamingRef.current || !currentStreamId || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.log("Not streaming, or WebSocket not ready", {
        isStreamingRef: isStreamingRef.current,
        currentStreamIdRef: currentStreamIdRef.current,
        wsReadyState: wsRef.current?.readyState
      });
      
      // If WebSocket is closed but we're still supposed to be streaming, retry in a bit
      if (isStreamingRef.current && currentStreamId && (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN)) {
        console.log("WebSocket disconnected during streaming, will retry frames in 1s");
        frameTimeoutRef.current = setTimeout(sendFrames, 1000);
      }
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas) {
      console.error("Video or canvas element not found");
      return;
    }
    
    // Check if video is actually playing
    if (video.readyState < 2 || video.paused || video.ended) {
      console.log("Video not ready yet, retrying in 500ms...", {
        readyState: video.readyState,
        paused: video.paused,
        ended: video.ended
      });
      frameTimeoutRef.current = setTimeout(sendFrames, 500);
      return;
    }
    
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.error("Could not get canvas context");
      return;
    }
    
    // Ensure canvas dimensions match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      console.log(`Updating canvas dimensions to ${video.videoWidth}x${video.videoHeight}`);
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    
    try {
      // Draw video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Get data URL from canvas
      const frame = canvas.toDataURL('image/jpeg', 0.7);
      
      // Send frame data
      console.log(`FRAME DEBUG: Sending frame #${frameCounterRef.current}, size: ${Math.round(frame.length / 1024)}KB, stream: ${currentStreamId}`);
      
      // Update processing status
      setProcessingFrame(true);
      setStatus(`Streaming: Processing frame #${frameCounterRef.current}`);
      
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        streamId: currentStreamId,
        frame: frame,
        frameNumber: frameCounterRef.current++,
        requiresProcessing: true // Add flag to indicate this frame needs ML processing
      }));
      
      // Schedule next frame with a timeout to match processing time (5 seconds)
      // Add a small buffer to account for network delays
      frameTimeoutRef.current = setTimeout(() => {
        setProcessingFrame(false);
        setStatus(`Streaming: Sent ${frameCounterRef.current} frames`);
        sendFrames();
      }, 5500);
      
    } catch (err) {
      console.error("Error sending frame:", err);
      setError("Failed to send frame: " + (err instanceof Error ? err.message : String(err)));
      // Retry after a delay if there was an error
      frameTimeoutRef.current = setTimeout(sendFrames, 2000);
    }
  }, []);

  // Define a function to establish the WebSocket connection
  const establishWebSocketConnection = useCallback(() => {
    // Close any existing connection
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      wsRef.current.close();
    }
    
    // We need to generate a proper stream ID
    const newStreamId = "stream_" + Math.random().toString(36).substring(2, 15);
    console.log(`Generated stream ID: ${newStreamId}`);
    
    // Use the environment variable for WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    
    // With Modal, the streamId is part of the URL path
    const fullWsUrl = `${wsUrl}/broadcaster/${newStreamId}`;
    
    console.log(`Connecting to WebSocket at: ${fullWsUrl}`);
    try {
      const ws = new WebSocket(fullWsUrl);
      wsRef.current = ws;
      
      // Log WebSocket state changes
      const logState = () => {
        const states = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
        console.log(`WebSocket state: ${states[ws.readyState]}`);
      };
      
      // Log state immediately
      logState();
      
      // Set up a timer to periodically log WebSocket state
      const stateInterval = setInterval(logState, 1000);
      
      ws.onopen = () => {
        console.log("WebSocket connection established as broadcaster");
        setStatus("Connected to server");
        setWsConnected(true);
        clearInterval(stateInterval);
        
        // Send a ping to test bi-directional communication
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log("Sent ping to test connection");
        } catch (err) {
          console.error("Error sending ping:", err);
        }
        
        // Stream is created automatically by connecting to the broadcaster path
        setStreamId(newStreamId);
        setIsStreaming(true);
        isStreamingRef.current = true;
        currentStreamIdRef.current = newStreamId;
        setStatus(`Streaming with ID: ${newStreamId}`);
        
        // Start sending frames
        console.log(`Starting to send frames for stream: ${newStreamId}`);
        const startSendingFrames = () => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            console.log(`Starting frames for stream ${newStreamId}`);
            sendFrames();
          } else {
            console.error("WebSocket not ready when trying to send first frame");
            setTimeout(startSendingFrames, 500);
          }
        };
        
        // Start after a small delay to ensure everything is ready
        setTimeout(startSendingFrames, 100);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received WebSocket message:", data);
          
          if (data.type === 'processing_update') {
            // Handle processing updates from server
            setStatus(`Streaming: ${data.status || 'Processing frame...'}`);
          }
          else if (data.type === 'error') {
            console.error("Error from server:", data.message);
            setError(data.message);
            setStatus("Error: " + data.message);
          }
        } catch (err) {
          console.error("Error parsing WebSocket message:", err);
          setError("Failed to parse server message");
        }
      };
      
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Try to get more information about the error
        if (error instanceof Event && error.target) {
          console.error("WebSocket error details:", {
            url: fullWsUrl,
            readyState: ws.readyState,
            bufferedAmount: ws.bufferedAmount
          });
        }
        setError("WebSocket error occurred - check console for details");
        setStatus("Connection error");
        setWsConnected(false);
        clearInterval(stateInterval);
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket connection closed with code ${event.code} and reason: ${event.reason || 'No reason provided'}`);
        setStatus(`Disconnected (code: ${event.code})`);
        setWsConnected(false);
        clearInterval(stateInterval);
        
        // Only stop streaming if we were actively streaming
        if (isStreamingRef.current) {
          setIsStreaming(false);
        }
      };
      
      return ws;
    } catch (err: unknown) {
      console.error("Error creating WebSocket:", err);
      setError(`Failed to create WebSocket: ${err instanceof Error ? err.message : String(err)}`);
      setStatus("Connection failed");
      return null;
    }
  }, [sendFrames]);
  
  // Clean up WebSocket on component unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up WebSocket connection on component unmount");
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
        requestAnimationFrameRef.current = null;
      }
      if (frameTimeoutRef.current) {
        clearTimeout(frameTimeoutRef.current);
        frameTimeoutRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const startStream = async () => {
    setError(null);
    setStatus("Starting stream...");
    
    try {
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log("Video metadata loaded");
        if (videoRef.current) {
          const videoWidth = videoRef.current.videoWidth;
          const videoHeight = videoRef.current.videoHeight;
          console.log(`Video dimensions: ${videoWidth}x${videoHeight}`);
          
          // Calculate and set aspect ratio based on actual video dimensions
          const ratio = (videoHeight / videoWidth) * 100;
          setAspectRatio(`${ratio}%`);
          
          videoRef.current.play().catch(err => {
            console.error("Error playing video:", err);
            setError("Failed to play video: " + err.message);
          });
        }
      };
      
      videoRef.current.oncanplay = () => {
        console.log("Video can play now");
        
        if (canvasRef.current && videoRef.current) {
          // Set canvas dimensions to match video
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          console.log(`Canvas dimensions set to: ${canvasRef.current.width}x${canvasRef.current.height}`);
          
          // Now that video is ready, establish the WebSocket connection
          setStatus("Stream ready. Establishing WebSocket connection...");
          establishWebSocketConnection();
        } else {
          console.error("Canvas or video element not found");
          setError("Cannot start stream: Canvas or video not ready");
        }
      };
      
    } catch (err) {
      console.error("Error accessing camera:", err);
      setError("Failed to access camera: " + (err instanceof Error ? err.message : String(err)));
      setStatus("Error: Camera access failed");
    }
  };

  const stopStream = () => {
    setStatus("Stopping stream...");
    
    // Stop animation frame
    if (requestAnimationFrameRef.current) {
      cancelAnimationFrame(requestAnimationFrameRef.current);
      requestAnimationFrameRef.current = null;
    }
    
    // Clear any scheduled frame sending
    if (frameTimeoutRef.current) {
      clearTimeout(frameTimeoutRef.current);
      frameTimeoutRef.current = null;
    }
    
    // Stop video tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    setIsStreaming(false);
    isStreamingRef.current = false;
    setStreamId(null);
    currentStreamIdRef.current = null;
    setStatus("Stream stopped");
  };

  return (
    <div className="container flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle>Broadcast Live</CardTitle>
          <CardDescription>
            AI-Stylized livestream (processing takes ~5 seconds per frame)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div 
            className="relative rounded-md overflow-hidden bg-black"
            style={{ 
              paddingTop: aspectRatio, // Dynamic aspect ratio
              position: "relative" 
            }}
          >
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain"
              muted
              playsInline
            />
            {processingFrame && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <div className="text-white text-center p-4">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-white mb-2"></div>
                  <p>Processing frame with AI diffusion model...</p>
                  <p className="text-sm text-gray-300">(Takes ~5 seconds per frame)</p>
                </div>
              </div>
            )}
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
              {error}
            </div>
          )}
          
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-sm font-medium">Status: {status}</p>
            <p className="text-sm">WebSocket: {wsConnected ? "Connected" : "Disconnected"}</p>
            <p className="text-sm">Note: Each frame is processed with an AI diffusion model (~5 seconds/frame)</p>
            {streamId && (
              <p className="text-sm mt-2">
                Share this link to let others watch your stream:
                <br />
                <a
                  href={`${window.location.origin}/watch/${streamId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline break-all"
                >
                  {`${window.location.origin}/watch/${streamId}`}
                </a>
              </p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          {!isStreaming ? (
            <Button onClick={startStream}>Start Streaming</Button>
          ) : (
            <Button onClick={stopStream} variant="destructive">Stop Streaming</Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
} 