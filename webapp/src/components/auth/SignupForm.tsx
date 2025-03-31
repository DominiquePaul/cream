"use client";

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Check, X, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { debounce } from 'lodash';
import { useAuth } from '@/context/AuthContext';

export default function SignupForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [redirectInProgress, setRedirectInProgress] = useState(false);
  const { session } = useAuth();
  
  // Validation states
  const [isUsernameValid, setIsUsernameValid] = useState<boolean | null>(null);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [passwordStrength, setPasswordStrength] = useState<'weak' | 'medium' | 'strong' | null>(null);
  
  // Check if user is already logged in and redirect if needed
  useEffect(() => {
    if (session) {
      console.log("SignupForm: User already authenticated, redirecting to home");
      window.location.href = '/';
    }
  }, [session]);
  
  // Create debounced username availability check
  const checkUsernameAvailability = useRef(
    debounce(async (username: string) => {
      if (!username || username.length < 3) {
        setIsUsernameAvailable(null);
        return;
      }
      
      try {
        setIsCheckingUsername(true);
        const { data } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', username)
          .single();
          
        setIsUsernameAvailable(!data);
      } catch {
        setIsUsernameAvailable(true); // Assume available on error
      } finally {
        setIsCheckingUsername(false);
      }
    }, 500)
  ).current;
  
  // Check username validity and availability when username changes
  useEffect(() => {
    // Validate username
    if (!username) {
      setIsUsernameValid(null);
      setIsUsernameAvailable(null);
      return;
    }
    
    const isValid = /^[a-zA-Z0-9_]+$/.test(username);
    setIsUsernameValid(isValid);
    
    if (isValid && username.length >= 3) {
      checkUsernameAvailability(username);
    } else {
      setIsUsernameAvailable(null);
    }
  }, [username, checkUsernameAvailability]);
  
  // Password strength checker
  useEffect(() => {
    if (!password) {
      setPasswordStrength(null);
      return;
    }
    
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;
    
    const score = [hasUppercase, hasLowercase, hasNumbers, hasSpecialChars, isLongEnough].filter(Boolean).length;
    
    if (score <= 2) {
      setPasswordStrength('weak');
    } else if (score <= 4) {
      setPasswordStrength('medium');
    } else {
      setPasswordStrength('strong');
    }
  }, [password]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (redirectInProgress) {
      console.log("SignupForm: Redirect already in progress, preventing duplicate signup");
      return;
    }
    
    setLoading(true);
    setError(null);
    setMessage(null);
    setRedirectInProgress(true);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      setRedirectInProgress(false);
      return;
    }

    // Validate username (alphanumeric and underscores only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      setError('Username can only contain letters, numbers, and underscores');
      setLoading(false);
      setRedirectInProgress(false);
      return;
    }

    try {
      console.log("SignupForm: Attempting to create account for:", email);
      
      // First check if username is already taken
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .single();

      if (existingUser) {
        setError('Username is already taken');
        setLoading(false);
        setRedirectInProgress(false);
        return;
      }

      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            full_name: fullName,
          }
        },
      });

      if (error) throw error;
      
      if (data.user) {
        // Update the profile information
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            username,
            full_name: fullName,
            email,
            referral_source: referralSource
          })
          .eq('id', data.user.id);

        if (profileError) throw profileError;
      }
      
      // Check if email confirmation is required
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        console.log("SignupForm: Email already registered");
        setError('The email address is already registered');
        setRedirectInProgress(false);
        setLoading(false);
      } else {
        console.log("SignupForm: Account created successfully");
        setMessage('Account created successfully! Check your email for confirmation link if required.');
        // Redirect to login after a brief delay without relying on state updates
        window.location.href = '/auth/login';
      }
    } catch (error: unknown) {
      console.error("SignupForm: Signup error:", error);
      setError(error instanceof Error ? error.message : 'Failed to sign up');
      setRedirectInProgress(false);
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => prev - 1);
  };

  const renderPasswordStrengthIndicator = () => {
    if (!passwordStrength) return null;
    
    const getColor = () => {
      switch (passwordStrength) {
        case 'weak': return 'bg-red-500';
        case 'medium': return 'bg-yellow-500';
        case 'strong': return 'bg-green-500';
        default: return 'bg-gray-200';
      }
    };
    
    const getWidth = () => {
      switch (passwordStrength) {
        case 'weak': return 'w-1/3';
        case 'medium': return 'w-2/3';
        case 'strong': return 'w-full';
        default: return 'w-0';
      }
    };
    
    return (
      <div className="mt-1">
        <div className="h-1 w-full bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full ${getWidth()} ${getColor()} transition-all duration-300`}></div>
        </div>
        <p className="text-xs mt-1 text-gray-600">
          {passwordStrength === 'weak' && 'Weak password - add more variety'}
          {passwordStrength === 'medium' && 'Medium strength - getting better!'}
          {passwordStrength === 'strong' && 'Strong password - excellent choice!'}
        </p>
      </div>
    );
  };
  
  const renderStepOne = () => (
    <>
      <div className="space-y-4 mb-8">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. bill.hines@pdc.com"
              required
              autoComplete="email"
              className="pr-10"
            />
            {email && email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/) ? (
              <Check className="w-4 h-4 absolute right-3 top-3 text-green-500" />
            ) : email ? (
              <X className="w-4 h-4 absolute right-3 top-3 text-red-500" />
            ) : null}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="password">
            Password
            <button
              type="button"
              onClick={() => setPasswordVisible(!passwordVisible)}
              className="ml-2 text-gray-500 focus:outline-none"
              aria-label={passwordVisible ? "Hide password" : "Show password"}
            >
              {passwordVisible ? (
                <EyeOff className="w-4 h-4 inline" />
              ) : (
                <Eye className="w-4 h-4 inline" />
              )}
            </button>
          </Label>
          <Input
            id="password"
            type={passwordVisible ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Create a strong password"
            required
            autoComplete="new-password"
          />
          {renderPasswordStrengthIndicator()}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">Confirm Password</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={passwordVisible ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              autoComplete="new-password"
              className="pr-10"
            />
            {confirmPassword && (
              password === confirmPassword ? (
                <Check className="w-4 h-4 absolute right-3 top-3 text-green-500" />
              ) : (
                <X className="w-4 h-4 absolute right-3 top-3 text-red-500" />
              )
            )}
          </div>
          {confirmPassword && password !== confirmPassword && (
            <p className="text-xs text-red-500 mt-1">Passwords don&apos;t match</p>
          )}
        </div>
      </div>
      
      <Button
        type="button"
        className="w-full"
        onClick={nextStep}
        disabled={!email || !password || !confirmPassword || password !== confirmPassword || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)}
      >
        Continue
      </Button>
    </>
  );
  
  const renderStepTwo = () => (
    <>
      <div className="space-y-4 mb-8">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="e.g. Bill Hines"
            required
            autoComplete="name"
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a unique username"
              required
              autoComplete="username"
              className={`pr-10 ${
                isUsernameValid === false ? 'border-red-500 focus:ring-red-500' :
                isUsernameAvailable === false ? 'border-red-500 focus:ring-red-500' :
                isUsernameValid && isUsernameAvailable ? 'border-green-500 focus:ring-green-500' :
                ''
              }`}
            />
            {isCheckingUsername ? (
              <div className="absolute right-3 top-3">
                <div className="animate-spin h-4 w-4 border-2 border-gray-500 border-t-transparent rounded-full"></div>
              </div>
            ) : (
              username && (
                isUsernameValid === false ? (
                  <X className="w-4 h-4 absolute right-3 top-3 text-red-500" />
                ) : isUsernameAvailable === false ? (
                  <X className="w-4 h-4 absolute right-3 top-3 text-red-500" />
                ) : isUsernameValid && isUsernameAvailable ? (
                  <Check className="w-4 h-4 absolute right-3 top-3 text-green-500" />
                ) : null
              )
            )}
          </div>
          <div className="text-xs text-gray-500 space-y-1">
            <p>This will be used for your unique stream URL. Only letters, numbers, and underscores.</p>
            {username && isUsernameValid === false && (
              <p className="text-red-500">Username can only contain letters, numbers, and underscores</p>
            )}
            {username && isUsernameValid && isUsernameAvailable === false && (
              <p className="text-red-500">This username is already taken</p>
            )}
            {username && isUsernameValid && isUsernameAvailable && (
              <p className="text-green-500">Username is available!</p>
            )}
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="referralSource">How did you hear about us?</Label>
          <Input
            id="referralSource"
            type="text"
            value={referralSource}
            onChange={(e) => setReferralSource(e.target.value)}
            placeholder="e.g. Google, Friend, X, blog post, ..."
          />
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={prevStep}
        >
          Back
        </Button>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || !fullName || !username || isUsernameValid === false || isUsernameAvailable === false}
        >
          {loading ? 'Creating account...' : 'Sign Up'}
        </Button>
      </div>
    </>
  );

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Create an Account</CardTitle>
        <CardDescription>Sign up to start using the application</CardDescription>
        
        {/* Step indicator */}
        <div className="flex justify-center mt-4">
          <div className="flex items-center space-x-2">
            <div className={`h-2 w-2 rounded-full ${currentStep === 1 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
            <div className={`h-2 w-2 rounded-full ${currentStep === 2 ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSignup} className="space-y-6">
          {currentStep === 1 && renderStepOne()}
          {currentStep === 2 && renderStepTwo()}
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm flex items-start">
              <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          {message && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-600 text-sm flex items-start">
              <Check className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}
        </form>
      </CardContent>
      <CardFooter className="flex justify-center border-t pt-6">
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/auth/login" className="text-blue-600 hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
} 