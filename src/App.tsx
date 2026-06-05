/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, User, Shield, ShieldCheck, Github, Search, RefreshCw, AlertTriangle, Disc } from "lucide-react";
import { Post, UserSessionData } from "./types";
import AboutModal from "./components/AboutModal";
import AccountModal from "./components/AccountModal";
import UserProfileModal from "./components/UserProfileModal";
import CreatePostModal from "./components/CreatePostModal";
import PostCard from "./components/PostCard";
import { supabase } from "./lib/supabase";

export default function App() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // Search keyword state
  const [searchQuery, setSearchQuery] = useState("");

  // Authentications states
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);

  // Modals visibility states
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [repostOfPost, setRepostOfPost] = useState<Post | null>(null);

  const handleRepost = (post: Post) => {
    setRepostOfPost(post);
    setIsPostModalOpen(true);
  };

  // Admin moderation panel states (unlocked dynamically via URL query param)
  const [adminPassword, setAdminPassword] = useState<string>("");

  // Routing states
  const [activePostId, setActivePostId] = useState<string | null>(null);
  const [activePost, setActivePost] = useState<Post | null>(null);
  const [loadingActivePost, setLoadingActivePost] = useState(false);
  const [activePostError, setActivePostError] = useState<string | null>(null);

  // Fetch a single post directly from the database
  const fetchSinglePost = async (id: string) => {
    try {
      setLoadingActivePost(true);
      setActivePostError(null);
      
      const { data: post, error } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        throw error;
      }
      if (!post) {
        setActivePostError("Broadcast was not found or has been deleted.");
        return;
      }

      const comments = post.comments || [];
      comments.sort((a: any, b: any) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setActivePost({ ...post, comments });
    } catch (err: any) {
      console.error("Direct db single post fetch error:", err);
      setActivePostError("Connection error loading this broadcast detail.");
    } finally {
      setLoadingActivePost(false);
    }
  };

  const handleURLRouting = () => {
    const path = window.location.pathname;
    if (path.startsWith("/post/")) {
      const parts = path.split("/");
      const id = parts[2];
      if (id) {
        setActivePostId(id);
        const found = posts.find((p) => p.id === id);
        if (found) {
          setActivePost(found);
        } else {
          fetchSinglePost(id);
        }
        return;
      }
    }
    setActivePostId(null);
    setActivePost(null);
  };

  const navigateToPost = (postId: string) => {
    window.history.pushState(null, "", `/post/${postId}`);
    setActivePostId(postId);
    const found = posts.find((p) => p.id === postId);
    if (found) {
      setActivePost(found);
    } else {
      fetchSinglePost(postId);
    }
  };

  const navigateToFeed = () => {
    window.history.pushState(null, "", "/");
    setActivePostId(null);
    setActivePost(null);
  };

  // Fetch all posts directly from the database
  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);
      setPostsError(null);
      
      const { data, error } = await supabase
        .from("posts")
        .select("*, profiles!posts_user_id_fkey(*), comments(*, profiles!comments_user_id_fkey(*)), post_likes(*)")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      // Sort comments inside each post manually by created_at ascending
      const sortedData = (data || []).map((post: any) => {
        const comments = post.comments || [];
        comments.sort((a: any, b: any) => {
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        return {
          ...post,
          comments
        };
      });

      setPosts(sortedData);
    } catch (err: any) {
      console.error("Direct db posts fetch error:", err);
      setPostsError("Network error while trying to retrieve feed directly from the database.");
    } finally {
      setLoadingPosts(false);
    }
  };

  // Check and restore user session from localStorage, and check for moderator password in URL query on startup
  useEffect(() => {
    const checkSessionAndURL = async () => {
      // 1. Check for ?admin=RealMaveboAdminModeration67 or ?moderation=RealMaveboAdminModeration67
      const params = new URLSearchParams(window.location.search);
      const modParam = params.get("admin") || params.get("moderation");
      if (modParam === "RealMaveboAdminModeration67") {
        setAdminPassword("RealMaveboAdminModeration67");
        alert("Moderator mode unlocked via URL access!");
        // Clean url query parameters to keep address bar pristine
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // 2. Load auth sessions
      const token = localStorage.getItem("token");
      const storedUserId = localStorage.getItem("userId");
      if (!token && !storedUserId) {
        return;
      }
      try {
        let userProfile: any = null;
        
        // 1. First, attempt to retrieve via REST API
        try {
          const res = await fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${token || ""}`,
            },
          });
          if (res.ok) {
            const json = await res.json();
            if (json && json.success && json.user) {
              userProfile = json.user;
            }
          }
        } catch (apiErr) {
          console.warn("API me endpoint not found or unreachable, falling back to direct DB fetch", apiErr);
        }

        // 2. If REST API fails (e.g., static PWA on Vercel), fetch directly from the profiles table
        if (!userProfile && storedUserId) {
          const { data: profile, error: dbErr } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", storedUserId)
            .maybeSingle();
            
          if (profile && !dbErr) {
            userProfile = {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              bio: profile.bio,
              discord: profile.discord,
              avatar_url: profile.avatar_url,
              is_verified: profile.is_verified,
              created_at: profile.created_at
            };
          }
        }

        if (userProfile) {
          setCurrentUser(userProfile);
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
        }
      } catch (err) {
        console.error("Session restore failure", err);
      }
    };

    checkSessionAndURL().then(() => {
      fetchPosts();
    });
  }, []);

  // Synchronize routing details
  useEffect(() => {
    handleURLRouting();
    const onPopstate = () => {
      handleURLRouting();
    };
    window.addEventListener("popstate", onPopstate);
    return () => {
      window.removeEventListener("popstate", onPopstate);
    };
  }, [posts]);

  const handleAuthSuccess = (userData: UserSessionData, shouldClose: boolean = true) => {
    setCurrentUser(userData);
    if (shouldClose) {
      setIsAccountOpen(false);
    }
    fetchPosts();
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setCurrentUser(null);
    setIsAccountOpen(false);
    fetchPosts();
  };

  // Filter posts list dynamically by content and authors
  const filteredPosts = posts.filter((post) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;

    const contentMatches = post.content.toLowerCase().includes(query);
    const authorMatches = post.author_name.toLowerCase().includes(query);
    const profileMatches =
      post.profiles &&
      typeof post.profiles === "object" &&
      ((post.profiles as any).username.toLowerCase().includes(query) ||
        ((post.profiles as any).display_name && (post.profiles as any).display_name.toLowerCase().includes(query)));

    return contentMatches || authorMatches || profileMatches;
  });

  return (
    <div className="min-h-screen bg-[#08070b] text-slate-200 font-sans selection:bg-purple-600/50 selection:text-white flex flex-col animate-fade-in">
      {/* 1. NAVIGATION HEADER */}
      <header id="app-header" className="sticky top-0 bg-[#0c0a10]/95 backdrop-blur-md border-b border-purple-950/20 z-40 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          
          {/* Logo Title */}
          <button
            onClick={() => {
              setSearchQuery("");
              fetchPosts();
            }}
            className="flex items-center space-x-3 text-left cursor-pointer group"
          >
            <img
              src="https://startorigin2.vercel.app/icon.svg"
              alt="StartOrigin Logo"
              className="w-8 h-8 rounded-lg shadow-purple-500/10 shadow-lg group-hover:scale-105 transition-transform"
              onError={(e) => {
                // Return simple high fidelity fallback in case of transient networking hiccups
                e.currentTarget.style.display = 'none';
                const parent = e.currentTarget.parentElement;
                if (parent && !parent.querySelector(".fallback-logo")) {
                  const s = document.createElement("div");
                  s.className = "fallback-logo w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-extrabold text-xs shadow-lg";
                  s.innerText = "SO";
                  parent.prepend(s);
                }
              }}
            />
            <div>
              <h1 className="text-sm font-bold text-white font-display leading-none group-hover:text-purple-300 transition-colors">
                <span className="text-purple-500 font-bold">Start</span><span className="text-white font-semibold">Origin</span>
              </h1>
              <span className="text-[9px] text-slate-500 font-bold tracking-wider uppercase font-mono mt-0.5 block">
                Wall
              </span>
            </div>
          </button>

          {/* Controls Bar */}
          <div className="flex items-center space-x-2">
            {/* Create post toggle '+' button */}
            <button
              id="open-create-post-btn"
              onClick={() => setIsPostModalOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center font-extrabold text-lg cursor-pointer transition-all shadow-md shadow-purple-500/10 hover:-translate-y-0.5"
              title="Publish a post!"
            >
              +
            </button>

            {/* Info modal trigger "?" */}
            <button
              id="about-btn"
              onClick={() => setIsAboutOpen(true)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#121118]/80 border border-slate-900 flex items-center justify-center hover:bg-slate-800 transition-colors cursor-pointer text-slate-400 font-bold shrink-0 text-xs"
              title="About StartOrigin"
            >
              ?
            </button>

            {/* Account modal trigger */}
            {currentUser ? (
              <button
                id="profile-nav-btn"
                onClick={() => setIsAccountOpen(true)}
                className="flex items-center space-x-2 bg-[#121118]/80 border border-slate-900 text-slate-200 hover:bg-slate-850 duration-100 transition-all px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                <img
                  src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`}
                  alt="avatar"
                  referrerPolicy="no-referrer"
                  className="w-4 h-4 bg-purple-950 rounded-full shrink-0 object-cover"
                />
                <span className="max-w-[80px] truncate hidden sm:inline">@{currentUser.username}</span>
              </button>
            ) : (
              <button
                id="auth-nav-btn"
                onClick={() => setIsAccountOpen(true)}
                className="flex items-center space-x-1.5 bg-[#121118]/80 border border-slate-900 text-slate-200 hover:bg-slate-850 transition-all px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer shrink-0"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Account</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* 2. ADMIN PANEL MODERATION NOTIFICATION BANNER */}
      {adminPassword && (
        <div className="bg-red-950/20 border-y border-red-500/10 text-red-300 py-2.5 px-4 z-30 font-mono text-xs shrink-0 animate-slide-down">
          <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <span className="flex items-center font-bold">
              <ShieldCheck className="w-4 h-4 mr-1.5 text-red-450 animate-pulse" />
              <span>MODERATION ACTIVE: You have authority to purge values</span>
            </span>
            <button
              onClick={() => {
                setAdminPassword("");
                alert("Logged out of moderate privilege.");
              }}
              className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 px-3 py-1 rounded text-[9px] uppercase font-bold text-red-100 transition-all cursor-pointer"
            >
              Exit Mode
            </button>
          </div>
        </div>
      )}

      {/* 3. MAIN CONTENTS SECTION */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-8 space-y-6">

        {/* Minimalist Header Text ("Post.") */}
        <div className="text-center py-2 animate-fade-in shrink-0">
          <h2 className="text-4xl font-extrabold tracking-tight text-white font-display select-none">
            Post<span className="text-purple-500">.</span>
          </h2>
          <p className="text-[10px] text-slate-500 mt-1 uppercase font-mono tracking-widest">Minimalist Wall Broadcasts</p>
        </div>

        {/* Search and walls refresh bar */}
        <div className="flex items-center justify-between gap-3 bg-[#0c0a10]/50 border border-slate-900 p-3 rounded-2xl">
          {/* Integrated Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Search posts or handles..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl pl-9 pr-4 py-2.5 text-xs text-slate-200 placeholder-slate-650 focus:outline-none"
            />
            <Search className="absolute left-3 top-3 w-4 h-4 text-purple-500" />
            
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-3 text-[10px] uppercase font-bold text-purple-400 hover:text-purple-300"
              >
                Clear
              </button>
            )}
          </div>

          {/* Quick Refresh walls code constraint */}
          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={fetchPosts}
              disabled={loadingPosts}
              className="flex items-center justify-center border border-slate-900 bg-[#121118] hover:bg-slate-850 text-slate-300 hover:text-white p-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all disabled:opacity-50"
              title="Refresh Wall Feed"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingPosts ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 4. THE LIVE PUBLIC WALL FEED / SINGLE POST ROUTE RENDERING */}
        <div className="space-y-4">
          {activePostId ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-purple-950/25 pb-2">
                <button
                  onClick={navigateToFeed}
                  className="flex items-center space-x-2 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-purple-950/10 hover:bg-purple-950/20 px-3 py-1.5 rounded-lg border border-purple-500/10"
                >
                  <span>← Back to Wall Feed</span>
                </button>
                <span className="text-[10px] text-slate-500 font-mono tracking-wider font-extrabold uppercase">
                  Details View
                </span>
              </div>

              {loadingActivePost ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-xs font-mono">RETRIEVING BROADCAST...</p>
                </div>
              ) : activePostError ? (
                <div className="bg-red-950/20 border border-red-900/15 text-red-405 px-5 py-6 rounded-2xl text-center space-y-3">
                  <p className="text-xs font-medium text-red-500">{activePostError}</p>
                  <button
                    onClick={navigateToFeed}
                    className="bg-[#1c0a0d] border border-red-900/20 hover:bg-[#2c1014] text-red-300 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all mx-auto block cursor-pointer"
                  >
                    Return to feed
                  </button>
                </div>
              ) : activePost ? (
                <div className="space-y-4">
                  <PostCard
                    key={activePost.id}
                    post={activePost}
                    currentUser={currentUser}
                    onPostUpdated={() => {
                      fetchPosts();
                      fetchSinglePost(activePost.id);
                    }}
                    onPostDeleted={navigateToFeed}
                    onOpenUserProfile={(name) => setSelectedUsername(name)}
                    adminPassword={adminPassword}
                    onRepost={handleRepost}
                    onClickPost={navigateToPost}
                  />
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-purple-950/25 pb-2">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-purple-400 font-display">
                  Feed
                </span>
                <span className="text-[9px] text-slate-500 font-mono">
                  Count: {filteredPosts.length}
                </span>
              </div>

              {loadingPosts && posts.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center space-y-4">
                  <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-slate-500 text-xs font-mono">GATHERING BROADCASTS...</p>
                </div>
              ) : postsError ? (
                <div className="bg-red-950/20 border border-red-900/15 text-red-405 px-5 py-6 rounded-2xl text-center space-y-3">
                  <p className="text-xs font-medium text-red-500">{postsError}</p>
                  <button
                    onClick={fetchPosts}
                    className="bg-[#1c0a0d] border border-red-900/20 hover:bg-[#2c1014] text-red-300 px-4 py-2 rounded-xl text-xs font-semibold transition-all mx-auto block"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredPosts.length === 0 ? (
                <div className="bg-slate-950/10 border border-slate-900 rounded-2xl py-16 px-4 text-center space-y-2">
                  <h3 className="text-slate-400 font-semibold text-xs uppercase font-mono tracking-wider">Feed is empty</h3>
                  <p className="text-slate-500 text-[10px] max-w-sm mx-auto leading-relaxed font-mono">
                    {searchQuery
                      ? "No broadcasts matched your query filters."
                      : "No broadcasts published yet. Be the first to post!"}
                  </p>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {filteredPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      currentUser={currentUser}
                      onPostUpdated={fetchPosts}
                      onOpenUserProfile={(name) => setSelectedUsername(name)}
                      onClickPost={navigateToPost}
                      adminPassword={adminPassword}
                      onRepost={handleRepost}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

      </main>

      {/* 5. MINIMALIST FOOTER */}
      <footer className="border-t border-purple-950/20 py-6 px-4 mt-12 shrink-0 bg-[#07060a]">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between text-[10px] text-slate-505 font-mono gap-3">
          <div>
            <p className="font-bold text-purple-400">StartOrigin © 2026</p>
          </div>
        </div>
      </footer>

      {/* About Modal ("?") */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Account / Configuration / Login / Register Modal */}
      <AccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={handleAuthSuccess}
        onLogout={handleLogout}
        onPostDeleted={fetchPosts}
        onPostCreated={fetchPosts}
      />

      {/* Create / Compose Post Modal overlay */}
      <CreatePostModal
        isOpen={isPostModalOpen}
        onClose={() => {
          setIsPostModalOpen(false);
          setRepostOfPost(null);
        }}
        currentUser={currentUser}
        onPostCreated={fetchPosts}
        repostOfPost={repostOfPost}
        onClearRepost={() => setRepostOfPost(null)}
      />

      {/* User public detailed profile viewing modal */}
      <UserProfileModal
        username={selectedUsername}
        isOpen={!!selectedUsername}
        onClose={() => setSelectedUsername(null)}
        onOpenUserProfile={setSelectedUsername}
        onClickPost={navigateToPost}
        currentUser={currentUser}
        adminPassword={adminPassword}
        onPostDeleted={fetchPosts}
      />

    </div>
  );
}
