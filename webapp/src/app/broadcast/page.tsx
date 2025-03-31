"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState, useCallback } from "react";
import AdminDebug from '@/components/AdminDebug';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';

// Define global types for the window object
declare global {
  interface Window {
    lastProcessedFrameTime?: Date;
    frameProcessingTimes?: number[];
    frameSkipCounter?: number;
    frameFetcherInterval?: NodeJS.Timeout;
    viewerWs?: WebSocket;
    latestFrameRetryCount: number;
    latestFrameRetryTimer?: NodeJS.Timeout;
  }
}

export default function BroadcastPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [streamId, setStreamId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing camera...");
  const frameCounterRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const isStreamingRef = useRef(false);
  const currentStreamIdRef = useRef<string | null>(null);
  const frameTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processingTimesRef = useRef<number[]>([]);
  
  // Image display states (adopting from watch page)
  const [imageData, setImageData] = useState<string | null>(null); // Current displayed image
  const [nextImageData, setNextImageData] = useState<string | null>(null); // Next image to display
  const [showProcessedView, setShowProcessedView] = useState(false);
  const isTogglingViewRef = useRef(false); // Add this ref outside the callback
  
  const [aspectRatio, setAspectRatio] = useState("56.25%"); // Default 16:9 (9/16 * 100)
  const [stylePrompt, setStylePrompt] = useState("A painting in the style of van Gogh's 'Starry Night'");
  const [customPrompt, setCustomPrompt] = useState("");
  const [updatingPrompt, setUpdatingPrompt] = useState(false);
  
  const { isAdmin } = useAuth();
  
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
    
    // If we're viewing the processed view, ensure we have a processed image before sending more frames
    if (showProcessedView && !nextImageData && !imageData) {
      console.log("Waiting for processed image before sending more frames");
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
      
      // Get data URL from canvas with REDUCED quality for faster transmission
      const frame = canvas.toDataURL('image/jpeg', 0.5); // Reduced from 0.7 to 0.5
      
      // Send frame data
      console.log(`FRAME DEBUG: Sending frame #${frameCounterRef.current}, size: ${Math.round(frame.length / 1024)}KB, stream: ${currentStreamId}`);
      
      // Update UI to show we're sending frames
      setStatus(`Streaming: Sending frame #${frameCounterRef.current}`);
      
      wsRef.current.send(JSON.stringify({
        type: 'frame',
        streamId: currentStreamId,
        frame: frame,
        frameNumber: frameCounterRef.current++,
        requiresProcessing: true // Add flag to indicate this frame needs ML processing
      }));
      
      // Calculate optimal delay based on recent processing times
      let nextFrameDelay = 1500; // Default 1.5s delay
      
      if (processingTimesRef.current.length > 0) {
        // Use average of recent processing times + a small buffer
        const avgProcessingTime = processingTimesRef.current.reduce((sum, time) => sum + time, 0) / processingTimesRef.current.length;
        // Add 200ms buffer to avoid overwhelming the server
        nextFrameDelay = Math.max(avgProcessingTime * 1000 + 200, 1000);
        console.log(`Adaptive frame rate: Setting next frame delay to ${nextFrameDelay.toFixed(0)}ms based on avg processing time of ${avgProcessingTime.toFixed(2)}s`);
      }
      
      // Schedule next frame with dynamic timing
      frameTimeoutRef.current = setTimeout(() => {
        sendFrames();
      }, nextFrameDelay);
      
    } catch (err) {
      console.error("Error sending frame:", err);
      setError("Failed to send frame: " + (err instanceof Error ? err.message : String(err)));
      // Retry after a delay if there was an error
      frameTimeoutRef.current = setTimeout(sendFrames, 2000);
    }
  }, [showProcessedView, imageData, nextImageData]);

  // Setup message handler with enhanced error handling and debugging
  const setupMessageHandler = useCallback(() => {
    if (!wsRef.current) {
      console.error("WebSocket not initialized");
      return;
    }

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log(`Received WebSocket message type: ${data.type}`);

        // Handle different message types
        if (data.type === "pong") {
          console.log("Received pong response");
        } else if (data.type === "processor_info") {
          console.log(`Server is using processor: ${data.processor_type}`);
        } else if (data.type === "prompt_updated") {
          console.log(`Style prompt updated to: ${data.prompt}`);
          setStylePrompt(data.prompt);
          setUpdatingPrompt(false);
        } else if (data.type === "subscription_confirmed") {
          console.log("✅ Successfully subscribed to processed frames");
        } else if (data.type === "unsubscription_confirmed") {
          console.log("Successfully unsubscribed from processed frames");
        } else if (data.type === "latest_frame") {
          console.log("Received latest_frame response");
          if (data.frame && typeof data.frame === 'string' && data.frame.startsWith('data:image')) {
            console.log(`✅ Received latest frame of size: ${data.frame.length}`);
            setNextImageData(data.frame);
            setImageData(data.frame);
          } else {
            console.log("No latest frame available yet");
          }
        } else if (data.type === "frame" && data.processed === true) {
          console.log(`✅ Received processed frame of size: ${data.frame.length}`);
          if (showProcessedView && data.frame && typeof data.frame === 'string' && data.frame.startsWith('data:image')) {
            // Set the image data directly for immediate display
            setNextImageData(data.frame);
            setImageData(data.frame);
            console.log("Updated image data with processed frame");
          }
        } else if (data.type === "frame_skipped") {
          console.log("Frame skipped by server:", data.message);
        } else if (data.type === "error") {
          console.error("Error from server:", data.message);
          setError(data.message);
        } else {
          console.log("Other message type:", data.type);
        }
      } catch (error) {
        console.error("Error handling WebSocket message:", error);
      }
    };
  }, [showProcessedView]);

  // Image loading effect - adopted from watch page for proper image handling
  useEffect(() => {
    console.log(`🔄 Image loading effect triggered:
    - nextImageData changed: ${!!nextImageData}
    - imageData: ${!!imageData}
    - Are they different: ${nextImageData !== imageData}`);
    
    if (nextImageData && nextImageData !== imageData) {
      console.log("Starting image preload process");
      
      // Use a shorter timeout to show the next frame faster
      const transitionTimeout = setTimeout(() => {
        console.log("⏱️ Fallback timeout triggered - setting image data");
        setImageData(nextImageData);
      }, 50); // Much shorter transition for smoother updates
      
      // Create a new Image to preload
      const preloadImg = new window.Image();
      preloadImg.onload = () => {
        // Clear timeout as image is ready now
        console.log(`✅ Preload image loaded: ${preloadImg.width}x${preloadImg.height}`);
        clearTimeout(transitionTimeout);
        // Only update state after successful preload
        setImageData(nextImageData);
      };
      preloadImg.onerror = (e: Event | string) => {
        console.error("❌ Error preloading image:", e);
        // Still update the image data even on error to avoid getting stuck
        setImageData(nextImageData);
      };
      
      // Start loading
      console.log("Starting to load image...");
      preloadImg.src = nextImageData;
      console.log("Image src set");
      
      // Clean up function
      return () => {
        console.log("Cleaning up image loading effect");
        clearTimeout(transitionTimeout);
        preloadImg.onload = null;
        preloadImg.onerror = null;
      };
    }
  }, [nextImageData, imageData]);

  // Add a toggle view handler to properly handle the view switch
  const toggleView = useCallback(() => {
    console.log("Toggle view called - syncing view state");
    
    if (isTogglingViewRef.current) {
      console.log("Toggle already in progress, ignoring duplicate call");
      return;
    }
    
    isTogglingViewRef.current = true;
    
    // setTimeout to ensure React state is stable before we access it
    setTimeout(() => {
      setShowProcessedView(prevState => {
        const newState = !prevState;
        
        console.log(`🔀 Toggling view: ${prevState ? 'processed' : 'camera'} -> ${newState ? 'processed' : 'camera'}`);
        console.log("Current image state:", { 
          hasImageData: !!imageData, 
          hasNextImageData: !!nextImageData,
          imageDataLength: imageData ? imageData.length : 0,
          nextImageDataLength: nextImageData ? nextImageData.length : 0 
        });
        
        // If switching to processed view, subscribe to processed frames
        if (newState && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("Subscribing to processed frames");
          wsRef.current.send(JSON.stringify({
            type: "subscribe_to_processed_frames"
          }));
          
          // Clear image state when toggling to processed view
          setImageData(null);
          setNextImageData(null);
          
          // Request the latest processed frame immediately
          console.log("Requesting latest processed frame");
          wsRef.current.send(JSON.stringify({
            type: "get_latest_frame"
          }));
          
          // Set up a continuous polling mechanism to get updates at the same rate as viewers
          // This replaces the retry mechanism with a continuous poller
          if (window.latestFrameRetryTimer) {
            clearInterval(window.latestFrameRetryTimer);
          }
          
          window.latestFrameRetryTimer = setInterval(() => {
            if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
              console.log(`Polling: Requesting latest processed frame`);
              wsRef.current.send(JSON.stringify({
                type: "get_latest_frame"
              }));
            }
          }, 1000); // Poll every second continuously
        }
        
        // If switching back to camera view, unsubscribe from processed frames
        if (!newState && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          console.log("Unsubscribing from processed frames");
          wsRef.current.send(JSON.stringify({
            type: "unsubscribe_from_processed_frames"
          }));
          
          // Clear any polling timers
          if (window.latestFrameRetryTimer) {
            clearInterval(window.latestFrameRetryTimer);
            window.latestFrameRetryTimer = undefined;
          }
        }
        
        return newState;
      });
      
      // Reset toggle flag after state update
      isTogglingViewRef.current = false;
    }, 0);
  }, [imageData, nextImageData]);

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
    // Remove the 'ws/' prefix to avoid double 'ws/ws/'
    const fullWsUrl = wsUrl.endsWith('/') 
      ? `${wsUrl}broadcaster/${newStreamId}` 
      : `${wsUrl}/broadcaster/${newStreamId}`;
    
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
          
          // Test endpoint call - request server version to check communication
          ws.send(JSON.stringify({ type: 'get_server_info' }));
          console.log("Sent server info request to test bi-directional communication");
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
        
        // Setup message handler with our new handler
        setupMessageHandler();
      };
      
      // Replace the onmessage handler with our setup function call
      setupMessageHandler();
      
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
  }, [sendFrames, setupMessageHandler]);
  
  // Clean up all WebSocket connections on component unmount
  useEffect(() => {
    return () => {
      console.log("Cleaning up WebSocket connections on component unmount");
      
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
      
      if (window.viewerWs) {
        window.viewerWs.close();
        window.viewerWs = undefined;
      }
      
      if (window.frameFetcherInterval) {
        clearInterval(window.frameFetcherInterval);
        window.frameFetcherInterval = undefined;
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

  // Function to update the style prompt
  const updateStylePrompt = () => {
    if (!customPrompt || customPrompt.trim() === '') {
      setError("Please enter a style prompt");
      return;
    }
    
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError("WebSocket connection not open");
      return;
    }
    
    try {
      setUpdatingPrompt(true);
      setStatus("Updating style prompt...");
      
      wsRef.current.send(JSON.stringify({
        type: 'update_prompt',
        prompt: customPrompt.trim()
      }));
      
      // The actual update will be confirmed by the server
    } catch (err) {
      console.error("Error sending prompt update:", err);
      setError("Failed to update style: " + (err instanceof Error ? err.message : String(err)));
      setUpdatingPrompt(false);
    }
  };

  return (
    <div className="container mx-auto px-2 flex items-center justify-center min-h-screen py-10">
      <Card className="w-full max-w-4xl">
        <CardHeader>
          <CardTitle>Broadcast Live</CardTitle>
          <CardDescription>
            AI-Stylized livestream with continuous frame capturing and real-time processing
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
            {/* For debugging */}
            {(() => {
              console.log(`Render: showProcessedView=${showProcessedView}, hasImageData=${!!imageData}, hasNextImageData=${!!nextImageData}`);
              return null;
            })()}
            
            {/* Original webcam view */}
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-contain"
              style={{ display: showProcessedView ? 'none' : 'block' }}
              muted
              playsInline
            />
            
            {/* Processed image view - Using the same approach as watch page */}
            {showProcessedView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                {imageData ? (
                  <div className="absolute inset-0 w-full h-full">
                    <Image
                      src={imageData}
                      alt="Processed stream"
                      fill
                      style={{
                        objectFit: 'contain'
                      }}
                      onLoad={() => {
                        console.log("✅ Processed image loaded successfully");
                      }}
                      onError={(err: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        console.error("❌ Processed image failed to load", err);
                      }}
                    />
                  </div>
                ) : (
                  <div className="text-white text-center p-4">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-white mb-2"></div>
                    <p>Waiting for the first processed frame...</p>
                    <p className="text-sm text-gray-300 mt-2">
                      (This may take a few seconds as the AI model processes your video)
                    </p>
                    
                    <button 
                      onClick={() => {
                        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                          console.log("Manual refresh: Requesting latest processed frame");
                          wsRef.current.send(JSON.stringify({
                            type: "get_latest_frame"
                          }));
                        }
                      }} 
                      className="mt-4 px-3 py-1 bg-blue-500 hover:bg-blue-600 rounded"
                    >
                      Request Latest Frame
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Processing indicator overlay */}
            {false && !showProcessedView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-20">
                <div className="text-white text-center">
                  <div className="inline-block animate-spin rounded-full h-10 w-10 border-t-2 border-white mb-2"></div>
                  <p>AI Processing...</p>
                </div>
              </div>
            )}
            
            {/* View toggle button */}
            {isStreaming && (
              <div className="absolute top-2 right-2 z-10">
                <button
                  onClick={toggleView}
                  className="px-3 py-2 bg-black/70 text-white text-sm rounded-md hover:bg-black/90 transition-colors"
                >
                  {showProcessedView ? "Show Camera" : "Show what viewers are seeing"}
                </button>
              </div>
            )}
          </div>
          
          <canvas ref={canvasRef} className="hidden" />
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600">
              {error}
            </div>
          )}
          
          {isStreaming && (
            <div className="space-y-2">
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium">Current Style:</p>
                <p className="text-sm">{stylePrompt}</p>
              </div>
              
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Enter a new style prompt..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  disabled={!isStreaming || updatingPrompt}
                />
                <button
                  onClick={updateStylePrompt}
                  disabled={!isStreaming || updatingPrompt || !customPrompt}
                  className={`px-4 py-2 rounded-md ${
                    !isStreaming || updatingPrompt || !customPrompt
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-500 hover:bg-blue-600 text-white'
                  }`}
                >
                  {updatingPrompt ? 'Updating...' : 'Update Style'}
                </button>
              </div>
              
              <div className="text-xs text-gray-500">
                <p>Prompt examples:</p>
                <ul className="list-disc pl-4">
                  <li className="cursor-pointer hover:underline" onClick={() => setCustomPrompt("A Monet-style impressionist painting")}>A Monet-style impressionist painting</li>
                  <li className="cursor-pointer hover:underline" onClick={() => setCustomPrompt("A cubist painting in the style of Picasso")}>A cubist painting in the style of Picasso</li>
                  <li className="cursor-pointer hover:underline" onClick={() => setCustomPrompt("A modern pop art masterpiece")}>A modern pop art masterpiece</li>
                  <li className="cursor-pointer hover:underline" onClick={() => setCustomPrompt("A watercolor illustration")}>A watercolor illustration</li>
                </ul>
              </div>
            </div>
          )}
          
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <p className="text-sm font-medium">Status: {status}</p>
            <p className="text-sm">WebSocket: {wsConnected ? "Connected" : "Disconnected"}</p>
            <p className="text-sm">Note: Frames are continuously sent and processed at maximum possible speed</p>
            {streamId && (
              <>
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
              </>
            )}
          </div>
          
          {isAdmin && <AdminDebug />}
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