"use client";

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { CreditCard, Sparkles } from "lucide-react";

// Component to handle the credits purchase dialog
export const CreditPurchaseButton = () => {
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
          className="flex items-center gap-2" 
          size="sm"
          onClick={() => setDialogOpen(true)}
        >
          <CreditCard className="h-4 w-4" />
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

export default function ProfileClient() {
  return null; // This component exists just to satisfy the import
} 