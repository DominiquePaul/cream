import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const res = NextResponse.next();
  
  // Create a Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name) => req.cookies.get(name)?.value,
        set: (name, value, options) => {
          res.cookies.set({ name, value, ...options });
        },
        remove: (name, options) => {
          res.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  // Refresh session if expired
  const { data: { session } } = await supabase.auth.getSession();

  // Check auth for protected routes
  const isAuthRoute = req.nextUrl.pathname.startsWith('/auth');
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/profile') || 
                           req.nextUrl.pathname.startsWith('/broadcast') ||
                           req.nextUrl.pathname.startsWith('/admin');

  // If accessing auth pages while logged in, redirect to home
  if (isAuthRoute && session) {
    return NextResponse.redirect(new URL('/', req.url));
  }

  // If accessing protected pages while logged out, redirect to login
  if (isProtectedRoute && !session) {
    return NextResponse.redirect(new URL('/auth/login?next=' + encodeURIComponent(req.nextUrl.pathname), req.url));
  }

  // Special handling for admin routes
  if (req.nextUrl.pathname.startsWith('/admin') && session) {
    // Fetch the user's profile to check if they're an admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', session.user.id)
      .single();

    // If not admin, redirect to home
    if (!profile?.is_admin) {
      return NextResponse.redirect(new URL('/', req.url));
    }
  }

  return res;
}

export const config = {
  matcher: ['/auth/:path*', '/profile/:path*', '/broadcast', '/admin/:path*'],
} 