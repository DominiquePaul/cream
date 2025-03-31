import { createClient as createClientBase } from '@/utils/supabase/client';

// Re-export the client for backwards compatibility
// This way, existing imports will still work but use the new client under the hood
export const supabase = createClientBase();

// Also re-export the function for flexibility
export const createClient = createClientBase; 