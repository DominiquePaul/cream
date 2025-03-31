"use client";

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, AlertCircle, Clock, Sparkles } from 'lucide-react';
import { formatNumber } from '@/utils/formatters';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// Predefined credit packages
const CREDIT_PACKAGES = [
  { amount: 12, label: '12 credits', isPopular: true, price: '€12' },
  { amount: 30, label: '30 credits', isPopular: false, price: '€30' },
  { amount: 60, label: '60 credits', isPopular: false, price: '€60' },
  { amount: 120, label: '120 credits', isPopular: false, price: '€120' },
];

// Component to display credits and purchase button
export default function CreditsDisplay({ showPurchase = true, compact = false, showTimeRemaining = false }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPurchaseForm, setShowPurchaseForm] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState('12');
  const [customAmount, setCustomAmount] = useState('');
  const [useCustomAmount, setUseCustomAmount] = useState(false);
  
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
      // Determine which amount to use
      let checkoutUrl = '/api/checkout/credits';
      
      if (useCustomAmount && customAmount) {
        // Use custom amount
        const numAmount = parseInt(customAmount, 10);
        if (isNaN(numAmount) || numAmount < 5) {
          alert('Please enter a valid amount (minimum 5 credits)');
          setLoading(false);
          return;
        }
        checkoutUrl += `?custom=${numAmount}`;
      } else {
        // Use predefined package
        checkoutUrl += `?amount=${selectedPackage}`;
      }
      
      // Redirect to checkout
      window.location.href = checkoutUrl;
    } catch (error) {
      console.error('Error starting checkout:', error);
      setLoading(false);
    }
  };

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
        {showPurchase && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowPurchaseForm(true)}
            disabled={loading}
            className="ml-2"
          >
            {loading ? 'Processing...' : 'Buy Credits'}
          </Button>
        )}
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
        
        {showPurchase && showPurchaseForm && (
          <div className="mt-4 border-t border-gray-200 pt-4">
            <h3 className="text-sm font-medium mb-3">Purchase Credits</h3>
            
            <RadioGroup 
              defaultValue="12"
              value={useCustomAmount ? 'custom' : selectedPackage}
              onValueChange={(value) => {
                if (value === 'custom') {
                  setUseCustomAmount(true);
                } else {
                  setUseCustomAmount(false);
                  setSelectedPackage(value);
                }
              }}
              className="space-y-2"
            >
              {CREDIT_PACKAGES.map((pkg) => (
                <div key={pkg.amount} className="flex items-center space-x-2">
                  <RadioGroupItem value={pkg.amount.toString()} id={`credits-${pkg.amount}`} />
                  <Label htmlFor={`credits-${pkg.amount}`} className="flex items-center justify-between flex-1 cursor-pointer">
                    <span className="flex items-center">
                      {pkg.label}
                      {pkg.isPopular && (
                        <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Popular
                        </span>
                      )}
                    </span>
                    <span>{pkg.price}</span>
                  </Label>
                </div>
              ))}
              
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="custom" id="credits-custom" />
                <Label htmlFor="credits-custom" className="flex items-center w-full cursor-pointer">
                  <span className="mr-3">Custom amount</span>
                  <Input
                    type="number"
                    min="5"
                    placeholder="Enter amount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    onClick={() => setUseCustomAmount(true)}
                    className="w-20"
                  />
                  <span className="ml-2">€{formatNumber(parseInt(customAmount || '0'))}</span>
                </Label>
              </div>
            </RadioGroup>
            
            <div className="flex space-x-2 mt-4">
              <Button
                variant="outline"
                onClick={() => setShowPurchaseForm(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleBuyCredits}
                disabled={loading || (useCustomAmount && (!customAmount || parseInt(customAmount) < 5))}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
              >
                {loading ? 'Processing...' : 'Checkout'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
      
      {showPurchase && !showPurchaseForm && (
        <CardFooter>
          <Button
            onClick={() => setShowPurchaseForm(true)}
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700"
          >
            {loading ? 'Processing...' : 'Buy Credits'}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
} 