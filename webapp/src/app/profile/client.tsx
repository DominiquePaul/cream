"use client";

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export default function ProfileClient() {
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams?.get('checkout');
  const { refreshUser } = useAuth();

  // Handle checkout completion when returning from Stripe
  useEffect(() => {
    if (checkoutStatus === 'success') {
      // Refresh user data to get updated credits
      refreshUser().then(() => {
        toast.success("Purchase Complete", {
          description: "Your credits have been added to your account.",
        });
        
        // Remove the query parameter to prevent showing the toast on refresh
        const url = new URL(window.location.href);
        url.searchParams.delete('checkout');
        window.history.replaceState({}, '', url);
      });
    } else if (checkoutStatus === 'canceled') {
      toast.error("Payment Canceled", {
        description: "Your purchase was not completed.",
      });
      
      // Remove the query parameter to prevent showing the toast on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('checkout');
      window.history.replaceState({}, '', url);
    }
  }, [checkoutStatus, refreshUser]);

  return null; // This component doesn't render anything visible
} 