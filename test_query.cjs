const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://ounuwaqnmtunmrzhetut.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im91bnV3YXFubXR1bm1yemhldHV0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4NTQ3NDksImV4cCI6MjA5NDQzMDc0OX0.w-dP9ka-JvxsAEoZh3jI0viQCKckakzhc-rlbLMJ9FA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Testing fetch posts query...");
  try {
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles:profiles!posts_user_id_fkey (*),
        comments:comments (
          *,
          profiles:profiles!comments_user_id_fkey (*)
        ),
        post_likes (*)
      `)
      .order("created_at", { ascending: false })
      .range(0, 9);
      
    if (error) {
      console.log("POSTS_ERROR:", error.message, error);
    } else {
      console.log("POSTS_SUCCESS:", data?.length);
    }
  } catch(e) {
    console.log("POSTS_THROW:", e.message);
  }
}

run();
