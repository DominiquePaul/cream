"use client";

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Session } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  is_admin: boolean;
  credits: number;
}

interface AuthContextType {
  user: UserProfile | null;
  session: Session | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router = useRouter();
  
  const [user, setUser] = useState<UserProfile | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  const refreshUser = useCallback(async () => {
    try {
      setIsLoading(true);
      
      // Get the current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);
      
      if (!currentSession) {
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      
      // Get the user profile from the profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentSession.user.id)
        .single();
        
      if (error || !profile) {
        console.error('Error fetching user profile:', error);
        setUser(null);
        setIsAdmin(false);
      } else {
        setUser({
          id: profile.id,
          email: currentSession.user.email,
          username: profile.username,
          full_name: profile.full_name,
          is_admin: profile.is_admin || false,
          credits: profile.credits || 0,
        });
        setIsAdmin(profile.is_admin || false);
      }
    } catch (error) {
      console.error('Error in refreshUser:', error);
      setUser(null);
      setIsAdmin(false);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      await refreshUser();
      setAuthInitialized(true);
    };
    
    initializeAuth();
  }, [refreshUser]);
  
  // Set up auth state change listener, but only after initial load
  useEffect(() => {
    if (!authInitialized) return;
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        console.log('Auth state changed:', event);
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await refreshUser();
          
          // If we're on an auth page, redirect to profile
          if (window.location.pathname.startsWith('/auth')) {
            console.log('Auth state changed and we are on auth page, redirecting to profile');
            router.push('/profile');
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setIsAdmin(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, [refreshUser, authInitialized, router, supabase]);

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setIsAdmin(false);
      
      // Use Next.js router
      router.push('/');
      router.refresh();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const contextValue = {
    user,
    session,
    isAdmin,
    isLoading,
    signOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
} 