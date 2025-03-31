"use client";

import { Badge } from "@/components/ui/badge";

interface StyleExample {
  title: string;
  prompt: string;
  imageSrc: string;
}

interface TransformationExamplesProps {
  originalImageSrc?: string;
  styleExamples: StyleExample[];
}

export default function TransformationExamples({ 
  originalImageSrc = "/placeholder-original.jpg", 
  styleExamples 
}: TransformationExamplesProps) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
        {/* Original Image */}
        <div className="lg:col-span-1">
          <div className="relative rounded-lg overflow-hidden shadow-md border border-gray-200">
            <div className="absolute top-0 left-0 right-0 bg-black/70 text-white text-xs font-medium py-1 px-2 z-10">
              Original Webcam
            </div>
            <div 
              className="w-full bg-gray-100 relative" 
              style={{ 
                backgroundImage: `url(${originalImageSrc})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                height: '240px'
              }}
            >
            </div>
          </div>
        </div>

        {/* Transformed Examples */}
        <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {styleExamples.map((example, index) => (
            <div key={index} className="rounded-lg overflow-hidden shadow-md border border-gray-200 hover:shadow-lg transition-shadow relative">
              <div 
                className="w-full relative" 
                style={{ 
                  backgroundImage: `url(${example.imageSrc})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  height: '240px'
                }}
              >
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-white p-2">
                <h4 className="text-sm font-medium mb-1">{example.title}</h4>
                <div className="flex flex-wrap gap-1 mt-1">
                  <Badge variant="secondary" className="text-xs bg-blue-600/90 hover:bg-blue-700 text-white">
                    {example.prompt}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 