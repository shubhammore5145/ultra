import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://dyuimjageamopkodfplk.supabase.co';
const FALLBACK_KEY = 'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || FALLBACK_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
