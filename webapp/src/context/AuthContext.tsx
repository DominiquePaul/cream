"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface UserProfile {
  id: string;
  email?: string;
  username?: string;
  full_name?: string;
  is_admin: boolean;
}

interface AuthContextType {
  user: UserProfile | null;
  isAdmin: boolean;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  signOut: async () => {},
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refreshUser = async () => {
    try {
      // Get the current session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setUser(null);
        setIsAdmin(false);
        setIsLoading(false);
        return;
      }
      
      // Get the user profile from the profiles table
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();
        
      if (error || !profile) {
        console.error('Error fetching user profile:', error);
        setUser(null);
        setIsAdmin(false);
      } else {
        setUser({
          id: profile.id,
          email: session.user.email,
          username: profile.username,
          full_name: profile.full_name,
          is_admin: profile.is_admin || false,
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
  };

  useEffect(() => {
    // Initial fetch of user data
    refreshUser();
    
    // Set up auth state change listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session) {
          refreshUser();
        } else {
          setUser(null);
          setIsAdmin(false);
          setIsLoading(false);
        }
      }
    );
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setIsAdmin(false);
    router.refresh();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAdmin,
        isLoading,
        signOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
} 