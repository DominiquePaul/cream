"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState, useCallback } from "react";
import AdminDebug from '@/components/AdminDebug';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import CreditsDisplay from '@/components/credits/CreditsDisplay';
import { supabase } from '@/lib/supabase';
import { Hourglass } from 'lucide-react';

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

// Create a new StreamDurationDisplay component
const StreamDurationDisplay = ({ 
  duration, 
  isActive,
  onStart,
  onStop,
  isDisabled
}: { 
  duration: number, 
  isActive: boolean,
  onStart: () => void,
  onStop: () => void,
  isDisabled: boolean
}) => {
  // Calculate hours, minutes, seconds
  const hours = Math.floor(duration / 60);
  const minutes = Math.floor(duration % 60);
  const seconds = Math.floor((duration * 60) % 60);
  
  return (
    <Card className="mb-4 shadow-md bg-gradient-to-r from-purple-50 to-indigo-50">
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Hourglass className="h-5 w-5 text-indigo-500 mr-2" />
            <span className="font-medium text-indigo-700">Stream Duration</span>
          </div>
          {isActive && (
            <div className="text-lg font-bold">
              {hours > 0 ? `${hours}h ` : ''}
              {minutes}m {seconds}s
            </div>
          )}
        </div>
        
        {/* Stream control buttons */}
        <div className="pt-2">
          {!isActive ? (
            <Button 
              onClick={onStart}
              disabled={isDisabled}
              className="w-full"
            >
              Start Streaming
            </Button>
          ) : (
            <Button 
              onClick={onStop} 
              variant="destructive"
              className="w-full"
            >
              Stop Streaming
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// After StreamDurationDisplay component definition
// Create a StyleConfigCard component for the right sidebar
const StyleConfigCard = ({
  currentStyle,
  customPrompt,
  setCustomPrompt,
  onUpdateStyle,
  isStreaming,
  isUpdating
}: {
  currentStyle: string;
  customPrompt: string;
  setCustomPrompt: (value: string) => void;
  onUpdateStyle: () => void;
  isStreaming: boolean;
  isUpdating: boolean;
}) => {
  // Predefined style examples
  const styleExamples = [
    "A Monet-style impressionist painting",
    "A dystopian yet colourful future",
    "A Ghibli style anime",
    "A watercolor illustration",
    "A portrait of Donald Trump"
  ];

  return (
    <Card className="mt-4 mb-4 shadow-md bg-gradient-to-r from-blue-50 to-indigo-50">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center">
          <span className="mr-2">✨</span>
          Style Configuration
        </CardTitle>
        <CardDescription>
          Customize how your stream looks
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isStreaming ? (
          <>
            <div className="p-3 bg-white/50 border border-blue-100 rounded-md mb-3">
              <p className="text-sm font-medium text-blue-800">Current Style:</p>
              <p className="text-sm text-blue-700 mt-1">{currentStyle}</p>
            </div>
            
            <div className="space-y-3">
              <input
                type="text"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Enter a new style prompt..."
                className="w-full px-3 py-2 border border-indigo-100 rounded-md bg-white/80 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                disabled={!isStreaming || isUpdating}
              />
              
              <Button
                onClick={onUpdateStyle}
                disabled={!isStreaming || isUpdating || !customPrompt}
                className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600"
                variant="default"
              >
                {isUpdating ? 'Updating...' : 'Update Style'}
              </Button>
              
              <div className="mt-2 p-3 bg-white/50 border border-blue-100 rounded-md">
                <p className="text-xs font-medium text-blue-800 mb-1">Style examples:</p>
                <div className="space-y-1.5 max-h-24 overflow-y-auto pr-1">
                  {styleExamples.map((example, index) => (
                    <div 
                      key={index}
                      className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 p-1 rounded transition-colors"
                      onClick={() => setCustomPrompt(example)}
                    >
                      {example}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center text-sm text-gray-500 p-3">
            Start streaming to configure style options
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default function StreamPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("Initializing camera...");
  const frameCounterRef = useRef(0);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const isStreamingRef = useRef(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
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
  
  // Credit tracking state
  const streamStartTime = useRef<number | null>(null);
  const sessionId = useRef<string | null>(null);
  const [streamingDuration, setStreamingDuration] = useState(0);
  const durationTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { user, isAdmin, refreshUser } = useAuth();

  // Add this new state to track Modal container startup
  const [isModalStarting, setIsModalStarting] = useState(false);
  const [startupProgress, setStartupProgress] = useState(0);
  const startupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add a log when isModalStarting changes to debug visibility issues
  useEffect(() => {
    console.log(`Modal startup state changed: isModalStarting=${isModalStarting}, progress=${startupProgress}%`);
  }, [isModalStarting, startupProgress]);

  // Also log when the startStream function is called
  useEffect(() => {
    console.log(`Streaming state changed: isStreaming=${isStreaming}, isUpdating=${isUpdating}`);
  }, [isStreaming, isUpdating]);

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
  }, [showProcessedView, setUpdatingPrompt, setStylePrompt]);

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

  // Modify the useEffect that tracks streaming duration
  useEffect(() => {
    // Only start duration tracking when both conditions are met AND WebSocket is connected
    if (isStreaming && streamStartTime.current !== null && wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("Starting duration timer with start time:", new Date(streamStartTime.current).toISOString());
      
      let lastDeductedMinute = 0; // Track when we last deducted credits
      
      // Set up a timer to update duration every second
      durationTimerRef.current = setInterval(async () => {
        const now = Date.now();
        const durationMs = now - streamStartTime.current!;
        
        // Calculate duration in minutes (keep decimals for more accurate display)
        const durationMinutes = durationMs / (1000 * 60);
        
        // Update state with the more precise value
        setStreamingDuration(durationMinutes);
        
        // Real-time credit deductions - every whole minute
        const currentWholeMinute = Math.floor(durationMinutes);
        if (currentWholeMinute > lastDeductedMinute && sessionId.current) {
          // Calculate credits to deduct for this minute
          const creditsToDeduct = 0.2; // 0.2 credits per minute
          lastDeductedMinute = currentWholeMinute;
          
          console.log(`Processing credit deduction for minute ${currentWholeMinute}: ${creditsToDeduct} credits`);
          
          try {
            // First, get current credits to calculate new value
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('credits')
              .eq('id', user?.id)
              .single();
            
            if (profileError) {
              console.error("Error getting current credits:", profileError);
              return;
            }
            
            const currentCredits = profileData?.credits || 0;
            const newCredits = Math.max(0, currentCredits - creditsToDeduct);
            
            // Update the user's credits directly
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ 
                credits: newCredits,
                updated_at: new Date().toISOString()
              })
              .eq('id', user?.id);
            
            if (updateError) {
              console.error("Error updating credits:", updateError);
            } else {
              console.log(`Successfully updated credits from ${currentCredits} to ${newCredits}`);
              
              // Record the credit usage transaction
              const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                  profile_id: user?.id,
                  amount: -creditsToDeduct, // Negative amount for consumption
                  type: 'usage',
                  description: `Streaming minute ${currentWholeMinute}`
                });
              
              if (transactionError) {
                console.error("Error recording credit transaction:", transactionError);
              }
              
              // Refresh the user to update the displayed credit balance
              await refreshUser();
              console.log("Called refreshUser() - Current user state:", user);
              console.log(`Successfully deducted ${creditsToDeduct} credits for minute ${currentWholeMinute}`);
            }
          } catch (err) {
            console.error("Error processing minute credit deduction:", err);
          }
        }
      }, 1000);
    } else {
      // Clear the timer when not streaming
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    }
    
    return () => {
      if (durationTimerRef.current) {
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
    };
  }, [isStreaming, user?.id, refreshUser, user, wsRef.current?.readyState]);

  // Define a function to establish the WebSocket connection
  const establishWebSocketConnection = useCallback(async () => {
    // Create a stream session in the database
    const startStreamSession = async () => {
      try {
        // Set streamStartTime first before database operations
        streamStartTime.current = Date.now();
        console.log("Setting stream start time:", new Date(streamStartTime.current).toISOString());
        
        // Create a new stream session
        const { data, error } = await supabase
          .from('stream_sessions')
          .insert({
            profile_id: user?.id,
            start_time: new Date(streamStartTime.current).toISOString(), // Use the same timestamp
            status: 'active'
          })
          .select()
          .single();
        
        if (error) {
          console.error("Error creating stream session:", error);
          return;
        }
        
        // Save the session ID for later use
        sessionId.current = data.id;
        console.log("Created stream session with ID:", data.id);
      } catch (err) {
        console.error("Error creating stream session:", err);
      }
    };
    
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
      
      // Add more context to the status messages
      setStatus(isModalStarting 
        ? "Initializing dream engine (this may take up to 45 seconds)..." 
        : "Connecting to stream...");
      
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
        clearInterval(stateInterval);
        
        // Send a ping to test bi-directional communication
        try {
          ws.send(JSON.stringify({ type: 'ping' }));
          console.log("Sent ping to test connection");
          
          // Test endpoint call - request server info to check communication
          ws.send(JSON.stringify({ type: 'get_server_info' }));
          console.log("Sent server info request to test bi-directional communication");
        } catch (err) {
          console.error("Error sending ping:", err);
        }
        
        // NOW set the stream start time - this is when billing should begin
        // Only at this point do we know the container is ready
        streamStartTime.current = Date.now();
        console.log("Setting stream start time after WebSocket connected:", new Date(streamStartTime.current).toISOString());
        
        // Stream is created automatically by connecting to the broadcaster path
        setIsStreaming(true);
        isStreamingRef.current = true;
        currentStreamIdRef.current = newStreamId;
        setStatus(`Streaming with ID: ${newStreamId}`);
        
        // Start the stream session in the database
        startStreamSession();
        
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
        
        setIsModalStarting(false);
        if (startupTimerRef.current) {
          clearInterval(startupTimerRef.current);
          startupTimerRef.current = null;
        }
        setStartupProgress(100);
      };
      
      // Improve error handling for connection issues
      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        // Don't immediately show errors during startup
        if (!isModalStarting) {
          setError("Connection error. Please try again.");
        }
        
        // If we're still in startup phase, keep connection attempts going
        if (isModalStarting && ws.readyState === WebSocket.CLOSED) {
          console.log("Connection failed during startup. Retrying...");
          // Wait a bit and retry
          setTimeout(() => {
            if (isStreaming && isModalStarting) {
              establishWebSocketConnection();
            }
          }, 3000);
        }
      };
      
      ws.onclose = (event) => {
        console.log(`WebSocket connection closed with code ${event.code} and reason: ${event.reason || 'No reason provided'}`);
        setStatus(`Disconnected (code: ${event.code})`);
        clearInterval(stateInterval);
        
        // Only stop streaming if we were actively streaming
        if (isStreamingRef.current) {
          setIsStreaming(false);
        }
      };
      
      return ws;
    } catch (err: unknown) {
      console.error("Error establishing WebSocket connection:", err);
      setError("Failed to connect: " + (err instanceof Error ? err.message : String(err)));
      setStatus("Connection error");
      return null;
    }
  }, [user?.id, sendFrames, setupMessageHandler, isModalStarting]);

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
    try {
      console.log("🔄 startStream called - initializing stream setup");
      
      // Clear any previous errors
      setError("");
      
      // Update status and state
      setStatus("Preparing camera and starting stream...");
      console.log("👉 Setting streaming states: isStreaming=false, isUpdating=true");
      setIsStreaming(false);
      setIsUpdating(true);
      
      // Set modal starting explicitly with a timeout to ensure it renders
      console.log("👉 Setting isModalStarting=true");
      setIsModalStarting(true);
      setStartupProgress(0);
      
      // Use a redundant timeout to ensure state updates are applied
      setTimeout(() => {
        if (!isModalStarting) {
          console.log("⚠️ isModalStarting was still false after initial set, forcing update");
          setIsModalStarting(true);
        }
      }, 100);
      
      // Important: DON'T set streamStartTime here yet - wait until WebSocket is connected
      // This ensures we don't bill users during cold start period
      
      // Start a timer to update progress estimation
      if (startupTimerRef.current) {
        console.log("Clearing existing startup timer");
        clearInterval(startupTimerRef.current);
        startupTimerRef.current = null;
      }
      
      console.log("📊 Starting progress estimation timer");
      startupTimerRef.current = setInterval(() => {
        setStartupProgress(prev => {
          const nextProgress = prev + (95 - prev) * 0.1;
          const cappedProgress = Math.min(nextProgress, 95);
          console.log(`Progress update: ${prev.toFixed(1)}% → ${cappedProgress.toFixed(1)}%`);
          return cappedProgress;
        });
      }, 1000);
      
      console.log("🎥 Requesting access to camera");
      if (!videoRef.current) {
        throw new Error("Video element not found");
      }
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      console.log("✅ Camera access granted");
      
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
      console.error("❌ Error starting stream:", err);
      setError("Failed to access camera: " + (err instanceof Error ? err.message : String(err)));
      setStatus("Error: Camera access failed");
      setIsStreaming(false); // Reset streaming state on error
      streamStartTime.current = null; // Reset stream time on error
      
      // Ensure modal state is reset
      console.log("👉 Resetting isModalStarting=false due to error");
      setIsModalStarting(false);
    } finally {
      setIsUpdating(false);
      // Note: we don't reset isModalStarting here as it should stay true until WebSocket connects
      console.log("⏱️ Startup process initialized, waiting for WebSocket connection");
    }
  };

  const stopStream = async () => {
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
    
    // Clear duration timer
    if (durationTimerRef.current) {
      clearInterval(durationTimerRef.current);
      durationTimerRef.current = null;
    }
    
    // Update stream session and deduct credits for any remaining partial minute
    try {
      // Only update if we have a session and actually streamed
      if (sessionId.current && streamStartTime.current) {
        // Calculate actual duration in minutes
        const now = Date.now();
        const durationMs = now - streamStartTime.current;
        const durationMinutes = durationMs / (1000 * 60);
        
        // Calculate total credits used for database record
        const totalCreditsUsed = durationMinutes * 0.2;
        
        // We've already deducted for whole minutes, so calculate partial minute credits
        const wholeMinutes = Math.floor(durationMinutes);
        const partialMinute = durationMinutes - wholeMinutes;
        const partialCredits = partialMinute > 0 ? partialMinute * 0.2 : 0;
        
        console.log(`Stream ended - Duration: ${durationMinutes.toFixed(2)} minutes, Partial credits to deduct: ${partialCredits.toFixed(2)}`);
        
        // Update stream session to mark as ended
        const { error: sessionError } = await supabase
          .from('stream_sessions')
          .update({
            end_time: new Date().toISOString(),
            duration_minutes: Math.ceil(durationMinutes), // Round up for billing
            cost_credits: totalCreditsUsed,
            status: 'completed'
          })
          .eq('id', sessionId.current);
        
        if (sessionError) {
          console.error("Error updating stream session:", sessionError);
        }
        
        // Only deduct for partial minute if it exists
        if (partialCredits > 0) {
          // Get current credits to calculate new value
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('credits')
            .eq('id', user?.id)
            .single();
          
          if (profileError) {
            console.error("Error getting current credits:", profileError);
          } else {
            const currentCredits = profileData?.credits || 0;
            const newCredits = Math.max(0, currentCredits - partialCredits);
            
            // Update the user's credits directly
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ 
                credits: newCredits,
                updated_at: new Date().toISOString()
              })
              .eq('id', user?.id);
            
            if (updateError) {
              console.error("Error updating credits for partial minute:", updateError);
            } else {
              // Record the credit usage transaction
              const { error: transactionError } = await supabase
                .from('credit_transactions')
                .insert({
                  profile_id: user?.id,
                  amount: -partialCredits, // Negative amount for consumption
                  type: 'usage',
                  description: `Partial minute (${(partialMinute * 60).toFixed(0)}s) of streaming`
                });
              
              if (transactionError) {
                console.error("Error recording transaction for partial minute:", transactionError);
              }
              
              // Refresh the user to update the displayed credit balance
              await refreshUser();
              console.log(`Updated credits from ${currentCredits} to ${newCredits} for partial minute`);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error ending stream session:", err);
    }
    
    // Stop video tracks
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    
    // Reset streaming state
    setIsStreaming(false);
    isStreamingRef.current = false;
    currentStreamIdRef.current = null;
    sessionId.current = null;
    streamStartTime.current = null;
    setStreamingDuration(0);
    setStatus("Stream stopped");
    
    // Close WebSocket connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
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

  // At the end of the component, right before the return statement
  // Add a fixed overlay component
  const StartupOverlay = () => {
    if (!isModalStarting) return null;
    
    // Add function to cancel the stream initialization
    const cancelStartup = () => {
      console.log("🛑 Cancelling stream startup process");
      
      // Clear any timers
      if (startupTimerRef.current) {
        clearInterval(startupTimerRef.current);
        startupTimerRef.current = null;
      }
      
      // Close WebSocket if it exists
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      
      // Reset all related states
      setIsModalStarting(false);
      setIsUpdating(false);
      setStatus("Stream initialization cancelled");
      setStartupProgress(0);
      setIsStreaming(false);
      streamStartTime.current = null;
    };
    
    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
        <div className="bg-white/90 backdrop-blur-sm rounded-lg p-6 max-w-md shadow-2xl border-4 border-purple-500">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mb-4"></div>
            <h2 className="text-xl font-bold text-purple-800 mb-3">Starting Dream Engine</h2>
            <p className="text-sm mb-4 text-center">
              Please wait while we start up the AI engine. This typically takes <strong>30-45 seconds</strong> and only happens on the first stream.
            </p>
            
            <div className="w-full bg-gray-200 h-3 rounded-full mb-3">
              <div 
                className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
                style={{ width: `${startupProgress}%` }}
              />
            </div>
            
            <div className="space-y-1 text-sm text-gray-700 w-full">
              <p className="flex items-center">
                <span className="mr-2 text-green-500">✓</span> Camera ready
              </p>
              <p className="flex items-center">
                <span className="mr-2 text-purple-500">⏳</span> Starting AI processor
              </p>
              <p className="flex items-center">
                <span className="mr-2 text-blue-500">ℹ</span> You won&apos;t be charged during startup
              </p>
            </div>
            
            <p className="mt-3 text-xs text-gray-500">Status: {status}</p>
            
            <button 
              onClick={cancelStartup}
              className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md transition-colors"
            >
              Cancel Startup
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container mx-auto px-4 py-4">
      {/* Fixed overlay that's always visible during startup */}
      <StartupOverlay />
      
      <h1 className="text-2xl font-bold mb-4">Stream Setup</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle>Live Stream</CardTitle>
              <CardDescription>Start your live stream here</CardDescription>
            </CardHeader>
            <CardContent>
              {/* In-page loading overlay during modal startup */}
              {isModalStarting && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-30 text-white text-center p-4">
                  <div className="bg-white/90 p-6 rounded-lg border-2 border-purple-500 max-w-md shadow-lg text-gray-800">
                    <div className="flex flex-col items-center">
                      <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mb-4"></div>
                      <h3 className="text-lg font-medium text-purple-800 mb-2">Starting Dream Engine</h3>
                      <p className="mb-3 text-sm">This typically takes 30-45 seconds on the first connection.</p>
                      <div className="w-full bg-gray-200 h-2 rounded-full mb-3">
                        <div 
                          className="bg-purple-500 h-full rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${startupProgress}%` }}
                        />
                      </div>
                      <div className="space-y-1 text-sm text-gray-700 w-full">
                        <p className="flex items-center">
                          <span className="mr-2 text-green-500">✓</span> Camera ready
                        </p>
                        <p className="flex items-center">
                          <span className="mr-2 text-purple-500">⏳</span> Starting AI processor
                        </p>
                        <p className="flex items-center">
                          <span className="mr-2 text-blue-500">ℹ</span> You won&apos;t be charged during startup
                        </p>
                      </div>
                      <p className="text-xs text-gray-500 mt-2">Status: {status}</p>
                      
                      <button 
                        onClick={() => {
                          console.log("🛑 Cancelling stream startup from in-page overlay");
                          
                          // Clear any timers
                          if (startupTimerRef.current) {
                            clearInterval(startupTimerRef.current);
                            startupTimerRef.current = null;
                          }
                          
                          // Close WebSocket if it exists
                          if (wsRef.current) {
                            wsRef.current.close();
                            wsRef.current = null;
                          }
                          
                          // Reset all related states
                          setIsModalStarting(false);
                          setIsUpdating(false);
                          setStatus("Stream initialization cancelled");
                          setStartupProgress(0);
                          setIsStreaming(false);
                          streamStartTime.current = null;
                        }}
                        className="mt-3 px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-md text-sm transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Video container with relative positioning */}
              <div className="relative w-full" style={{ paddingBottom: aspectRatio }}>
                {/* Original webcam view */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover bg-black rounded-md ${
                    showProcessedView ? 'hidden' : 'block'
                  }`}
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
                
                {/* Processing indicator overlay - adding from broadcast page */}
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
            </CardContent>

            <CardFooter className="flex justify-between">
              {/* Buttons moved to StreamDurationDisplay component */}
            </CardFooter>
          </Card>
        </div>
        
        {/* Right sidebar */}
        <div className="lg:col-span-1">
          {/* Stream Duration Display */}
          <StreamDurationDisplay
            duration={streamingDuration}
            isActive={isStreaming}
            onStart={startStream}
            onStop={stopStream}
            isDisabled={isUpdating || isModalStarting}
          />
          
          {/* Style Configuration Card */}
          <StyleConfigCard 
            currentStyle={stylePrompt}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            onUpdateStyle={updateStylePrompt}
            isStreaming={isStreaming}
            isUpdating={updatingPrompt}
          />
          
          {/* Credits card */}
          <CreditsDisplay showTimeRemaining={true} />
          
          {/* Status info */}
          <Card className="mt-6 shadow-md">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Stream Status</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{status}</p>
              {error && (
                <p className="text-sm text-red-600 mt-2">
                  Error: {error}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Modal startup progress */}
          {isModalStarting && (
            <Card className="mt-6 shadow-md border-2 border-purple-500 animate-pulse">
              <CardHeader className="pb-2 bg-purple-50">
                <CardTitle className="text-lg flex items-center text-purple-800">
                  <span className="mr-2">⏳</span> Starting Dream Engine
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    <strong>Please wait while we start up the AI engine.</strong> This typically takes 30-45 seconds and only happens on the first stream.
                  </p>
                  <div className="flex items-center space-x-3">
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-t-2 border-purple-500"></div>
                    <div className="h-2 flex-grow bg-slate-200 rounded">
                      <div 
                        className="h-full bg-purple-500 rounded transition-all duration-300 ease-out"
                        style={{ width: `${startupProgress}%` }}
                      />
                    </div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded border border-purple-200 text-xs text-slate-700 space-y-1">
                    <p>• The camera is ready, but we&apos;re starting the AI processor</p>
                    <p>• You will not be charged during this startup period</p>
                    <p>• Once connected, streaming will begin automatically</p>
                    <p className="pt-1 font-medium">Current status: {status}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Admin debug section if needed */}
      {isAdmin && <AdminDebug />}
    </div>
  );
} 