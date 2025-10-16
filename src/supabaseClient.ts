// Fix for line 1: Cannot find type definition file for 'vite/client'.
// The reference is removed as the type definition file is not available in the project's context.
import { createClient } from '@supabase/supabase-js';

// Fix for line 5: Property 'env' does not exist on type 'ImportMeta'.
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
// Fix for line 6: Property 'env' does not exist on type 'ImportMeta'.
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);