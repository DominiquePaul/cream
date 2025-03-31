import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          try {
            // Cookies must be awaited in Next.js 15
            const cookieStore = await cookies()
            return cookieStore.get(name)?.value
          } catch (err) {
            console.error('Error getting cookie:', err)
            return undefined
          }
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            // Cookies must be awaited in Next.js 15
            const cookieStore = await cookies()
            cookieStore.set({ name, value, ...options })
          } catch {
            // Silently ignore errors when trying to set cookies in Server Components
            // console.error('Error setting cookie')
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            // Cookies must be awaited in Next.js 15
            const cookieStore = await cookies()
            cookieStore.delete({ name, ...options })
          } catch {
            // Silently ignore errors when trying to delete cookies in Server Components
            // console.error('Error deleting cookie')
          }
        },
      },
    }
  )
} 