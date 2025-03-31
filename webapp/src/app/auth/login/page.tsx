"use client";

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const searchParams = useSearchParams();
  const nextUrl = searchParams?.get('next') || '/';
  const { session, refreshUser } = useAuth();

  // Check if user is already logged in
  useEffect(() => {
    if (session) {
      console.log("LoginPage: User already logged in, redirecting to:", nextUrl);
      window.location.href = nextUrl;
    }
  }, [session, nextUrl]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (redirectInProgress) {
      console.log("LoginPage: Redirect already in progress, preventing duplicate login");
      return;
    }
    
    setLoading(true);
    setError(null);
    setRedirectInProgress(true);

    try {
      console.log("LoginPage: Attempting login for:", email);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      
      if (data.session) {
        console.log(`LoginPage: Login successful, redirecting to: ${nextUrl}`);
        
        // First refresh our auth context
        await refreshUser();
        
        // Force redirect without relying on state updates
        window.location.href = nextUrl;
      } else {
        throw new Error("No session returned after login");
      }
    } catch (error: unknown) {
      console.error("LoginPage: Login error:", error);
      setError(error instanceof Error ? error.message : 'Failed to sign in');
      setRedirectInProgress(false);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Sign In</CardTitle>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="/auth/reset-password" className="text-sm text-blue-600 hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                {error}
              </div>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 border-t pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-600 mb-2">Don&apos;t have an account?</p>
            <Link href="/auth/signup">
              <Button variant="default" className="w-full">
                Create Account
              </Button>
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
} 