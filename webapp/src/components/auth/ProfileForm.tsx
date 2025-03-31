"use client";

import { useState, useTransition } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from '@supabase/supabase-js';
import { updateProfile } from '@/app/profile/actions';

// Profile interface definition
interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string;
  referral_source?: string | null;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
}

// Props for the component
interface ProfileFormProps {
  user: User;
  profile: Profile | null;
}

export default function ProfileForm({ user, profile }: ProfileFormProps) {
  const { signOut } = useAuth();
  const [isPending, startTransition] = useTransition();
  
  // Initialize state from props
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [referralSource, setReferralSource] = useState(profile?.referral_source || '');
  const [isAdmin] = useState(profile?.is_admin || false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    
    // Get the form data
    const formData = new FormData(e.currentTarget);
    
    // Use a transition to avoid blocking the UI
    startTransition(async () => {
      // Call the server action with form data
      const result = await updateProfile(formData);
      
      if (result.success) {
        setMessage(result.message || 'Profile updated successfully');
      } else {
        setError(result.error || 'Failed to update profile');
      }
    });
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      // The redirect is handled by the AuthContext
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out. Please try again.');
      setSigningOut(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Your Profile {isAdmin && <span className="text-sm text-purple-600 ml-2">(Admin)</span>}</CardTitle>
        <CardDescription>Update your account information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="full_name">Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              name="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username"
            />
            <p className="text-xs text-gray-500">
              Used for your stream URL. Only letters, numbers, and underscores.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="referral_source">How did you hear about us?</Label>
            <Input
              id="referral_source"
              name="referral_source"
              type="text"
              value={referralSource}
              onChange={(e) => setReferralSource(e.target.value)}
              placeholder="How did you hear about us?"
              disabled={!!profile?.referral_source}
              className={profile?.referral_source ? "bg-gray-50" : ""}
            />
          </div>
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}
          
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-600 text-sm">
              {message}
            </div>
          )}
          
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-4">
        <Button 
          variant="outline" 
          onClick={handleSignOut} 
          className="text-red-600"
          disabled={signingOut}
        >
          {signingOut ? 'Signing Out...' : 'Sign Out'}
        </Button>
      </CardFooter>
    </Card>
  );
} 