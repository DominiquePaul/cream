"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRouter } from 'next/navigation';

// Define interfaces for type safety
interface User {
  id: string;
  email?: string;
}

interface Profile {
  id: string;
  username?: string;
  full_name?: string;
  email?: string;
  referral_source?: string;
  is_admin: boolean;
  created_at?: string;
  updated_at?: string;
}

export default function ProfileForm() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [profileData, setProfileData] = useState<Profile | null>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    const getProfile = async () => {
      try {
        // First check session - if no session redirect immediately
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('No active session, redirecting to login');
          router.push('/auth/login?next=/profile');
          return;
        }
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          console.log('No user found, redirecting to login');
          router.push('/auth/login?next=/profile');
          return;
        }
        
        setUser(user as User);
        
        // Fetch user profile from profiles table
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
          
        if (data) {
          setProfileData(data as Profile);
          setFullName(data.full_name || '');
          setUsername(data.username || '');
          setReferralSource(data.referral_source || '');
          setIsAdmin(data.is_admin || false);
        }
      } catch (err: unknown) {
        console.error('Error loading user:', err instanceof Error ? err.message : String(err));
        router.push('/auth/login?next=/profile');
      } finally {
        setLoading(false);
      }
    };
    
    getProfile();
  }, [router]);

  const updateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    
    try {
      if (!user) throw new Error('No user');
      if (!profileData) throw new Error('No profile data');
      
      // Validate username
      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        throw new Error('Username can only contain letters, numbers, and underscores');
      }
      
      // Check if username is taken by another user
      if (username !== profileData.username) {
        const { data: existingUser } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .not('id', 'eq', user.id)
          .single();
  
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
      };
      
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert(updates)
        .eq('id', user.id);
        
      if (updateError) throw updateError;
      
      setMessage('Profile updated successfully');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  if (loading) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-blue-500"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

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
              value={user?.email || ''}
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
              value={fullName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              value={username}
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
              value={referralSource}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReferralSource(e.target.value)}
              placeholder="How did you hear about us?"
              disabled={!!profileData?.referral_source} // Make it readonly if already set
              className={profileData?.referral_source ? "bg-gray-50" : ""}
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