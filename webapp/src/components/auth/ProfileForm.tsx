"use client";

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { User } from '@supabase/supabase-js'; // Import User type from supabase

// Define interfaces for type safety
interface Profile {
  id: string;
  username?: string | null;
  full_name?: string | null;
  email?: string; // This usually comes from the user object, but kept for consistency if needed
  referral_source?: string | null;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
}

// Define props for the component
interface ProfileFormProps {
  user: User;
  profile: Profile | null; // Profile might be null if not created yet
}

const supabase = createClient();

export default function ProfileForm({ user, profile }: ProfileFormProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false); // Loading only for updates now
  // Initialize state from props
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [referralSource, setReferralSource] = useState(profile?.referral_source || '');
  const [isAdmin] = useState(profile?.is_admin || false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      // User is now passed as a prop
      if (!user) throw new Error('User not available'); 
      // Profile data is initialized from props
      const initialUsername = profile?.username;
      
      // Validate username
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
      }
      
      // Check if username is taken by another user only if it has changed
      if (username && username !== initialUsername) {
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .not('id', 'eq', user.id)
          .maybeSingle(); // Use maybeSingle to handle 0 or 1 result

        if (checkError) {
          throw checkError;
        }
  
        if (existingUser) {
          throw new Error('Username is already taken');
        }
      }
      
      const updates = {
        id: user.id,
        full_name: fullName,
        username,
        referral_source: referralSource,
        updated_at: new Date().toISOString(),
        // Do not update is_admin from the form
        // Do not update email from the form
      };
      
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updates)
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setMessage('Profile updated successfully');
      // Refresh the page to show updated data
      router.refresh();

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await signOut();
      // The redirect is handled by the AuthContext
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Your Profile {isAdmin && <span className="text-sm text-purple-600 ml-2">(Admin)</span>}</CardTitle>
        <CardDescription>Update your account information</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={updateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={user?.email || ''} // Use user prop for email
              disabled
              className="bg-gray-50"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              type="text"
              value={fullName} // Use state variable
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username} // Use state variable
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
              placeholder="Choose a username"
            />
            <p className="text-xs text-gray-500">
              Used for your stream URL. Only letters, numbers, and underscores.
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="referralSource">How did you hear about us?</Label>
            <Input
              id="referralSource"
              type="text"
              value={referralSource} // Use state variable
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferralSource(e.target.value)}
              placeholder="How did you hear about us?"
              disabled={!!profile?.referral_source} // Disable based on initial profile prop
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
          
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Profile'}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-4">
        <Button variant="outline" onClick={handleSignOut} className="text-red-600">
          Sign Out
        </Button>
      </CardFooter>
    </Card>
  );
} 