import { createClient } from "@supabase/supabase-js";

// Vite client-side environment variables loaded in the browser
const supabaseUrl = 
  (import.meta as any).env.VITE_SUPABASE_URL || 
  "https://ounuwaqnmtunmrzhetut.supabase.co";

// Use VITE_SUPABASE_ANON_KEY as the public API key for direct client-side DB communication
const supabaseAnonKey = 
  (import.meta as any).env.VITE_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91bnV3YXFubXR1bm1yemhldHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTQ3NDksImV4cCI6MjA5NDQzMDc0OX0.w-dP9ka-JvxsAEoZh3jI0viQCKckakzhc-rlbLMJ9FA";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
