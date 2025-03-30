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
  const [nextImageData, setNextImageData] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const router = useRouter();
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const connectedRef = useRef(false);
  const framesReceivedRef = useRef(0);
  const frameTimestampsRef = useRef<Date[]>([]);
  const [stylePrompt, setStylePrompt] = useState<string>("Default style");
  const [isFullScreen, setIsFullScreen] = useState(false);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const reconnectAttempts = useRef(0);
  
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
      return () => {}; // Return empty cleanup function
    }
    
    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    // Only create a new connection if we don't have one open or connecting
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket already connecting");
      return () => {}; // Return empty cleanup function
    }
    
    console.log(`Setting up WebSocket to watch stream: ${streamId}`);
    
    // Use the environment variable for WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080';
    
    // Format the URL with the proper path pattern for Modal
    // Remove the 'ws/' prefix to avoid double 'ws/ws/'
    const fullWsUrl = wsUrl.endsWith('/') 
      ? `${wsUrl}viewer/${streamId}` 
      : `${wsUrl}/viewer/${streamId}`;
    
    console.log(`Connecting to WebSocket at: ${fullWsUrl}`);
    
    // Clean up any existing WebSocket before creating a new one
    if (wsRef.current) {
      try {
        wsRef.current.onclose = null; // Remove onclose to prevent reconnection loop
        wsRef.current.close();
      } catch (e) {
        console.error("Error closing existing WebSocket:", e);
      }
    }
    
    const ws = new WebSocket(fullWsUrl);
    wsRef.current = ws;

    // Improved heartbeat mechanism
    const heartbeatInterval = 15000; // 15 seconds
    let missedHeartbeats = 0;
    const maxMissedHeartbeats = 3;
    
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          missedHeartbeats++;
          if (missedHeartbeats > maxMissedHeartbeats) {
            console.log(`Missed ${missedHeartbeats} heartbeats, reconnecting...`);
            // Close and let the onclose handler reconnect
            ws.close();
            return;
          }
          
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log(`Heartbeat sent (missed: ${missedHeartbeats})`);
        } catch (err) {
          console.error("Error sending ping:", err);
        }
      }
    }, heartbeatInterval);
    
    // Reset heartbeat counter when we receive any message
    const resetHeartbeat = () => {
      missedHeartbeats = 0;
    };
    
    // Store status timeout to clear it on cleanup
    let statusTimeoutId: NodeJS.Timeout | null = null;
    
    // Set flags to track connection state
    const isFirstConnection = framesReceivedRef.current === 0;
    let connectionClosed = false;
    
    ws.onopen = () => {
      console.log("WebSocket connection established, joining stream");
      
      // Only set the connecting status if we're not already showing frames
      if (!imageData && !nextImageData) {
        setStatus("Connected, joining stream...");
      }
      
      setWsConnected(true);
      resetHeartbeat();
      
      // Set a timeout to update status if no frames arrive within 5 seconds
      statusTimeoutId = setTimeout(() => {
        if (framesReceivedRef.current === 0 && ws.readyState === WebSocket.OPEN && !connectionClosed) {
          setStatus("Waiting for broadcaster to send frames...");
        }
      }, 5000);
      
      // Only request style prompt if this is our first connection (no frames received yet)
      if (isFirstConnection) {
        try {
          // Request style prompt immediately
          ws.send(JSON.stringify({
            type: 'get_style_prompt',
            streamId: streamId
          }));
          console.log("Requested current style prompt");
          
          // Also request a list of available streams
          ws.send(JSON.stringify({
            type: 'ping'
          }));
        } catch (err) {
          console.error("Error sending initial requests:", err);
        }
      } else {
        console.log("Reconnected, already have frames - not requesting style prompt");
      }
    };
    
    // Use a wrapped message handler to reset heartbeats on any message
    const originalOnMessage = (event: MessageEvent) => {
      resetHeartbeat(); // Reset heartbeat counter on any message received
      
      try {
        const data = JSON.parse(event.data);
        console.log("WATCH DEBUG: Received message type:", data.type);
        
        if (data.type === 'pong') {
          // Just a heartbeat response, already reset the counter
          return;
        }
        
        // Original message handling...
        // We may not get a joined_stream message with the Modal app
        // The connection is already established by connecting to the correct path
        if (data.type === 'joined_stream') {
          console.log(`Successfully joined stream: ${data.streamId}`);
          setConnected(true);
          setStatus("Connected to stream. Waiting for frames...");
        } 
        else if (data.type === 'frame') {
          // Always update connection status on frame
          if (!connectedRef.current) {
            setConnected(true);
          }
          
          // Always update status to show we're receiving frames
          if (status === "Connected, joining stream..." || status === "Connecting..." || framesReceivedRef.current === 0) {
            setStatus("Receiving AI-processed stream");
            console.log("WATCH DEBUG: Updating status to 'Receiving AI-processed stream'");
          }
          
          console.log(`Implicitly joined stream by receiving frames`);
          
          if (!data.frame) {
            console.error("WATCH DEBUG: Received frame message with no frame data");
            return;
          }
          
          const frameSize = data.frame.length;
          // Log more detailed information about each received frame
          console.log(`WATCH DEBUG: Received frame #${framesReceivedRef.current + 1}, size: ${Math.round(frameSize / 1024)}KB, is_original: ${data.is_original}, processed: ${data.processed}, processor_type: ${data.processor_type || 'unknown'}, keys: ${Object.keys(data).join(',')}`);
          
          // Validate the frame data (should be a valid data URL)
          if (!data.frame.startsWith('data:image')) {
            console.error(`WATCH DEBUG: Invalid frame data, doesn't start with 'data:image'`);
            return;
          }
          
          // Calculate time since last frame
          const now = new Date();
          
          // Store the timestamp for frame rate calculation
          frameTimestampsRef.current.push(now);
          // Keep only the last 5 timestamps
          if (frameTimestampsRef.current.length > 5) {
            frameTimestampsRef.current.shift();
          }
          
          // Calculate average frame rate if we have at least 2 timestamps
          if (frameTimestampsRef.current.length >= 2) {
            const timestamps = frameTimestampsRef.current;
            const totalTimeSeconds = (timestamps[timestamps.length - 1].getTime() - timestamps[0].getTime()) / 1000;
            // Calculate frames per second (using n-1 time intervals between n points)
            const fps = totalTimeSeconds > 0 ? (timestamps.length - 1) / totalTimeSeconds : 0;
            // Inverse gives seconds per frame
            const spf = fps > 0 ? 1 / fps : 0;
            setProcessingStatus(`AI frame rate: ${fps.toFixed(2)} FPS (${spf.toFixed(1)}s/frame)`);
          } else if (lastFrameTime) {
            const timeSinceLastFrame = (now.getTime() - lastFrameTime.getTime()) / 1000;
            setProcessingStatus(`Latest processing: ${timeSinceLastFrame.toFixed(1)}s/frame`);
          }
          
          setLastFrameTime(now);
          
          // We only want to show AI-processed frames
          // Check both is_original and processed flags
          if (data.is_original === true || data.processed === false) {
            console.log("WATCH DEBUG: Ignoring original frame - waiting for AI-processed frames");
            // Don't set image data for original frames
            return;
          } else {
            // This is a processed frame - update display
            console.log("WATCH DEBUG: Received AI-processed frame - updating display");
            setNextImageData(data.frame);
          }
          
          // Update aspect ratio from first frame (or when dimensions change)
          // Only do this for the first frame or when we don't have an aspect ratio yet
          if ((framesReceivedRef.current === 0 || aspectRatio === "56.25%") && data.frame.startsWith('data:image')) {
            const img = new window.Image();
            img.onload = () => {
              const ratio = (img.height / img.width) * 100;
              setAspectRatio(`${ratio}%`);
              console.log(`Set aspect ratio to ${ratio}% based on image dimensions ${img.width}x${img.height}`);
              // Explicitly clean up to avoid memory leaks
              img.onload = null;
              img.src = '';
            };
            img.src = data.frame;
          }
          
          const newFrameCount = framesReceivedRef.current + 1;
          setFramesReceived(newFrameCount);
          
          // Calculate and display latency
          if (data.timestamp) {
            const now = Date.now();
            const latency = now - data.timestamp;
            setLastFrameTimestamp(latency);
            
            // Log detailed timing information periodically
            if (newFrameCount % 10 === 0 || latency > 5000) {
              console.log(`Frame #${newFrameCount} timing:`);
              console.log(`  Server timestamp: ${new Date(data.timestamp).toISOString()}`);
              console.log(`  Client received: ${new Date(now).toISOString()}`);
              console.log(`  Total latency: ${latency}ms (includes network transfer + processing time)`);
            }
          }
          
          // Update style prompt if included in the frame data
          if (data.style_prompt) {
            setStylePrompt(data.style_prompt);
          }
        } 
        else if (data.type === 'processing_update') {
          // Show processing status updates
          setProcessingStatus(data.status || "Processing frame...");
        }
        else if (data.type === 'style_updated') {
          // Handle style updates from the broadcaster
          console.log("Style updated by broadcaster:", data.prompt);
          setStylePrompt(data.prompt);
          
          // Only set status if we already have frames - otherwise keep the connecting status
          if (framesReceivedRef.current > 0) {
            setStatus(`Style updated: "${data.prompt}"`);
            
            // Set a timeout to revert the status after a few seconds
            setTimeout(() => {
              setStatus("Receiving AI-processed frames");
            }, 3000);
          } else {
            console.log("Style prompt received during initial connection, keeping current status");
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
    
    // Assign the wrapped handler
    ws.onmessage = originalOnMessage;
    
    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      if (!connectionClosed) {
        setError("WebSocket connection error occurred");
        setStatus("Connection error");
        setWsConnected(false);
      }
    };
    
    ws.onclose = (event) => {
      connectionClosed = true;
      console.log(`WebSocket connection closed with code ${event.code} and reason: ${event.reason || "No reason provided"}`);
      setWsConnected(false);
      
      // Only show disconnection if it's not a normal closure or if it's been too long since the last frame
      const isNormalClosure = event.code === 1000;
      const timeSinceLastFrame = lastFrameTime ? (new Date().getTime() - lastFrameTime.getTime()) / 1000 : Infinity;
      
      // More intelligent disconnect detection
      if (!isNormalClosure && (timeSinceLastFrame > 10 || !lastFrameTime)) {
        setConnected(false);
        // Don't change status if we're already showing frames
        if (!imageData && !nextImageData) {
          setStatus(`Disconnected from server (code: ${event.code})`);
        }
      } else {
        console.log(`WebSocket closed normally or brief disconnection, last frame was ${timeSinceLastFrame.toFixed(1)}s ago`);
      }
      
      // Clear the ping interval
      clearInterval(pingInterval);
      
      // Don't attempt to reconnect if we're actively viewing frames
      // This prevents disrupting the viewing experience with constant reconnects
      const shouldReconnect = !isNormalClosure && (!lastFrameTime || timeSinceLastFrame > 5);
      
      if (shouldReconnect) {
        // Try to reconnect after a delay, with increasing backoff for repeated failures
        const reconnectDelay = reconnectAttempts.current < 5 
          ? 1000 * Math.pow(2, reconnectAttempts.current) // Exponential backoff: 1s, 2s, 4s, 8s, 16s
          : 30000; // Max 30 seconds
        
        console.log(`Scheduling reconnect attempt ${reconnectAttempts.current + 1} in ${reconnectDelay / 1000}s`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          if (document.visibilityState === 'visible') {
            console.log(`Attempting to reconnect... (attempt ${reconnectAttempts.current + 1})`);
            if (!connectedRef.current) {
              setStatus("Reconnecting...");
            }
            reconnectAttempts.current += 1;
            connectWebSocket();
          } else {
            console.log("Page not visible, delaying reconnection until visibility changes");
          }
        }, reconnectDelay);
      } else {
        console.log("Not reconnecting due to normal closure or active streaming");
      }
    };
    
    // Clean up function
    return () => {
      console.log("Cleaning up WebSocket connection");
      clearInterval(pingInterval);
      
      // Clear status timeout if it exists
      if (statusTimeoutId) {
        clearTimeout(statusTimeoutId);
        statusTimeoutId = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      
      // Mark connection as closed to prevent further status updates
      connectionClosed = true;
      
      // Clean up all handlers before closing to prevent any reconnect loops
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      }
    };
  }, [streamId, lastFrameTime, imageData, nextImageData]);
  
  // Set up the WebSocket connection on mount or streamId change
  useEffect(() => {
    const cleanup = connectWebSocket();
    
    return () => {
      cleanup();
    };
  }, [connectWebSocket]);

  // Update the image loading part of the useEffect to be more efficient
  useEffect(() => {
    if (nextImageData && nextImageData !== imageData) {
      // Use a shorter timeout to show the next frame faster
      const transitionTimeout = setTimeout(() => {
        setImageData(nextImageData);
        setImageLoaded(true);
      }, 50); // Much shorter transition for smoother updates
      
      // Create a new Image to preload
      const preloadImg = new window.Image();
      preloadImg.onload = () => {
        // Clear timeout as image is ready now
        clearTimeout(transitionTimeout);
        // Only update state after successful preload
        setImageLoaded(true);
        setImageData(nextImageData);
      };
      preloadImg.onerror = (e: Event | string) => {
        console.error("Error preloading image:", e);
        // Still update the image data even on error to avoid getting stuck
        setImageLoaded(true);
        setImageData(nextImageData);
      };
      // Start loading
      preloadImg.src = nextImageData;
      
      // Clean up function
      return () => {
        clearTimeout(transitionTimeout);
        preloadImg.onload = null;
        preloadImg.onerror = null;
      };
    }
  }, [nextImageData, imageData]);

  // Add this effect to reconnect when the page becomes visible after being hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log("Page became visible, checking WebSocket connection");
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log("WebSocket not open, reconnecting");
          connectWebSocket();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [connectWebSocket]);

  // Add a more resilient connection check effect with debounce
  useEffect(() => {
    // Reset reconnection attempts when successfully connected
    if (wsConnected) {
      reconnectAttempts.current = 0;
    }
    
    let reconnecting = false;
    
    // Check websocket health periodically
    const checkInterval = setInterval(() => {
      if (wsRef.current) {
        if (wsRef.current.readyState !== WebSocket.OPEN && 
            wsRef.current.readyState !== WebSocket.CONNECTING && 
            !reconnecting) {
          
          console.log("WebSocket detected in closed/closing state during health check");
          reconnecting = true;
          
          // Add debounce to prevent rapid reconnection attempts
          setTimeout(() => {
            connectWebSocket();
            reconnecting = false;
          }, 2000);
        }
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(checkInterval);
  }, [wsConnected, connectWebSocket]);

  const handleRetry = () => {
    window.location.reload();
  };

  const handleBack = () => {
    router.push('/');
  };

  const toggleFullScreen = () => {
    if (!fullscreenContainerRef.current) return;
    
    if (!isFullScreen) {
      if (fullscreenContainerRef.current.requestFullscreen) {
        fullscreenContainerRef.current.requestFullscreen()
          .then(() => setIsFullScreen(true))
          .catch(err => console.error("Error attempting to enable fullscreen:", err));
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
          .then(() => setIsFullScreen(false))
          .catch(err => console.error("Error attempting to exit fullscreen:", err));
      }
    }
  };

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  return (
    <>
      {isFullScreen && (
        <div 
          ref={fullscreenContainerRef}
          className="fixed inset-0 z-50 bg-black flex items-center justify-center"
        >
          {connected && (imageData || nextImageData) && (
            <div className="absolute inset-0 w-full h-full">
              {nextImageData && (
                <Image 
                  src={nextImageData}
                  alt="Live stream"
                  fill
                  style={{ 
                    objectFit: 'contain',
                    opacity: imageLoaded ? 1 : 0,
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                  priority
                  unoptimized
                  width={0}
                  height={0}
                  onLoadingComplete={() => {
                    // Use onLoadingComplete which is more reliable in Next.js
                    setImageLoaded(true);
                    setImageData(nextImageData);
                    
                    // Update status if this is the first frame
                    if (framesReceivedRef.current <= 3 && status === "Connected, joining stream...") {
                      setStatus("Receiving AI-processed stream");
                    }
                  }}
                  onError={(e) => {
                    console.error("Error loading image in Next.js component:", e);
                    // Mark as loaded anyway to prevent UI from getting stuck
                    setImageLoaded(true);
                    setImageData(nextImageData);
                    
                    // Ensure status is updated even if there was an error
                    if (status === "Connected, joining stream...") {
                      setStatus("Receiving AI-processed stream");
                    }
                  }}
                />
              )}
              {imageData && nextImageData !== imageData && (
                <Image 
                  src={imageData}
                  alt="Previous frame"
                  fill
                  style={{ 
                    objectFit: 'contain',
                    opacity: nextImageData && imageLoaded ? 0 : 1,
                    transition: 'opacity 0.3s ease-in-out'
                  }}
                  priority
                  unoptimized
                  width={0}
                  height={0}
                />
              )}
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-md text-sm">
                {processingStatus || "AI-processed stream"}
              </div>
              
              <button
                onClick={toggleFullScreen}
                className="absolute top-2 right-2 bg-black/70 text-white p-2 rounded-md hover:bg-black/90 transition-colors"
                aria-label="Exit fullscreen"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
                  <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
                  <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
                  <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
                </svg>
              </button>
            </div>
          )}
        </div>
      )}
      
      <div className={`container mx-auto px-2 flex items-center justify-center min-h-screen py-10 ${isFullScreen ? 'hidden' : ''}`}>
        <Card className="w-full max-w-4xl">
          <CardHeader>
            <CardTitle>Watching AI-Stylized Stream</CardTitle>
            <CardDescription>
              Stream ID: {streamId}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div 
              ref={!isFullScreen ? fullscreenContainerRef : null}
              className="relative rounded-md overflow-hidden bg-black flex items-center justify-center"
              style={{ 
                paddingTop: aspectRatio, // Dynamic aspect ratio
                position: "relative"
              }}
            >
              {connected ? (
                imageData || nextImageData ? (
                  <div className="absolute inset-0 w-full h-full">
                    {nextImageData && (
                      <Image 
                        src={nextImageData}
                        alt="Live stream"
                        fill
                        style={{ 
                          objectFit: 'contain',
                          opacity: imageLoaded ? 1 : 0,
                          transition: 'opacity 0.3s ease-in-out'
                        }}
                        priority
                        unoptimized
                        width={0}
                        height={0}
                        onLoadingComplete={() => {
                          // Use onLoadingComplete which is more reliable in Next.js
                          setImageLoaded(true);
                          setImageData(nextImageData);
                          
                          // Update status if this is the first frame
                          if (framesReceivedRef.current <= 3 && status === "Connected, joining stream...") {
                            setStatus("Receiving AI-processed stream");
                          }
                        }}
                        onError={(e) => {
                          console.error("Error loading image in Next.js component:", e);
                          // Mark as loaded anyway to prevent UI from getting stuck
                          setImageLoaded(true);
                          setImageData(nextImageData);
                          
                          // Ensure status is updated even if there was an error
                          if (status === "Connected, joining stream...") {
                            setStatus("Receiving AI-processed stream");
                          }
                        }}
                      />
                    )}
                    {imageData && nextImageData !== imageData && (
                      <Image 
                        src={imageData}
                        alt="Previous frame"
                        fill
                        style={{ 
                          objectFit: 'contain',
                          opacity: nextImageData && imageLoaded ? 0 : 1,
                          transition: 'opacity 0.3s ease-in-out'
                        }}
                        priority
                        unoptimized
                        width={0}
                        height={0}
                      />
                    )}
                    <div className="absolute bottom-2 left-2 bg-black/70 text-white px-3 py-1 rounded-md text-sm">
                      {processingStatus || "AI-processed stream"}
                    </div>
                    
                    {/* Fullscreen toggle button */}
                    <button
                      onClick={toggleFullScreen}
                      className="absolute top-2 right-2 bg-black/70 text-white p-2 rounded-md hover:bg-black/90 transition-colors"
                      aria-label="Enter fullscreen"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                      </svg>
                    </button>
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
            
            {connected && stylePrompt && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm font-medium">Current Style:</p>
                <p className="text-sm">{stylePrompt}</p>
              </div>
            )}
            
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-medium">Status: {status}</p>
                <p className="text-sm font-medium text-green-600">{wsConnected ? "Connected" : "Disconnected"}</p>
              </div>
              
              {processingStatus && (
                <p className="text-sm font-semibold text-blue-600 mt-1">{processingStatus}</p>
              )}
              
              <p className="text-xs text-gray-500 mt-1">Frames are processed with AI diffusion at maximum possible speed</p>
              
              {connected && (
                <>
                  <p className="text-sm mt-2">Frames received: {framesReceived}</p>
                  {lastFrameTimestamp !== null && (
                    <>
                      <p className="text-sm">
                        End-to-end latency: {lastFrameTimestamp}ms 
                        {lastFrameTimestamp > 1000 ? ` (${(lastFrameTimestamp / 1000).toFixed(1)}s)` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Latency includes: AI processing time + network transfer time from server to your device
                      </p>
                    </>
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
    </>
  );
} 