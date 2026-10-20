import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dyuimjageamopkodfplk.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V';

export const createSupabaseClient = () => createClient(supabaseUrl, supabaseKey);
export const supabase = createClient(supabaseUrl, supabaseKey);
