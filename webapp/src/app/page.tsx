"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { useState, useEffect } from "react";

export default function Home() {
  const [activeStreams, setActiveStreams] = useState<string[]>([]);
  
  // Fetch active streams when page loads
  useEffect(() => {
    const fetchActiveStreams = async () => {
      try {
        // Use the environment variable for WebSocket URL
        const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || '';
        
        // Create a temporary viewer ID for listing streams
        const tempId = "listing_" + Math.random().toString(36).substring(2, 15);
        const fullWsUrl = `${wsUrl}/viewer/${tempId}`;
        
        const ws = new WebSocket(fullWsUrl);
        
        ws.onopen = () => {
          ws.send(JSON.stringify({
            type: 'list_streams'
          }));
        };
        
        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'streams_list') {
              setActiveStreams(data.streams || []);
            }
          } catch (err) {
            console.error("Error parsing WebSocket message:", err);
          }
          
          // Close connection after receiving response
          ws.close();
        };
        
        ws.onerror = (error) => {
          console.error("WebSocket error:", error);
        };
        
      } catch (error) {
        console.error("Error fetching active streams:", error);
      }
    };
    
    fetchActiveStreams();
  }, []);

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        <div className="flex flex-col items-center text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">AI-Stylized Livestreaming</h1>
          <p className="text-xl text-gray-600 max-w-3xl">
            Transform your webcam feed into art using diffusion models. Perfect for parties, events, and or kids.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <Card className="h-full transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle>Start livedreaming</CardTitle>
              <CardDescription>
                Create your own AI-stylized livestream using your webcam
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-gradient-to-r from-blue-400 to-purple-500 rounded-md flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-16 w-16 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" 
                  />
                </svg>
              </div>
              <p className="mt-4 text-gray-600">
                Launch your own AI-processed stream and share it with friends, family, or anyone around the world.
                Each frame is transformed with a diffusion model.
              </p>
              <div className="mt-2 p-2 bg-blue-50 rounded-md">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> Processing takes ~1.5 seconds per frame for artistic quality
                </p>
              </div>
            </CardContent>
            <CardFooter>
              <Link href="/stream" className="w-full">
                <Button className="w-full">Start Streaming</Button>
              </Link>
            </CardFooter>
          </Card>

          <Card className="h-full transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle>Watch Streams</CardTitle>
              <CardDescription>
                View AI-transformed live streams created by others
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-48 bg-gradient-to-r from-pink-400 to-orange-500 rounded-md flex items-center justify-center">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-16 w-16 text-white" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" 
                  />
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
              </div>
              
              {activeStreams.length > 0 ? (
                <div className="mt-4">
                  <p className="font-medium mb-2">Active streams:</p>
                  <ul className="space-y-2">
                    {activeStreams.map((streamId) => (
                      <li key={streamId} className="border border-gray-200 rounded-md p-2">
                        <Link href={`/watch/${streamId}`} className="text-blue-600 hover:underline">
                          Stream {streamId}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="mt-4 text-gray-600">
                  Enter a stream ID to watch an existing stream, or check back later for active streams.
                </p>
              )}
            </CardContent>
            <CardFooter>
              <div className="w-full space-y-2">
                <p className="text-sm text-gray-500">Enter a stream ID to watch:</p>
                <form 
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const streamId = formData.get('streamId') as string;
                    if (streamId) {
                      window.location.href = `/watch/${streamId}`;
                    }
                  }}
                >
                  <input
                    type="text"
                    name="streamId"
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Stream ID"
                    required
                  />
                  <Button type="submit">Watch</Button>
                </form>
              </div>
            </CardFooter>
          </Card>
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Start a Stream</h3>
              <p className="text-gray-600">Click &quot;Start Streaming&quot; and grant camera access to begin your creative AI-processed broadcast</p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">2</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Share Your Stream</h3>
              <p className="text-gray-600">Copy your unique stream URL and share it with friends to let them see your AI-transformed video</p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-blue-600 font-bold">3</span>
              </div>
              <h3 className="font-bold text-lg mb-2">Watch Streams</h3>
              <p className="text-gray-600">Enter a stream ID or click on an active stream to watch others&apos; AI-stylized creative broadcasts</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
