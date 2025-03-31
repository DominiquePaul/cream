"use client";

import { Button } from "@/components/ui/button";
import Link from "next/link";
import Image from "next/image";

export default function HeroSection() {
  return (
    <div className="relative overflow-hidden">
      {/* Background gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-blue-50 to-purple-50"></div>
      
      {/* Animated circles */}
      <div className="absolute top-20 left-10 w-64 h-64 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
      <div className="absolute top-10 right-10 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-20 left-1/3 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      
      <div className="container relative mx-auto px-6 pt-24 pb-16 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              <span className="block">Create your own</span>
              <span className="block text-blue-600">interactive art livestream</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-lg mb-8">
              Share magical moments with friends by turning your webcam feed into stunning visuals powered by AI — in real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/stream" className="sm:w-auto w-full">
                <Button size="lg" className="w-full sm:w-auto text-lg py-6 px-8 bg-blue-600 hover:bg-blue-700 shadow-lg hover:shadow-xl transition-all">
                  Start Streaming
                </Button>
              </Link>
              <Link href="#examples" className="sm:w-auto w-full">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg py-6 px-8 border-2 shadow-md hover:shadow-lg transition-all">
                  See Examples
                </Button>
              </Link>
            </div>
          </div>
          
          <div className="relative mt-8 lg:mt-0 aspect-video">
            <div className="relative w-full h-full rounded-lg overflow-hidden shadow-2xl transform transition-all hover:scale-105 duration-500">
              <div className="absolute inset-0 bg-blue-600/10 z-10"></div>
              <Image
                src="/placeholders/dali_style.jpeg"
                alt="AI-styled stream example"
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover"
                priority
                style={{ objectPosition: 'center center' }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/70 to-transparent">
                <p className="text-white font-medium">
                  <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded mr-2">Prompt</span>
                  A Dali surrealist dreamscape
                </p>
              </div>
            </div>
            
            {/* Small floating original image */}
            <div className="absolute -bottom-5 -left-5 w-28 h-28 rounded-md overflow-hidden border-4 border-white shadow-lg">
              <div className="relative w-full h-full">
                <Image
                  src="/placeholders/original_frame.png"
                  alt="Original webcam feed"
                  fill
                  sizes="112px"
                  className="object-cover"
                  style={{ objectPosition: 'center center' }}
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <span className="text-white text-xs font-bold">Original</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 