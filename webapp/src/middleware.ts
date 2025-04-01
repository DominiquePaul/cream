import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/middleware'

// Define protected and auth routes
const protectedPaths = ['/profile', '/stream']
const authPaths = ['/auth/login', '/auth/signup']
const isProtectedPath = (path: string) => protectedPaths.some(pp => path.startsWith(pp))
const isAuthPath = (path: string) => authPaths.some(ap => path.startsWith(ap))

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Special handling for manifest file
  if (path.includes('site.webmanifest')) {
    console.log('Intercepting manifest request');
    // Return a properly formatted manifest with correct Content-Type
    return new NextResponse(
      JSON.stringify({
        name: "DreamStream",
        short_name: "DreamStream",
        icons: [
          {
            src: "/favicon/android-chrome-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/favicon/android-chrome-512x512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ],
        theme_color: "#ffffff",
        background_color: "#ffffff",
        display: "standalone"
      }),
      {
        headers: {
          'Content-Type': 'application/manifest+json',
          'Permissions-Policy': '',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
  
  // Add a custom header to track loop detection
  // If we've already seen this exact URL in this request chain, skip processing
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const processedUrl = request.headers.get('x-processed-url')
  
  if (processedUrl === path) {
    console.log(`Detected loop for path: ${path}`)
    return NextResponse.next() // Break the loop
  }
  
  // Get Supabase client with cookie handling
  const { supabase, response } = createClient(request)
  
  // Refresh the auth state (important for session cookies)
  await supabase.auth.getSession()
  
  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  
  console.log(`Middleware: path=${path}, authenticated=${!!user}`)
  
  // RULE 1: Protected routes require authentication
  if (!user && isProtectedPath(path)) {
    const redirectUrl = new URL('/auth/login', request.url)
    redirectUrl.searchParams.set('next', path)
    
    // Add a message for stream page redirects
    if (path.startsWith('/stream')) {
      redirectUrl.searchParams.set('message', 'Please login or register to start streaming')
    }
    
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
  
  // Special handling for Stripe-related paths
  if (path.includes('/api/webhook/stripe') || path.includes('/api/checkout/credits')) {
    const enhancedResponse = NextResponse.next()
    enhancedResponse.headers.set('Permissions-Policy', '')
    enhancedResponse.headers.set('Access-Control-Allow-Origin', '*')
    enhancedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    enhancedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Stripe-Signature')
    
    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new NextResponse(null, { 
        status: 200, 
        headers: enhancedResponse.headers 
      })
    }
    
    return enhancedResponse
  }
  
  // For all other paths, add the tracking headers to the response
  response.headers.set('x-request-id', requestId)
  response.headers.set('x-processed-url', path)
  
  // SPECIAL HANDLING FOR PERMISSIONS-POLICY HEADER
  // Remove the 'browsing-topics' feature from the Permissions-Policy header
  response.headers.set('Permissions-Policy', '')
  
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
    // Match API routes for Stripe
    '/api/webhook/stripe/:path*',
    '/api/checkout/credits/:path*',
    // Match the manifest file
    '/favicon/site.webmanifest',
  ],
} 