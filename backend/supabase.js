const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dyuimjageamopkodfplk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ww5ZWKvl_uH-fzQKylCGeA_TlRDI52V';

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = {
  supabase,
  supabaseUrl,
  supabaseKey
};
