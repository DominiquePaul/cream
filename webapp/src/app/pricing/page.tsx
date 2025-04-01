import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-white to-gray-50 py-16">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-4">Beta Access</Badge>
          <h1 className="text-5xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            No, we&apos;re not another SaaS. Pay only for what you use, with no hidden fees, complicated tiers or risk of overcharging your credit card by accident.
          </p>
        </div>

        {/* Main Pricing Card */}
        <div className="max-w-2xl mx-auto mb-16">
          <Card className="border-2 border-blue-500 shadow-xl relative overflow-hidden">
            
            <CardHeader className="pt-12">
              <div className="text-center space-y-2">
                <div className="flex items-center justify-center gap-2">
                  <span className="text-4xl font-bold text-blue-600">€0.20</span>
                  <span className="text-gray-600">/minute</span>
                </div>
                <div className="text-sm text-gray-500">Pay as you go</div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <span className="font-medium">Why this price?</span> We&apos;re running powerful AI models on high-end GPUs to transform your stream in real-time. The slim margin we&apos;ve added allows us to take time building new features and improvements. 🚀
                </p>    
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>12 free credits when you sign up</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>No monthly fees or commitments</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>Unlimited viewers per stream</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Check className="h-5 w-5 text-green-500" />
                  <span>All AI styles included</span>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <p className="text-sm text-gray-800">
                  <strong>Example:</strong> A 1-hour stream costs €12 (60 minutes × €0.20)
                </p>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Link href="/stream" className="w-full">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-lg py-6">
                  Start Streaming Now
                </Button>
              </Link>
              <p className="text-sm text-gray-500 text-center">
                No credit card required to start
              </p>
            </CardFooter>
          </Card>
        </div>

        {/* Credit Purchase Section */}
        <div className="max-w-2xl mx-auto mb-16">
          <Card>
            <CardHeader>
              <h2 className="text-2xl font-bold text-center">Buy Credits</h2>
              <p className="text-center text-gray-600">Get more streaming time with our credit packages</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors">
                  <div className="text-2xl font-bold">12 Credits</div>
                  <div className="text-gray-600">12 minutes of streaming</div>
                  <div className="text-xl font-bold text-blue-600 mt-2">€12</div>
                  <Button className="w-full mt-4">Buy Now</Button>
                </div>
                <div className="border rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors">
                  <div className="text-2xl font-bold">30 Credits</div>
                  <div className="text-gray-600">30 minutes of streaming</div>
                  <div className="text-xl font-bold text-blue-600 mt-2">€30</div>
                  <Button className="w-full mt-4">Buy Now</Button>
                </div>
                <div className="border rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors">
                  <div className="text-2xl font-bold">60 Credits</div>
                  <div className="text-gray-600">1 hour of streaming</div>
                  <div className="text-xl font-bold text-blue-600 mt-2">€60</div>
                  <Button className="w-full mt-4">Buy Now</Button>
                </div>
                <div className="border rounded-lg p-4 text-center hover:border-blue-500 cursor-pointer transition-colors">
                  <div className="text-2xl font-bold">120 Credits</div>
                  <div className="text-gray-600">2 hours of streaming</div>
                  <div className="text-xl font-bold text-blue-600 mt-2">€120</div>
                  <Button className="w-full mt-4">Buy Now</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div className="border rounded-lg p-6 hover:border-blue-500 transition-colors">
              <h3 className="font-semibold mb-2">How do credits work?</h3>
              <p className="text-gray-600">
                Credits are our way of keeping things simple. 1 credit = 1 minute of streaming. You get 12 free credits when you sign up, and you can buy more credits whenever you need them.
              </p>
            </div>
            <div className="border rounded-lg p-6 hover:border-blue-500 transition-colors">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-gray-600">
                We accept all major credit cards through Stripe. We&apos;re working on adding more payment methods soon!
              </p>
            </div>
            <div className="border rounded-lg p-6 hover:border-blue-500 transition-colors">
              <h3 className="font-semibold mb-2">Can I get a refund?</h3>
              <p className="text-gray-600">
                If something went wrong with you were charged more credits than you used, we&apos;ll gladly refund your credits. Just reach out to me at dominique@palta-labs.com
              </p>
            </div>
            <div className="border rounded-lg p-6 hover:border-blue-500 transition-colors">
              <h3 className="font-semibold mb-2">Do you offer bulk discounts?</h3>
              <p className="text-gray-600">
                For events or regular streamers, we offer custom pricing. Just drop us an email and we&apos;ll work something out.
              </p>
            </div>
          </div>
        </div>

        {/* Contact Section */}
        <div className="mt-16 text-center">
          <h2 className="text-2xl font-bold mb-4">More Questions or Feedback?</h2>
          <p className="text-gray-600 mb-6">
            Shoot me a message and let me know what you like and what features you&apos;d like to see!
          </p>
          <Link href="mailto:dominique@palta-labs.com">
            <Button variant="outline" className="text-lg py-6">
              Contact Us
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
} 