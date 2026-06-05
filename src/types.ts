/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null; // Stores JSON text for bio, discord, email, etc.
  is_verified: boolean;
  created_at: string;
}

export interface PostLike {
  id: string;
  post_id: string;
  user_id: string | null;
  liker_id: string;
  created_at: string;
}

export interface Post {
  id: string;
  content: string;
  author_name: string;
  created_at: string;
  user_id: string | null;
  profiles?: Profile | null; // Rich join from Supabase
  comments?: Comment[];
  post_likes?: PostLike[];
}

export interface Comment {
  id: string;
  post_id: string;
  content: string;
  author_name: string;
  created_at: string;
  user_id: string | null;
  profiles?: Profile | null; // Rich join from Supabase
}

export interface UserSessionData {
  id: string;
  email: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  discord: string;
  email_verified?: boolean;
}
