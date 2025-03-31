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
import HeroSection from "@/components/HeroSection";
import TransformationExamples from "@/components/TransformationExamples";
import UseCasesSection from "@/components/UseCasesSection";

export default function Home() {
  const [activeStreams, setActiveStreams] = useState<string[]>([]);
  
  // Example transformation styles with placeholder images and prompts
  const styleExamples = [
    {
      title: "Surrealist Dreamscape",
      prompt: "A Dali surrealist dreamscape",
      imageSrc: "/placeholders/dali_style.jpeg",
    },
    {
      title: "Underwater Fantasy",
      prompt: "An underwater coral reef fantasy",
      imageSrc: "/placeholders/coral_reef.jpeg",
    },
    {
      title: "Anime Style",
      prompt: "A Ghibli style anime scene",
      imageSrc: "/placeholders/ghibli.jpeg",
    },
    {
      title: "Watercolor Art",
      prompt: "A watercolor illustration",
      imageSrc: "/placeholders/watercolour.jpeg",
    },
  ];
  
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
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <HeroSection />
      
      {/* Transformation Examples */}
      <section id="examples" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">See What&apos;s Possible</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              One webcam feed, endless creative possibilities with AI-powered real-time transformations
            </p>
          </div>
          
          <TransformationExamples 
            originalImageSrc="/placeholders/original_frame.png"
            styleExamples={styleExamples}
          />
        </div>
      </section>
      
      {/* Use Cases Section */}
      <div className="container mx-auto px-4 max-w-7xl">
        <UseCasesSection />
      </div>
      
      {/* Stream Action Cards */}
      <section className="py-16 bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">Ready to Transform?</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Start your own AI-stylized stream or join someone else&apos;s
            </p>
          </div>
        
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="h-full transition-all hover:shadow-lg border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-400 to-indigo-600"></div>
              <CardHeader>
                <CardTitle className="text-2xl">Start Streaming</CardTitle>
                <CardDescription className="text-base">
                  Create your own AI-stylized livestream
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
                <p className="mt-4 text-gray-700">
                  Launch your own AI-processed stream and share it with anyone around the world.
                  Each frame is transformed with a diffusion model.
                </p>
                <div className="mt-2 p-3 bg-blue-50 rounded-md">
                  <p className="text-sm text-gray-700">
                    <strong>Note:</strong> Processing takes ~1.5 seconds per frame for artistic quality
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Link href="/stream" className="w-full">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-5">Start Streaming</Button>
                </Link>
              </CardFooter>
            </Card>

            <Card className="h-full transition-all hover:shadow-lg border-0 shadow-md overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-pink-400 to-orange-400"></div>
              <CardHeader>
                <CardTitle className="text-2xl">Watch Streams</CardTitle>
                <CardDescription className="text-base">
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
                        <li key={streamId} className="border border-gray-200 rounded-md p-2 hover:bg-gray-50 transition-colors">
                          <Link href={`/watch/${streamId}`} className="text-blue-600 hover:underline">
                            Stream {streamId}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="mt-4 text-gray-700">
                    Enter a stream ID to watch an existing stream, or check back later for active streams.
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <div className="w-full space-y-2">
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
                      className="flex-1 px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter Stream ID"
                      required
                    />
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-lg py-5">Watch</Button>
                  </form>
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">How It Works</h2>
            <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
              Simple steps to transform your webcam feed into artistic livestreams
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
            <div className="p-6 bg-white rounded-lg shadow border border-gray-100 relative hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl">1</div>
              <h3 className="font-bold text-xl mb-3 text-center">Start a Stream</h3>
              <p className="text-gray-600 text-center">
                Click &quot;Start Streaming&quot; and grant camera access to begin your creative AI-processed broadcast
              </p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow border border-gray-100 relative hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl">2</div>
              <h3 className="font-bold text-xl mb-3 text-center">Choose Your Style</h3>
              <p className="text-gray-600 text-center">
                Enter a prompt to define how your stream will look — from cyberpunk to watercolor and beyond
              </p>
            </div>
            
            <div className="p-6 bg-white rounded-lg shadow border border-gray-100 relative hover:shadow-lg transition-shadow">
              <div className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 text-white font-bold text-2xl">3</div>
              <h3 className="font-bold text-xl mb-3 text-center">Share & Watch</h3>
              <p className="text-gray-600 text-center">
                Copy your unique stream ID to share or enter someone else&apos;s ID to view their artistic creation
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
