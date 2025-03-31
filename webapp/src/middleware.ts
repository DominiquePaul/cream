import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

// Define protected and auth routes
const protectedPaths = ['/profile']
const authPaths = ['/auth/login', '/auth/signup']
const isProtectedPath = (path: string) => protectedPaths.some(pp => path.startsWith(pp))
const isAuthPath = (path: string) => authPaths.some(ap => path.startsWith(ap))

export async function middleware(request: NextRequest) {
  // Add a custom header to track loop detection
  // If we've already seen this exact URL in this request chain, skip processing
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const processedUrl = request.headers.get('x-processed-url')
  
  if (processedUrl === request.nextUrl.pathname) {
    console.log(`Detected loop for path: ${request.nextUrl.pathname}`)
    return NextResponse.next() // Break the loop
  }
  
  // Get Supabase client with cookie handling
  const { supabase, response } = createClient(request)
  
  // Refresh the auth state (important for session cookies)
  await supabase.auth.getSession()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  
  console.log(`Middleware: path=${path}, authenticated=${!!user}`)
  
  // RULE 1: Protected routes require authentication
  if (!user && isProtectedPath(path)) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('next', path)
    
    const redirectResponse = NextResponse.redirect(redirectUrl)
    // Add tracking headers to detect loops
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-processed-url', path)
    
    return redirectResponse
  }
  
  // RULE 2: Auth pages shouldn't be accessible when logged in
  if (user && isAuthPath(path)) {
    const redirectUrl = new URL('/profile', request.url)
    
    const redirectResponse = NextResponse.redirect(redirectUrl)
    // Add tracking headers to detect loops
    redirectResponse.headers.set('x-request-id', requestId)
    redirectResponse.headers.set('x-processed-url', path)
    
    return redirectResponse
  }
  
  // For all other paths, add the tracking headers to the response
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-processed-url', path)
  
  return response
}

// Configure the middleware to run on these paths
export const config = {
  matcher: [
    // Match routes that need authentication protection
    '/profile/:path*',
    // Match auth routes to prevent authenticated users from accessing
    '/auth/:path*',
    // Match the home page and other key pages
    '/',
    '/stream/:path*',
    '/watch/:path*',
  ],
} 