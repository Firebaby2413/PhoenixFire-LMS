// src/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

console.log('ENV CHECK:', import.meta.env);

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.error("Missing Supabase environment variables! Check your .env file in the project root.");
}

export const supabase = createClient(supabaseUrl || '', supabasePublishableKey || '');