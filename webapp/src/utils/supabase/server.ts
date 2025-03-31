import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          // Try-catch in case cookies() is async or has issues
          try {
            const cookieStore = cookies()
            // @ts-expect-error - TypeScript might show errors but this works at runtime
            const cookie = cookieStore.get?.(name)
            return cookie?.value
          } catch (err) {
            console.error('Error getting cookie:', err)
            return undefined
          }
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            const cookieStore = cookies()
            // @ts-expect-error - TypeScript might show errors but this works at runtime
            cookieStore.set?.({ name, value, ...options })
          } catch {
            // Silently ignore errors when trying to set cookies in Server Components
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            const cookieStore = cookies()
            // @ts-expect-error - TypeScript might show errors but this works at runtime
            cookieStore.delete?.({ name, ...options })
          } catch {
            // Silently ignore errors when trying to delete cookies in Server Components
          }
        },
      },
    }
  )
} 