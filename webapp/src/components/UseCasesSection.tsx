"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";

interface UseCase {
  title: string;
  description: string;
  icon: string;
  imageSrc: string;
  promptSuggestion: string;
}

export default function UseCasesSection() {
  const useCases: UseCase[] = [
    {
      title: "House Parties",
      description: "Create a unique visual experience for your guests with live artistic filters",
      icon: "🎉",
      imageSrc: "/placeholders/watercolour.jpeg",
      promptSuggestion: "A watercolor illustration",
    },
    {
      title: "Bars & Clubs",
      description: "Attract customers with mesmerizing visuals displayed on screens",
      icon: "🍸",
      imageSrc: "/placeholders/dali_style.jpeg",
      promptSuggestion: "A Dali surrealist dreamscape",
    },
    {
      title: "Art Installations",
      description: "Add an interactive element to your art exhibition or gallery",
      icon: "🎨",
      imageSrc: "/placeholders/coral_reef.jpeg",
      promptSuggestion: "An underwater coral reef fantasy",
    },
  ];

  return (
    <section className="py-12">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-gray-900">Transform Any Space</h2>
        <p className="mt-4 text-xl text-gray-600 max-w-3xl mx-auto">
          DreamStream brings AI-powered creativity to any environment
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {useCases.map((useCase, index) => (
          <Card key={index} className="overflow-hidden border-0 shadow-lg">
            <div className="h-48 relative overflow-hidden">
              <Image
                src={useCase.imageSrc}
                alt={useCase.title}
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition-transform hover:scale-105 duration-500"
                style={{ objectPosition: 'center center' }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent">
                <div className="absolute bottom-4 left-4 text-white">
                  <span className="text-3xl mr-2">{useCase.icon}</span>
                  <span className="text-xl font-bold">{useCase.title}</span>
                </div>
              </div>
            </div>
            <CardContent className="pt-4">
              <p className="text-gray-700">{useCase.description}</p>
              <div className="mt-4 p-3 bg-indigo-50 rounded-md">
                <p className="text-sm text-gray-700">
                  <span className="font-bold">Try this prompt:</span> {useCase.promptSuggestion}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
} 