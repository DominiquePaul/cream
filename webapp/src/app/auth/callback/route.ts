import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    // Create a response first
    const response = NextResponse.redirect(new URL('/', request.url));
    
    // Create a supabase client using the request and response
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get: (name) => request.cookies.get(name)?.value,
          set: (name, value, options) => {
            response.cookies.set({ name, value, ...options });
          },
          remove: (name, options) => {
            response.cookies.set({ name, value: '', ...options });
          },
        },
      }
    );
    
    // Exchange the code for a session
    await supabase.auth.exchangeCodeForSession(code);
    
    return response;
  }

  // URL to redirect to after sign in
  return NextResponse.redirect(new URL('/', request.url));
} 