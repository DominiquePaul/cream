"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

// Updated credit packages to match backend
const CREDIT_PACKAGES = [
  { id: 'small', amount: 12, label: '12 credits', isPopular: true, price: '€12.00' },
  { id: 'medium', amount: 30, label: '30 credits', isPopular: false, price: '€30.00' },
  { id: 'large', amount: 60, label: '60 credits', isPopular: false, price: '€60.00' },
  { id: 'xlarge', amount: 120, label: '120 credits', isPopular: false, price: '€120.00' },
];

// Component to display credits and purchase button
export default function CreditsDisplay({ showPurchase = true, compact = false, showTimeRemaining = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('small');
  
  // Calculate remaining stream time in minutes
  const creditsPerMinute = 0.2; // 12 credits per hour = 0.2 credits per minute
  const remainingMinutes = user?.credits ? Math.floor(user.credits / creditsPerMinute) : 0;
  
  // Format the hours and minutes for better readability
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  const timeString = hours > 0 
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;
  
  // Color styling based on remaining time
  const isLowCredits = remainingMinutes < 10;
  const creditStyle = isLowCredits ? 'text-red-600 font-bold' : 'text-green-600 font-bold';
  const timeStyle = isLowCredits ? 'text-red-500' : 'text-gray-600';

  // Start the checkout process
  const handleBuyCredits = async () => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  // Credit purchase dialog component
  const CreditPurchaseDialog = () => (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant={compact ? "outline" : "default"}
          size={compact ? "sm" : "default"}
          onClick={() => setDialogOpen(true)}
          disabled={loading}
          className={compact ? "ml-2" : "w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"}
        >
          {loading ? 'Processing...' : 'Buy Credits'}
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
            {CREDIT_PACKAGES.map((pkg) => (
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
              disabled={loading}
              className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
            >
              {loading ? 'Processing...' : 'Checkout'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center">
          <Coins className="h-4 w-4 text-yellow-500 mr-1" />
          <span className={creditStyle}>{formatNumber(user?.credits || 0)}</span>
        </div>
        {showTimeRemaining && (
          <div className="flex items-center">
            <Clock className="h-4 w-4 text-gray-400 mr-1" />
            <span className={timeStyle}>{timeString}</span>
          </div>
        )}
        {showPurchase && <CreditPurchaseDialog />}
      </div>
    );
  }

  return (
    <Card className="border-0 shadow-md bg-gradient-to-r from-indigo-50 to-blue-50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center text-lg">
          <Coins className="h-5 w-5 text-yellow-500 mr-2" />
          Credits Balance
        </CardTitle>
        <CardDescription>
          Used for streaming time (1 credit = €1)
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="text-3xl font-bold">
          <span className={creditStyle}>{formatNumber(user?.credits || 0)}</span>
          <span className="text-sm text-gray-500 ml-1">credits</span>
        </div>
        
        {showTimeRemaining && (
          <div className="mt-2 flex items-center">
            <Clock className="h-4 w-4 text-gray-400 mr-2" />
            <span className={`text-sm ${timeStyle}`}>
              Stream time remaining: <span className="font-medium">{timeString}</span>
            </span>
          </div>
        )}
        
        {isLowCredits && showTimeRemaining && (
          <div className="mt-2 rounded-md bg-red-50 p-2 flex items-start">
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
            <p className="text-xs text-red-700">
              {remainingMinutes === 0 
                ? "You don't have enough credits to stream. Please purchase more credits."
                : `Low credits! You have less than 10 minutes of streaming time remaining.`}
            </p>
          </div>
        )}
      </CardContent>
      
      {showPurchase && (
        <CardFooter>
          <CreditPurchaseDialog />
        </CardFooter>
      )}
    </Card>
  );
} 