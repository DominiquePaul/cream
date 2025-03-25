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
        setTimeout(sendFrames, 1000);
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
      setTimeout(sendFrames, 500);
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
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        streamId: currentStreamId,
        frame: frame,
        frameNumber: frameCounterRef.current++
      }));
      
      // Log every 10 frames
      if (frameCounterRef.current % 10 === 0) {
        console.log(`Sent frame #${frameCounterRef.current}, size: ${Math.round(frame.length / 1024)}KB`);
        setStatus(`Streaming: Sent ${frameCounterRef.current} frames`);
      }
      
      // Request next frame
      requestAnimationFrameRef.current = requestAnimationFrame(sendFrames);
    } catch (err) {
      console.error("Error sending frame:", err);
      setError("Failed to send frame: " + (err instanceof Error ? err.message : String(err)));
    }
  }, []);

  // WebSocket setup
  useEffect(() => {
    console.log("Setting up WebSocket connection");
    
    // Use the environment variable for WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    
    console.log(`Connecting to WebSocket at: ${wsUrl}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log("WebSocket connection established");
      setStatus("Connected to server");
      setWsConnected(true);
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log("Received WebSocket message:", data);
        
        if (data.type === 'stream_created') {
          console.log(`Stream created with ID: ${data.streamId}`);
          
          // Update streamId and isStreaming state
          const newStreamId = data.streamId;
          setStreamId(newStreamId);
          setIsStreaming(true);
          isStreamingRef.current = true;
          currentStreamIdRef.current = newStreamId;
          setStatus(`Streaming with ID: ${newStreamId}`);
          
          // Start sending frames directly with the new streamId
          console.log(`Starting to send frames for stream: ${newStreamId}`);
          // Capture these values now, since state update hasn't propagated yet
          const startSendingFrames = () => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              console.log(`Starting frames for stream ${newStreamId} (direct access)`);
              const video = videoRef.current;
              const canvas = canvasRef.current;
              
              if (!video || !canvas) {
                console.error("Video or canvas element not found when starting frames");
                setTimeout(startSendingFrames, 500);
                return;
              }
              
              // Check if video is actually playing
              if (video.readyState < 2 || video.paused || video.ended) {
                console.log("Video not ready yet when starting frames, retrying in 500ms...");
                setTimeout(startSendingFrames, 500);
                return;
              }
              
              const ctx = canvas.getContext('2d');
              if (!ctx) {
                console.error("Could not get canvas context when starting frames");
                setTimeout(startSendingFrames, 500);
                return;
              }
              
              // Draw video frame to canvas
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              
              // Get data URL from canvas
              const frame = canvas.toDataURL('image/jpeg', 0.7);
              
              // Send frame data
              console.log(`FRAME DEBUG: Sending first frame for stream: ${newStreamId}, size: ${Math.round(frame.length / 1024)}KB`);
              
              try {
                wsRef.current.send(JSON.stringify({
                  type: 'frame',
                  streamId: newStreamId,
                  frame: frame,
                  frameNumber: frameCounterRef.current++
                }));
                
                // Continue the frame sending loop with direct call instead of requestAnimationFrame
                console.log("Continuing frame sending loop from first frame - direct call");
                sendFrames();
              } catch (err) {
                console.error("Error sending initial frame:", err);
                setTimeout(startSendingFrames, 500);
              }
            } else {
              console.error("WebSocket not ready when trying to send first frame");
              setTimeout(startSendingFrames, 500);
            }
          };
          
          // Start after a small delay to ensure everything is ready
          setTimeout(startSendingFrames, 100);
        } else if (data.type === 'error') {
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
      setError("WebSocket error occurred");
      setStatus("Connection error");
      setWsConnected(false);
    };
    
    ws.onclose = () => {
      console.log("WebSocket connection closed");
      setStatus("Disconnected");
      setWsConnected(false);
      
      // Only stop streaming if we were actively streaming
      if (isStreamingRef.current) {
        setIsStreaming(false);
      }
    };
    
    return () => {
      console.log("Cleaning up WebSocket connection");
      if (requestAnimationFrameRef.current) {
        cancelAnimationFrame(requestAnimationFrameRef.current);
        requestAnimationFrameRef.current = null;
      }
      ws.close();
    };
  }, [sendFrames]);

  const startStream = async () => {
    setError(null);
    setStatus("Starting stream...");
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket not connected");
      setStatus("Error: WebSocket not connected");
      return;
    }
    
    try {
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      
      videoRef.current.onloadedmetadata = () => {
        console.log("Video metadata loaded");
        if (videoRef.current) {
          console.log(`Video dimensions: ${videoRef.current.videoWidth}x${videoRef.current.videoHeight}`);
          videoRef.current.play().catch(err => {
            console.error("Error playing video:", err);
            setError("Failed to play video: " + err.message);
          });
        }
      };
      
      videoRef.current.oncanplay = () => {
        console.log("Video can play now");
        
        if (canvasRef.current && videoRef.current && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          // Set canvas dimensions to match video
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          console.log(`Canvas dimensions set to: ${canvasRef.current.width}x${canvasRef.current.height}`);
          
          // Start stream
          wsRef.current.send(JSON.stringify({
            type: 'start_stream'
          }));
          
          // Don't start sending frames yet, wait for stream ID
          setStatus("Requesting stream ID...");
        } else {
          console.error("Cannot start stream: WebSocket not ready");
          setError("Cannot start stream: WebSocket connection issue");
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
            Start streaming your webcam to the world
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative aspect-video rounded-md overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="w-full h-full object-contain"
              muted
              playsInline
            />
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