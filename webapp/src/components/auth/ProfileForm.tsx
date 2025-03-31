"use client";

import { useState, useTransition } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, AlertCircle, Mail, AtSign, LogOut, UserIcon } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    
    // Get the form data
    const formData = new FormData(e.currentTarget);
    
    // Preserve the referral_source from the profile if it exists
    if (profile?.referral_source) {
      formData.set('referral_source', profile.referral_source);
    }
    
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
    <div className="space-y-6">
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-indigo-100 to-blue-100 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Personal Information</h2>
            <p className="text-sm text-gray-500 mt-1">Update your profile details</p>
          </div>
          
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label 
                    htmlFor="email" 
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <Mail className="h-4 w-4 text-gray-400" />
                    Email Address
                  </Label>
                  <div className="relative">
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ''}
                      disabled
                      className="pl-3 pr-3 py-2 bg-gray-50 border border-gray-200 text-gray-500 w-full rounded-md"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Your email address cannot be changed</p>
                </div>
                
                <div className="space-y-2">
                  <Label 
                    htmlFor="full_name" 
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <UserIcon className="h-4 w-4 text-gray-400" />
                    Full Name
                  </Label>
                  <Input
                    id="full_name"
                    name="full_name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    className="pl-3 pr-3 py-2 border border-gray-200 w-full rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label 
                    htmlFor="username" 
                    className="text-sm font-medium text-gray-700 flex items-center gap-2"
                  >
                    <AtSign className="h-4 w-4 text-gray-400" />
                    Username
                  </Label>
                  <Input
                    id="username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Choose a username"
                    className="pl-3 pr-3 py-2 border border-gray-200 w-full rounded-md focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Used for your stream URL. Only letters, numbers, and underscores.
                  </p>
                </div>
              </div>
              
              {error && (
                <div className="rounded-md bg-red-50 p-4 flex items-start">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
              
              {message && (
                <div className="rounded-md bg-green-50 p-4 flex items-start">
                  <div className="flex-shrink-0">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-700">{message}</p>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white px-6 py-2 rounded-md shadow-sm"
                  disabled={isPending}
                >
                  {isPending ? 'Saving Changes...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </CardContent>
      </Card>
      
      <Card className="overflow-hidden border-0 shadow-lg">
        <CardContent className="p-0">
          <div className="bg-gradient-to-r from-red-50 to-orange-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Account Actions</h2>
            <p className="text-sm text-gray-500 mt-1">Manage your account</p>
          </div>
          
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-medium text-gray-900">Sign out of your account</h3>
                <p className="text-sm text-gray-500 mt-1">
                  This will log you out of the current session
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={handleSignOut} 
                className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 rounded-md shadow-sm"
                disabled={signingOut}
              >
                <LogOut className="h-4 w-4" />
                {signingOut ? 'Signing Out...' : 'Sign Out'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 