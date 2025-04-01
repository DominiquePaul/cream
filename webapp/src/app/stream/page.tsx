"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect, useRef, useState, useCallback } from "react";
import AdminDebug from '@/components/AdminDebug';
import { useAuth } from '@/context/AuthContext';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import { Clock, Coins, Sparkles } from "lucide-react";
import { formatNumber } from '@/utils/formatters';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

// Define UserProfile type based on AuthContext
interface UserProfile {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  is_admin: boolean;
  credits: number;
}

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
  isDisabled,
  streamId,
  user
}: { 
  duration: number, 
  isActive: boolean,
  onStart: () => void,
  onStop: () => void,
  isDisabled: boolean,
  streamId: string | null,
  user?: UserProfile | null
}) => {
  // Calculate hours, minutes, seconds correctly
  // duration is in minutes, so multiply by 60 to get seconds first
  const totalSeconds = Math.floor(duration * 60);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  // Add console logging for debugging
  console.log(`StreamDurationDisplay Debug: duration=${duration}, totalSeconds=${totalSeconds}, hours=${hours}, minutes=${minutes}, seconds=${seconds}`);
  
  return (
    <Card className="shadow-md border-0 overflow-hidden py-0">
      <CardHeader className="pb-3 pt-2 bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
        <CardTitle className="text-base flex items-center text-purple-800">
          <span className="mr-2">🎬</span>
          Stream Controls
        </CardTitle>
        <CardDescription className="text-xs text-purple-600">
          {isActive ? 'Monitor and control your live stream' : 'Start your stream when ready'}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        <div className="space-y-4">
          {/* Stream state and duration display */}
          {isActive && (
            <div className="bg-purple-50 rounded-md p-3 border border-purple-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center">
                  <div className="h-2.5 w-2.5 bg-green-500 rounded-full animate-pulse mr-2"></div>
                  <span className="text-xs font-medium text-purple-800">LIVE</span>
                </div>
                <span className="text-xs text-purple-600">Started {Math.floor(duration)} mins ago</span>
              </div>
              
              <div className="flex items-center justify-center py-2">
                <div className="text-2xl font-bold text-purple-800 tabular-nums">
                  {hours > 0 ? `${hours}:` : ''}
                  {minutes.toString().padStart(2, '0')}:
                  {seconds.toString().padStart(2, '0')}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs text-purple-700 mt-1">
                <span>Duration</span>
                <span>Credits used: {(duration * 0.2).toFixed(2)}</span>
              </div>
            </div>
          )}
          
          {/* Stream URL display */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-700 block">
              {isActive ? 'Active Stream URL:' : 'Your Stream URL:'}
            </label>
            <div className="flex items-center">
              <input
                type="text"
                readOnly
                value={isActive && streamId 
                  ? `${window.location.origin}/watch/${streamId}`
                  : user?.username 
                    ? `${window.location.origin}/watch/${user.username.replace(/[^a-zA-Z0-9_-]/g, '_')}` 
                    : "URL will be available when you start streaming"}
                className="flex-grow px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-l-md"
                onClick={(e) => (isActive || user?.username) && e.currentTarget.select()}
              />
              <button
                className="px-2 py-2 bg-indigo-100 hover:bg-indigo-200 rounded-r-md text-indigo-700 border border-l-0 border-slate-200"
                title="Copy to clipboard"
                onClick={() => {
                  const url = isActive && streamId 
                    ? `${window.location.origin}/watch/${streamId}`
                    : user?.username 
                      ? `${window.location.origin}/watch/${user.username.replace(/[^a-zA-Z0-9_-]/g, '_')}` 
                      : "";
                  
                  if (url) {
                    navigator.clipboard.writeText(url);
                    alert("Stream URL copied to clipboard!");
                  }
                }}
                disabled={!isActive && !user?.username}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
            </div>
            {!isActive && (
              <p className="text-xs text-slate-500">This URL will be active once you start streaming</p>
            )}
          </div>
          
          {/* Stream action button */}
          <div className="pt-2">
            {!isActive ? (
              <Button 
                onClick={onStart}
                disabled={isDisabled}
                className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Start Streaming
              </Button>
            ) : (
              <Button 
                onClick={onStop} 
                variant="destructive"
                className="w-full"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
                </svg>
                Stop Streaming
              </Button>
            )}
          </div>
          
          {/* Information about streaming */}
          {!isActive && (
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 mr-1.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Streaming costs 0.2 credits per minute</span>
              </div>
              <div className="flex items-start">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500 mr-1.5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Initial startup takes ~45 seconds</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

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
  // Predefined style examples with categories
  const styleExamples = [
    { category: "Art Styles", examples: [
      "A Monet-style impressionist painting",
      "A Van Gogh post-impressionist style",
      "A Picasso cubist portrait",
      "A Dali surrealist dreamscape"
    ]},
    { category: "Themes", examples: [
      "A dystopian yet colorful future",
      "A peaceful forest scene with magical elements",
      "An underwater coral reef fantasy",
      "A space exploration scene with nebulas"
    ]},
    { category: "Visual Styles", examples: [
      "A Ghibli style anime scene",
      "A watercolor illustration",
      "A pixel art retro game style",
      "A neon cyberpunk aesthetic"
    ]}
  ];

  return (
    <Card className="shadow-md border-0 overflow-hidden py-0">
      <CardHeader className="pb-3 pt-2 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
        <CardTitle className="text-base flex items-center text-blue-800">
          <span className="mr-2">✨</span>
          Style Configuration
        </CardTitle>
        <CardDescription className="text-xs text-blue-600">
          Customize how your stream appears to viewers
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-4">
        {isStreaming ? (
          <div className="space-y-4">
            {/* Current style display */}
            <div className="p-3 bg-blue-50 rounded-md border border-blue-100">
              <div className="flex items-center mb-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <p className="text-xs font-medium text-blue-700">Active Style</p>
              </div>
              <p className="text-sm text-blue-800 font-medium">{currentStyle}</p>
            </div>
            
            {/* Style input and button */}
            <div className="space-y-2.5">
              <label htmlFor="stylePrompt" className="text-xs font-medium text-slate-700 block">
                Enter a new style:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  id="stylePrompt"
                  type="text"
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Describe the style you want..."
                  className="flex-grow px-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                  disabled={isUpdating}
                />
                <Button
                  onClick={onUpdateStyle}
                  disabled={isUpdating || !customPrompt}
                  className="bg-indigo-600 hover:bg-indigo-700"
                  size="sm"
                >
                  {isUpdating ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating
                    </span>
                  ) : (
                    'Apply'
                  )}
                </Button>
              </div>
            </div>
            
            {/* Style examples with tabs */}
            <div className="mt-3 border border-slate-200 rounded-md">
              <div className="p-2 border-b border-slate-200">
                <p className="text-xs font-medium text-slate-700">Style ideas (click to use):</p>
              </div>
              <div className="p-2 space-y-3 max-h-48 overflow-y-auto">
                {styleExamples.map((category, categoryIndex) => (
                  <div key={categoryIndex}>
                    <p className="text-xs font-medium text-indigo-600 mb-1.5">{category.category}</p>
                    <div className="space-y-1">
                      {category.examples.map((example, index) => (
                        <div 
                          key={index}
                          className="cursor-pointer text-xs text-slate-700 hover:text-indigo-700 hover:bg-indigo-50 p-1.5 rounded transition-colors flex items-center"
                          onClick={() => setCustomPrompt(example)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-slate-400 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          {example}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <div className="flex flex-col items-center space-y-3">
              <div className="bg-slate-100 h-16 w-16 rounded-full flex items-center justify-center text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">Style Settings</p>
                <p className="text-xs text-slate-500 mt-1">Start streaming to configure<br />how your stream will look</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Create a custom CreditsTimer to properly display remaining time from credits
const CreditsTimer = ({ credits }: { credits: number }) => {
  // Calculate remaining minutes (1 credit = 5 minutes)
  const minutesPerCredit = 5;
  const totalMinutes = credits * minutesPerCredit;
  
  // Calculate hours and minutes for display
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.floor(totalMinutes % 60);
  
  // Add console logging for debugging
  console.log(`CreditsTimer Debug: credits=${credits}, minutesPerCredit=${minutesPerCredit}, totalMinutes=${totalMinutes}, hours=${hours}, minutes=${minutes}`);
  
  return (
    <div className="flex items-center">
      <Clock className="h-4 w-4 text-gray-400 mr-1" />
      <span className="text-gray-600">
        {hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`}
      </span>
    </div>
  );
};

// Component to handle the credits purchase dialog
const CreditPurchaseButton = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('small');
  
  const handleBuyCredits = async () => {
    try {
      // Create checkout session via API
      const response = await fetch('/api/checkout/credits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          packageSize: selectedPackage,
          successUrl: `${window.location.origin}/profile?checkout=success`,
          cancelUrl: `${window.location.origin}/profile?checkout=canceled`,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }
      
      // Redirect to Stripe checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No checkout URL provided');
      }
    } catch (error) {
      console.error('Error starting checkout:', error);
      alert('Failed to start checkout process. Please try again.');
    }
  };
  
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="ml-2"
        >
          Buy Credits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Purchase Credits</DialogTitle>
          <DialogDescription>
            Choose a credit package to continue streaming
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <RadioGroup 
            defaultValue="small"
            value={selectedPackage}
            onValueChange={(value) => setSelectedPackage(value)}
            className="space-y-3"
          >
            {[
              { id: 'small', amount: 12, label: '12 credits', isPopular: true, price: '€12.00' },
              { id: 'medium', amount: 30, label: '30 credits', isPopular: false, price: '€30.00' },
              { id: 'large', amount: 60, label: '60 credits', isPopular: false, price: '€60.00' },
              { id: 'xlarge', amount: 120, label: '120 credits', isPopular: false, price: '€120.00' },
            ].map((pkg) => (
              <div key={pkg.id} className="flex items-center space-x-2 rounded-md border p-3 hover:bg-muted/50 transition-colors">
                <RadioGroupItem value={pkg.id} id={`credits-${pkg.id}`} />
                <Label htmlFor={`credits-${pkg.id}`} className="flex items-center justify-between flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <span>{pkg.label}</span>
                    {pkg.isPopular && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                        <Sparkles className="w-3 h-3 mr-1" />
                        Popular
                      </span>
                    )}
                  </div>
                  <span className="font-semibold">{pkg.price}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleBuyCredits}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            >
              Checkout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default function StreamPage() {
  const { user, isAdmin, refreshUser } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const wsReadyStateRef = useRef<number>(WebSocket.CLOSED);
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
  
  // Add authentication check
  useEffect(() => {
    if (!user) {
      setError("You must be logged in to stream");
      setStatus("Authentication required");
      return;
    }
  }, [user]);
  
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
  
  // Add this new state to track Modal container startup
  const [isModalStarting, setIsModalStarting] = useState(false);
  const [startupProgress, setStartupProgress] = useState(0);
  const startupTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const isRefreshingRef = useRef(false); // Add a ref to track refreshUser calls
  
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
    if (isStreaming && streamStartTime.current !== null && wsReadyStateRef.current === WebSocket.OPEN) {
      console.log("Starting duration timer with start time:", new Date(streamStartTime.current).toISOString());
      console.log(`Stream timer created at: ${Date.now()}, stream started at: ${streamStartTime.current}, diff: ${Date.now() - streamStartTime.current}ms`);
      
      // Ensure we clean up any existing interval first
      if (durationTimerRef.current) {
        console.log("Clearing existing duration timer before creating a new one");
        clearInterval(durationTimerRef.current);
        durationTimerRef.current = null;
      }
      
      let lastDeductedMinute = 0; // Track when we last deducted credits
      let lastDeductionTime = 0; // Track the timestamp of the last deduction
      
      // Create a unique ID for this timer instance to prevent stale timers from deducting
      const timerInstanceId = Date.now();
      console.log(`Created new timer instance ID: ${timerInstanceId}`);
      
      // Set up a timer to update duration every second
      durationTimerRef.current = setInterval(async () => {
        // Skip if we're not streaming anymore
        if (!isStreaming || !streamStartTime.current) {
          console.log(`Timer ${timerInstanceId} - Stream no longer active, skipping updates`);
          return;
        }
        
        const now = Date.now();
        const durationMs = now - streamStartTime.current!;
        
        // Calculate duration in minutes (keep decimals for more accurate display)
        const durationMinutes = durationMs / (1000 * 60);
        
        // Log for debugging
        console.log(`Timer ${timerInstanceId} - Updating duration: durationMs=${durationMs}ms, durationMinutes=${durationMinutes}min`);
        
        // Update state with the more precise value
        setStreamingDuration(durationMinutes);
        
        // Real-time credit deductions - every whole minute
        const currentWholeMinute = Math.floor(durationMinutes);
        const minimumDeductionInterval = 55 * 1000; // 55 seconds minimum between deductions
        
        // Only deduct if we've advanced to a new minute AND enough time has passed since last deduction
        // Also check we're not in the middle of a refresh
        if (currentWholeMinute > lastDeductedMinute && 
            sessionId.current && 
            (now - lastDeductionTime > minimumDeductionInterval) &&
            !isRefreshingRef.current) {
          // Calculate credits to deduct for this minute
          const creditsToDeduct = 0.2; // 0.2 credits per minute
          lastDeductedMinute = currentWholeMinute;
          lastDeductionTime = now;
          
          console.log(`-----------------------------------`);
          console.log(`Timer ${timerInstanceId} - DEDUCTING CREDITS - MINUTE ${currentWholeMinute}`);
          console.log(`Timer ${timerInstanceId} - Processing credit deduction: ${creditsToDeduct} credits`);
          console.log(`Timer ${timerInstanceId} - Timing check: durationMs=${durationMs}, durationMinutes=${durationMinutes.toFixed(4)}`);
          console.log(`Timer ${timerInstanceId} - Last deducted minute: ${lastDeductedMinute}, time since last deduction: ${(now - lastDeductionTime)/1000}s`);
          
          try {
            // First, get current credits to calculate new value
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('credits')
              .eq('id', user?.id)
              .single();
            
            if (profileError) {
              console.error(`Timer ${timerInstanceId} - Error getting current credits:`, profileError);
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
              console.error(`Timer ${timerInstanceId} - Error updating credits:`, updateError);
            } else {
              console.log(`Timer ${timerInstanceId} - Successfully updated credits from ${currentCredits} to ${newCredits}`);
              
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
                console.error(`Timer ${timerInstanceId} - Error recording credit transaction:`, transactionError);
              }
              
              // Refresh the user to update the displayed credit balance
              isRefreshingRef.current = true;
              await refreshUser();
              console.log(`Timer ${timerInstanceId} - Called refreshUser() - Current user state:`, user);
              console.log(`Timer ${timerInstanceId} - Successfully deducted ${creditsToDeduct} credits for minute ${currentWholeMinute}`);
              isRefreshingRef.current = false;
            }
          } catch (err) {
            console.error(`Timer ${timerInstanceId} - Error processing minute credit deduction:`, err);
            isRefreshingRef.current = false;
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
  }, [isStreaming, user?.id, refreshUser, user]); // Added user to dependencies

  // Define a function to establish the WebSocket connection
  const establishWebSocketConnection = useCallback(async () => {
    // Add authentication check
    if (!user?.id) {
      setError("Authentication required to start streaming");
      return;
    }

    // Create a stream session in the database
    const startStreamSession = async () => {
      try {
        // We no longer set streamStartTime here to prevent double-setting
        // streamStartTime is already set in the ws.onopen handler
        // This ensures credits are deducted at the correct rate (once per minute)
        
        // Create a new stream session with validated user ID
        const { data, error } = await supabase
          .from('stream_sessions')
          .insert({
            profile_id: user.id, // Now we know this is valid
            start_time: new Date(streamStartTime.current!).toISOString(),
            status: 'active'
          })
          .select()
          .single();
        
        if (error) {
          console.error("Error creating stream session:", error);
          setError("Failed to create stream session");
          return;
        }
        
        // Save the session ID for later use
        sessionId.current = data.id;
        console.log("Created stream session with ID:", data.id);
      } catch (err) {
        console.error("Error creating stream session:", err);
        setError("Failed to create stream session");
      }
    };
    
    // Close any existing connection
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      wsRef.current.close();
    }
    
    // Generate stream ID using username
    let newStreamId;
    if (user?.username) {
      // Use username as the stream ID, but make sure it's URL-safe
      // Remove any special characters and spaces
      newStreamId = user.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    } else {
      // Fallback to random ID if username is somehow not available
      newStreamId = "stream_" + Math.random().toString(36).substring(2, 15);
    }
    
    console.log(`Generated stream ID from username: ${newStreamId}`);
    
    // Use the environment variable for WebSocket URL
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
    
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
        
        // Update WebSocket readyState ref
        wsReadyStateRef.current = WebSocket.OPEN;
        
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
        const streamStartTimeFormatted = new Date(streamStartTime.current).toISOString();
        console.log(`Setting stream start time after WebSocket connected: ${streamStartTimeFormatted} - milliseconds: ${streamStartTime.current}`);
        
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
        // Update WebSocket readyState ref
        wsReadyStateRef.current = ws.readyState;
        
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
        
        // Update WebSocket readyState ref
        wsReadyStateRef.current = WebSocket.CLOSED;
        
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
  }, [user?.id, user?.username, sendFrames, setupMessageHandler, isModalStarting, isStreaming]);

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
      // Add authentication check
      if (!user) {
        setError("You must be logged in to stream");
        return;
      }

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
      
      // Request media access first before checking videoRef
      console.log("🎥 Requesting access to camera");
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        console.log("✅ Camera access granted");
      } catch (mediaError) {
        console.error("Failed to access camera:", mediaError);
        throw new Error("Camera access denied: " + 
          (mediaError instanceof Error ? mediaError.message : String(mediaError)));
      }
      
      // Now that we have the media stream, ensure the video element exists
      // Allow multiple render cycles to complete before checking
      for (let attempt = 0; attempt < 3; attempt++) {
        if (videoRef.current) {
          break;
        }
        console.log(`Video element not available, waiting (attempt ${attempt + 1}/3)...`);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Final check for video element
      if (!videoRef.current) {
        // Stream needs to be stopped if we're stopping here
        mediaStream.getTracks().forEach(track => track.stop());
        throw new Error("Video element could not be found. Please refresh the page and try again.");
      }
      
      // Now we can safely set the video source
      videoRef.current.srcObject = mediaStream;
      
      // Set up event handlers
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
      
      // Add oncanplay to establish WebSocket after video is playable
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
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4 text-white">
            <h2 className="text-xl font-bold">Starting Dream Engine</h2>
            <p className="text-sm text-indigo-100">This typically takes 30-45 seconds on first connection</p>
          </div>
          
          <div className="p-6 space-y-6">
            {/* Progress visualization */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">Startup Progress</span>
                <span className="text-indigo-600 font-medium">{Math.min(Math.round(startupProgress), 100)}%</span>
              </div>
              <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${startupProgress}%` }}
                />
              </div>
            </div>
            
            {/* Status indicators */}
            <div className="space-y-3">
              <div className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center mt-0.5">
                  <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-800">Camera Ready</p>
                  <p className="text-xs text-slate-500">Your webcam is activated and ready</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center mt-0.5">
                  {startupProgress < 95 ? (
                    <svg className="animate-spin h-4 w-4 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-800">AI Processor</p>
                  <p className="text-xs text-slate-500">{startupProgress < 95 ? 'Initializing the dream engine...' : 'Dream engine is ready'}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="flex-shrink-0 h-5 w-5 flex items-center justify-center mt-0.5">
                  <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-slate-800">Billing Notice</p>
                  <p className="text-xs text-slate-500">You won&apos;t be charged during this startup period</p>
                </div>
              </div>
            </div>
            
            {/* Status message */}
            <div className="bg-slate-50 p-3 rounded-md border border-slate-200">
              <p className="text-xs text-slate-600 font-medium">Current Status</p>
              <p className="text-sm text-slate-800">{status}</p>
            </div>
            
            {/* Action button */}
            <button 
              onClick={cancelStartup}
              className="w-full mt-2 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-md transition-colors font-medium"
            >
              Cancel Startup
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Fixed overlay that's always visible during startup */}
      <StartupOverlay />
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-indigo-900">Your Stream</h1>
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center px-3 py-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <div className="relative group">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center">
                      <Coins className="h-4 w-4 text-yellow-500 mr-1" />
                      <span className={user.credits < 3 ? "text-red-600 font-bold" : "text-green-600 font-bold"}>
                        {formatNumber(user?.credits || 0)}
                      </span>
                    </div>
                    <CreditsTimer credits={user.credits || 0} />
                    <CreditPurchaseButton />
                  </div>
                  <div className="absolute left-0 top-full mt-2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                    <div className="absolute -top-1 left-4 w-2 h-2 bg-slate-800 transform rotate-45"></div>
                    <p>Time shown is how long you can continue streaming with your current credit balance.</p>
                  </div>
                </div>
                {user.credits && user.credits < 3 && (
                  <div className="ml-2 flex items-center text-amber-600 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span>Low credits</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main content area - video stream */}
          <div className="lg:col-span-8 space-y-6">
            <Card className="shadow-lg border-0 overflow-hidden py-0">
              {/* Video preview section */}
              <div className="relative w-full" style={{ paddingBottom: aspectRatio }}>
                {/* Video elements - Not streaming placeholder */}
                {!isStreaming && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-indigo-100 to-purple-100 rounded-md">
                    <div className="text-center p-8 max-w-md">
                      <div className="mb-4 text-indigo-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-indigo-800 mb-2">Ready to Stream</h3>
                      <p className="text-indigo-600 mb-4">Click the &quot;Start Streaming&quot; button to begin sharing your stylized video.</p>
                    </div>
                  </div>
                )}

                {/* Video element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`absolute inset-0 w-full h-full object-cover bg-black rounded-md ${
                    isStreaming && !showProcessedView ? 'block' : 'hidden'
                  }`}
                />
                
                {/* Processed image view */}
                {isStreaming && showProcessedView && (
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
                        <p>Fetching the latest frame...</p>
                      </div>
                    )}
                  </div>
                )}
                
                {/* View toggle button */}
                {isStreaming && (
                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={toggleView}
                      className="px-3 py-2 bg-black/70 hover:bg-black/80 text-white text-sm rounded-md transition-colors"
                    >
                      {showProcessedView ? "Show Camera" : "Show Stylized View"}
                    </button>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Stream controls panel */}
              {/* {isStreaming && (
                <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border-t border-indigo-100">
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    <span className="text-sm font-medium text-green-700">Live</span>
                  </div>
                </div>
              )} */}
            </Card>
            
            {/* Error display */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 shadow">
                <div className="flex items-start">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 mt-0.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{error}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Stream Controls */}
            <StreamDurationDisplay
              duration={streamingDuration}
              isActive={isStreaming}
              onStart={startStream}
              onStop={stopStream}
              isDisabled={isUpdating || isModalStarting}
              streamId={currentStreamIdRef.current}
              user={user}
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
          </div>
        </div>
      </div>
      
      {/* Admin debug section if needed */}
      {isAdmin && <AdminDebug />}
    </div>
  );
} 