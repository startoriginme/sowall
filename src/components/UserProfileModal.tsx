/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, User, Disc, MessageSquare, Calendar, Copy, Check, Users, BadgeCheck } from "lucide-react";
import { Post, Profile, UserSessionData } from "../types";
import { formatRelativeTime, copyToClipboard } from "../utils";
import PostCard from "./PostCard";
import { supabase } from "../lib/supabase";

interface UserProfileModalProps {
  username: string | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenUserProfile: (username: string) => void;
  onClickPost?: (id: string) => void;
  currentUser: UserSessionData | null;
  adminPassword?: string;
  onPostDeleted?: () => void;
}

export default function UserProfileModal({
  username,
  isOpen,
  onClose,
  onOpenUserProfile,
  onClickPost,
  currentUser,
  adminPassword,
  onPostDeleted
}: UserProfileModalProps) {
  const [loading, setLoading] = useState(true);
  const [errorProfile, setErrorProfile] = useState<string | null>(null);
  const [profileData, setProfileData] = useState<{
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string;
    discord: string;
    is_verified: boolean;
    created_at: string;
    posts_count: number;
    posts: Post[];
  } | null>(null);

  const [copied, setCopied] = useState(false);

  const fetchProfile = async () => {
    if (!username) return;
    try {
      setLoading(true);
      setErrorProfile(null);

      // 1. Get profile by username
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .maybeSingle();

      if (profileError) throw profileError;
      
      if (!profile) {
        setErrorProfile("User not found.");
        setLoading(false);
        return;
      }

      // 2. Get user's posts
      const { data: posts, error: postsError } = await supabase
        .from("posts")
        .select(`
          *,
          profiles!posts_user_id_fkey (*),
          comments:comments (
            *,
            profiles:profiles!comments_user_id_fkey (*)
          ),
          post_likes (*)
        `)
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;

      // Sort comments inside each post
      const sortedPosts = (posts || []).map((post: any) => {
        const comments = post.comments || [];
        comments.sort((a: any, b: any) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        return {
          ...post,
          comments
        };
      });

      // 3. Clean up bio if it's JSON
      let cleanBio = profile.bio || "";
      if (cleanBio.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(cleanBio);
          cleanBio = parsed.text || "";
        } catch (e) {
          // keep as is
        }
      }

      setProfileData({
        id: profile.id,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        bio: cleanBio,
        discord: profile.discord || "",
        is_verified: profile.is_verified || false,
        created_at: profile.created_at,
        posts_count: sortedPosts.length,
        posts: sortedPosts,
      });
      
    } catch (err: any) {
      console.error("Error fetching profile:", err);
      setErrorProfile(err.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && username) {
      fetchProfile();
    }
  }, [username, isOpen]);

  const handleCopyDiscord = async () => {
    if (!profileData || !profileData.discord) return;
    const isCopied = await copyToClipboard(profileData.discord);
    if (isCopied) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);
      
      if (error) throw error;
      
      // Update local state
      if (profileData) {
        setProfileData({
          ...profileData,
          posts: profileData.posts.filter(p => p.id !== postId),
          posts_count: Math.max(0, profileData.posts_count - 1)
        });
      }
      if (onPostDeleted) onPostDeleted();
    } catch (err) {
      console.error("Error deleting post:", err);
      alert("Error deleting post.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && username && (
        <div id="user-profile-backdrop" className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            id="user-profile-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-[#0b0b0f] border border-slate-800 rounded-2xl w-full max-w-2xl h-[85vh] flex flex-col relative overflow-hidden text-slate-100"
          >
            {/* Background glowing orb */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header / Title bar */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-4 mb-2 shrink-0">
              <span className="text-sm font-semibold tracking-wider uppercase text-purple-400 font-display">User Profile</span>
              <button
                id="close-profile-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Content Outer Container */}
            <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-6">
              {loading ? (
                <div className="h-48 flex flex-col items-center justify-center space-y-3">
                  <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-xs text-center">Loading @{username}'s profile...</p>
                </div>
              ) : errorProfile ? (
                <div className="h-48 flex items-center justify-center">
                  <div className="bg-red-950/20 text-red-400 border border-red-900/30 rounded-xl px-5 py-4 max-w-md text-sm text-center">
                    {errorProfile}
                  </div>
                </div>
              ) : profileData && (
                <>
                  {/* Hero Information */}
                  <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-5 py-3 border-b border-slate-800/85">
                    <img
                      src={profileData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`}
                      alt={profileData.display_name || username}
                      referrerPolicy="no-referrer"
                      className="w-20 h-20 rounded-2xl bg-slate-950 border-2 border-purple-500/40 p-1 object-cover shrink-0"
                    />
                     <div className="flex-1 text-center sm:text-left space-y-1">
                      <div className="flex items-center justify-center sm:justify-start space-x-1.5 flex-wrap">
                        <h2 className="text-2xl font-bold font-display text-white">
                          {profileData.display_name || username}
                        </h2>
                        {(profileData.is_verified ||
                          profileData.username.toLowerCase() === "mavebo" ||
                          profileData.username.toLowerCase() === "kode" ||
                          profileData.username.toLowerCase() === "kodewt"
                        ) && (
                          <BadgeCheck className="w-5 h-5 text-purple-400 shrink-0 fill-purple-950 inline-block" />
                        )}
                      </div>
                      <p className="text-slate-400 text-sm">@{profileData.username}</p>

                      <div className="flex items-center justify-center sm:justify-start space-x-2 text-xs text-slate-500 mt-2">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Contributor since {new Date(profileData.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bio & Contact Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Bio text (spans 2 columns) */}
                    <div className="md:col-span-2 bg-[#161620] border border-slate-800/80 p-4 rounded-xl space-y-2">
                      <h3 className="text-xs font-semibold uppercase text-purple-400 tracking-wider">About Me</h3>
                      <p className="text-slate-200 text-sm whitespace-pre-wrap leading-relaxed">
                        {profileData.bio && profileData.bio.trim() !== "" ? profileData.bio : "This user has not set a bio yet."}
                      </p>
                    </div>

                    {/* Stats & Discord (spans 1 column) */}
                    <div className="bg-[#161620] border border-slate-800/80 p-4 rounded-xl flex flex-col justify-between space-y-4">
                      <div>
                        <h3 className="text-xs font-semibold uppercase text-purple-400 tracking-wider mb-2">Stats</h3>
                        <div className="flex items-center space-x-3 bg-slate-900/40 p-2.5 rounded-lg border border-slate-850">
                          <MessageSquare className="w-4 h-4 text-purple-400" />
                          <div>
                            <p className="text-xl font-bold text-white leading-none">{profileData.posts_count}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Posts Shared</p>
                          </div>
                        </div>
                      </div>

                      {/* Discord details */}
                      {profileData.discord ? (
                        <div className="space-y-1.5">
                          <span className="text-[10px] font-semibold uppercase text-purple-400 tracking-wider">Discord Contact</span>
                          <button
                            onClick={handleCopyDiscord}
                            className="w-full flex items-center justify-between bg-purple-900/20 hover:bg-purple-900/30 text-purple-300 hover:text-white transition-all px-3 py-2 rounded-lg border border-purple-500/20 group relative cursor-pointer"
                            title="Copy Discord username"
                          >
                            <div className="flex items-center space-x-2 truncate">
                              <span className="bg-[#5865F2] p-1 rounded">
                                <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 127.14 96.36" fill="currentColor">
                                  <path d="M107.7,8.07A105.15,105.15,0,0,0,77.26,0a77.2,77.2,0,0,0-3.3,6.83A96.67,96.67,0,0,0,53.22,6.83,77.2,77.2,0,0,0,49.88,0,105.15,105.15,0,0,0,19.44,8.07C3.66,31.58-1.86,54.65,1,77.53A105.73,105.73,0,0,0,32,96.36a77.7,77.7,0,0,0,6.63-10.85,68.43,68.43,0,0,1-10.43-5c.87-.64,1.71-1.34,2.51-2a75.4,75.4,0,0,0,72.76,0c.8,3.53,1.64,1.41,2.51,2a68.12,68.12,0,0,1-10.43,5,76.5,76.5,0,0,0,6.63,10.85,105.73,105.73,0,0,0,31.57-18.83C129.54,48,123.51,25.2,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53S36.18,40.36,42.45,40.36,53.83,46,53.83,53,48.72,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.24,60,73.24,53S78.41,40.36,84.69,40.36,96.07,46,96.07,53,91,65.69,84.69,65.69Z" />
                                </svg>
                              </span>
                              <span className="text-xs font-mono font-medium truncate">{profileData.discord}</span>
                            </div>
                            {copied ? (
                              <Check className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-purple-400 group-hover:text-purple-200 transition-colors shrink-0" />
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-2 text-xs text-slate-500">
                          Discord tag not provided
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Publications Wall section */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center space-x-2 border-b border-slate-800 pb-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      <h3 className="font-semibold text-white font-display">
                        Posts by @{profileData.username} ({profileData.posts.length})
                      </h3>
                    </div>

                    {profileData.posts.length === 0 ? (
                      <div className="bg-[#161620]/40 border border-slate-800 rounded-xl py-8 text-center text-xs text-slate-500">
                        This user hasn't published anything under their profile name yet.
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {profileData.posts.map((post) => (
                          <PostCard
                            key={post.id}
                            post={post}
                            currentUser={currentUser}
                            onPostUpdated={fetchProfile}
                            onOpenUserProfile={(name) => {
                              if (name !== profileData.username) {
                                onOpenUserProfile(name);
                              }
                            }}
                            onClickPost={(id) => {
                              onClose();
                              if (onClickPost) onClickPost(id);
                            }}
                            adminPassword={adminPassword}
                            onRepost={undefined}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}