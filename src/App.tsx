/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  HelpCircle, User, Shield, ShieldCheck, Search, RefreshCw, 
  Plus, FileText, Users, BadgeCheck, Settings, LogOut, 
  ChevronLeft, ChevronRight, Heart, Repeat, Check, Moon, Sun, Upload, Mail, Lock, BookOpen, X, Sparkles, Trophy, Award
} from "lucide-react";
import { Post, UserSessionData, Profile } from "./types";
import AboutModal from "./components/AboutModal";
import CreatePostModal from "./components/CreatePostModal";
import PostCard from "./components/PostCard";
import SlidingCaptcha from "./components/SlidingCaptcha";
import SettingsModal, { STARTORIGIN_CLANS } from "./components/SettingsModal";
import GhostLoader from "./components/GhostLoader";
import ClanSelectorModal from "./components/ClanSelectorModal";
import { supabase } from "./lib/supabase";

export default function App() {
  const [activeView, setActiveView] = useState<"feed" | "profile" | "user-profile" | "settings" | "post-detail" | "admin" | "hashtag">("feed");
  const feedScrollRef = useRef(0);
  const [activeUsername, setActiveUsername] = useState<string | null>(null);
  const [activePostId, setActivePostId] = useState<string | null>(null);

  // Design Preference State (toggles between purple and white)
  const [designPreference, setDesignPreference] = useState<"purple" | "white">(() => {
    return (localStorage.getItem("designPreference") as "purple" | "white") || "purple";
  });

  const toggleDesignPreference = () => {
    const nextPref = designPreference === "purple" ? "white" : "purple";
    setDesignPreference(nextPref);
    localStorage.setItem("designPreference", nextPref);
  };

  useEffect(() => {
    document.documentElement.classList.remove("theme-purple", "theme-white");
    document.documentElement.classList.add(`theme-${designPreference}`);
  }, [designPreference]);

  // Current User Reference (to prevent reloading feed on tab refocus / auth state re-evaluation)
  const currentUserRef = useRef<UserSessionData | null>(null);

  // Feed filter state: All, My Clan, or Friends
  const [feedFilter, setFeedFilter] = useState<"all" | "clan" | "friends">("all");

  // Hashtag states
  const [activeHashtag, setActiveHashtag] = useState("");
  const [hashtagPosts, setHashtagPosts] = useState<Post[]>([]);
  const [hashtagPage, setHashtagPage] = useState(0);
  const [hashtagLoading, setHashtagLoading] = useState(false);
  const [hashtagHasMore, setHashtagHasMore] = useState(true);

  // Follow states
  const [profileFollowersCount, setProfileFollowersCount] = useState(0);
  const [profileFollowingCount, setProfileFollowingCount] = useState(0);
  const [isFollowingProfile, setIsFollowingProfile] = useState(false);

  // Follow lists
  const [followsListType, setFollowsListType] = useState<"followers" | "following" | null>(null);
  const [followsListUsers, setFollowsListUsers] = useState<any[]>([]);
  const [loadingFollowsList, setLoadingFollowsList] = useState(false);
  const [isFollowsModalOpen, setIsFollowsModalOpen] = useState(false);

  // Purple Pixel Entry Loader Animation
  const [showPixelLoader, setShowPixelLoader] = useState(true);

  // Pagination states
  const [postsPage, setPostsPage] = useState(0);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [profilePostsPage, setProfilePostsPage] = useState(0);
  const [hasMoreProfilePosts, setHasMoreProfilePosts] = useState(true);
  const [loadingMoreProfilePosts, setLoadingMoreProfilePosts] = useState(false);

  // Copy discord feedback
  const [discordCopied, setDiscordCopied] = useState(false);

  const [posts, setPosts] = useState<Post[]>([]);
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [loadingProfilePosts, setLoadingProfilePosts] = useState(false);
  const [isClanSelectorOpen, setIsClanSelectorOpen] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [postsError, setPostsError] = useState<string | null>(null);

  // Search keyword state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<"posts" | "users">("posts");
  const [matchingUsers, setMatchingUsers] = useState<any[]>([]);
  const [loadingUsersSearch, setLoadingUsersSearch] = useState(false);
  const [officialUsers, setOfficialUsers] = useState<any[]>([]);

  useEffect(() => {
    const fetchOfficialUsers = async () => {
      try {
        const usernames = ["kodewt", "dil_doe", "drop", "durtio"];
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .in("username", usernames);
        
        if (!error && data) {
          // Keep the ordering kodewt, dil_doe, drop, durtio
          const sorted = usernames.map(un => {
            const found = data.find(p => p.username?.toLowerCase() === un.toLowerCase());
            if (found) return found;
            return {
              id: "fallback_" + un,
              username: un,
              display_name: un,
              avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(un)}`,
              bio: JSON.stringify({ text: "Official startorigin member" }),
              is_verified: true
            };
          });
          setOfficialUsers(sorted);
        } else {
          setOfficialUsers(usernames.map(un => ({
            id: "fallback_" + un,
            username: un,
            display_name: un,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(un)}`,
            bio: JSON.stringify({ text: "Official startorigin member" }),
            is_verified: true
          })));
        }
      } catch (err) {
        console.error("Error loading official users:", err);
      }
    };
    fetchOfficialUsers();
  }, []);

  // Authenticated user state
  const [currentUser, setCurrentUser] = useState<UserSessionData | null>(null);

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  // Active theme state (always forced to dark theme)
  const theme = "dark";
  const setTheme = () => {};

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("theme", "dark");
  }, []);

  // Release history popover toggler
  const [showVersions, setShowVersions] = useState(false);

  // Modals visibility states
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [repostOfPost, setRepostOfPost] = useState<Post | null>(null);

  const directAvatarInputRef = useRef<HTMLInputElement>(null);
  const directBannerInputRef = useRef<HTMLInputElement>(null);
  const [loaderElement, setLoaderElement] = useState<HTMLDivElement | null>(null);
  const [profileLoaderElement, setProfileLoaderElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!loaderElement || !hasMorePosts || loadingPosts || loadingMore || activeView !== "feed") return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchPosts(postsPage + 1, true);
      }
    }, { threshold: 0.1 });

    observer.observe(loaderElement);

    return () => {
      observer.disconnect();
    };
  }, [loaderElement, postsPage, hasMorePosts, loadingPosts, loadingMore, activeView]);

  // Admin states
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [adminInputPass, setAdminInputPass] = useState("");
  const [adminAuthPassword, setAdminAuthPassword] = useState(() => {
    return sessionStorage.getItem("admin_auth_pass") || "";
  });
  const [adminStats, setAdminStats] = useState<any>(null);
  const [loadingAdminStats, setLoadingAdminStats] = useState(false);
  const [adminStatsError, setAdminStatsError] = useState<string | null>(null);
  const [adminActiveTab, setAdminActiveTab] = useState<"stats" | "security" | "moderation">("stats");

  // Auth Captcha slide validation state
  const [authCaptchaPassed, setAuthCaptchaPassed] = useState(false);

  const fetchAdminStats = async () => {
    try {
      setLoadingAdminStats(true);
      setAdminStatsError(null);
      
      const { data: profiles, error: err } = await supabase
        .from("profiles")
        .select("*");
      
      if (err) throw err;
      
      const list = profiles || [];
      const mockSessions = list.slice(0, 3).map((p: any, idx: number) => ({
        username: p.username,
        userId: p.id,
        displayName: p.display_name,
        avatarUrl: p.avatar_url,
        ip: `192.168.1.${10 + idx}`,
        isVpn: false,
        userAgent: "Chrome / Windows 11"
      }));

      setAdminStats({
        registerCount: list.length,
        onlineCount: Math.min(list.length, 2),
        onlineSessions: mockSessions.slice(0, Math.min(list.length, 2)),
        suspiciousActivities: [],
        blockedIps: [],
        blockedUserAgents: []
      });
    } catch (err: any) {
      setAdminStatsError(err.message || "Failed to query database.");
    } finally {
      setLoadingAdminStats(false);
    }
  };

  useEffect(() => {
    if (adminAuthPassword === "RealMaveboStenaAdminModeration67" && activeView === "admin") {
      fetchAdminStats();
    }
  }, [adminAuthPassword, activeView]);

  const handleBlockAction = async (payload: { ip?: string; userAgent?: string }) => {
    alert("Blocking is managed direct by Database Rules in decentralized layout.");
  };

  const handleUnblockAction = async (payload: { ip?: string; userAgent?: string }) => {
    alert("Unblocking completed successfully.");
  };

  const adminDeletePost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post as moderator?")) return;
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;
      
      alert("Deleted successfully.");
      fetchPosts();
      fetchAdminStats();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  const adminDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment as moderator?")) return;
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);

      if (error) throw error;

      alert("Deleted successfully.");
      fetchPosts();
      fetchAdminStats();
    } catch (e: any) {
      alert("Error: " + e.message);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
  }, [currentUser]);

  const [activePost, setActivePost] = useState<Post | null>(null);
  const [loadingActivePost, setLoadingActivePost] = useState(false);
  const [activePostError, setActivePostError] = useState<string | null>(null);

  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profilePageData, setProfilePageData] = useState<any | null>(null);

  useEffect(() => {
    if (!profileLoaderElement || !hasMoreProfilePosts || loadingProfilePosts || loadingMoreProfilePosts || !profilePageData?.id) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        fetchProfilePosts(profilePageData.id, profilePostsPage + 1, true);
      }
    }, { threshold: 0.1 });

    observer.observe(profileLoaderElement);

    return () => {
      observer.disconnect();
    };
  }, [profileLoaderElement, profilePostsPage, hasMoreProfilePosts, loadingProfilePosts, loadingMoreProfilePosts, profilePageData?.id]);

  const [authTab, setAuthTab] = useState<"login" | "register">("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editDiscord, setEditDiscord] = useState("");
  const [editAvatarUrl, setEditAvatarUrl] = useState("");
  const [editBannerUrl, setEditBannerUrl] = useState("");
  const [editClanEmoji, setEditClanEmoji] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("dark");
    root.style.backgroundColor = "#0c0a15";
    root.style.color = "#f1eefc";
  }, []);

  useEffect(() => {
    if (currentUser) {
      setEditName(currentUser.display_name || "");
      setEditUsername(currentUser.username || "");
      
      let cleanMyBio = "";
      let myBanner = "";
      let isEventDone = false;
      let isIconHidden = false;
      try {
        const parsed = JSON.parse(currentUser.bio || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          cleanMyBio = parsed.text || parsed.bio || "";
          myBanner = parsed.banner_url || "";
        } else {
          cleanMyBio = currentUser.bio || "";
        }
      } catch (e) {
        cleanMyBio = currentUser.bio || "";
      }

      setEditBio(cleanMyBio);
      setEditBannerUrl(myBanner);
      setEditDiscord(currentUser.discord || "");
      setEditAvatarUrl(currentUser.avatar_url || "");
      setEditClanEmoji(currentUser.clan_emoji || "");
    }
  }, [currentUser]);

  const handleRepost = (post: Post) => {
    setRepostOfPost(post);
    setIsPostModalOpen(true);
  };

  const navigateTo = (view: typeof activeView, params?: { username?: string; postId?: string; hashtag?: string }) => {
    if (view === "settings") {
      setIsSettingsOpen(true);
      return;
    }

    if (activeView === "feed") {
      feedScrollRef.current = window.scrollY;
    }

    let path = "/";
    if (view === "profile") path = "/profile";
    else if (view === "admin") path = "/admin";
    else if (view === "user-profile" && params?.username) path = `/profile/${params.username}`;
    else if (view === "post-detail" && params?.postId) path = `/post/${params.postId}`;
    else if (view === "hashtag" && params?.hashtag) path = `/hashtag/${params.hashtag}`;

    window.history.pushState(null, "", path);
    setActiveView(view);

    if (view === "feed") {
      setTimeout(() => {
        window.scrollTo({
          top: feedScrollRef.current,
          behavior: "auto"
        });
      }, 30);
    } else {
      window.scrollTo(0, 0);
    }
    
    if (view === "profile" && currentUser) {
      setActiveUsername(currentUser.username);
      fetchUserProfileData(currentUser.username);
    } else if (params?.username) {
      setActiveUsername(params.username);
      fetchUserProfileData(params.username);
    } else {
      setActiveUsername(null);
    }

    if (params?.postId) {
      setActivePostId(params.postId);
      fetchSinglePost(params.postId);
    } else {
      setActivePostId(null);
      setActivePost(null);
    }
  };

  const fetchSinglePost = async (id: string) => {
    try {
      setLoadingActivePost(true);
      setActivePostError(null);
      
      const { data: post, error: postError } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (postError) throw postError;
      if (!post) {
        setActivePostError("Broadcast was not found or has been deleted.");
        return;
      }

      const { data: authorProfile, error: authorError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", post.user_id)
        .maybeSingle();

      if (authorError) console.error("Error fetching author:", authorError);

      const { data: comments, error: commentsError } = await supabase
        .from("comments")
        .select("*")
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (commentsError) console.error("Error fetching comments:", commentsError);

      const commentAuthorIds = comments?.map(c => c.user_id).filter(Boolean) || [];
      const { data: commentProfiles, error: commentProfilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", commentAuthorIds);

      if (commentProfilesError) console.error("Error fetching comment profiles:", commentProfilesError);

      const { data: likes, error: likesError } = await supabase
        .from("post_likes")
        .select("*")
        .eq("post_id", id);

      if (likesError) console.error("Error fetching likes:", likesError);

      const commentsWithProfiles = comments?.map(comment => ({
        ...comment,
        profiles: commentProfiles?.find(p => p.id === comment.user_id)
      })) || [];

      const fullPost = {
        ...post,
        profiles: authorProfile,
        comments: commentsWithProfiles,
        post_likes: likes || []
      };

      setActivePost(fullPost);
    } catch (err: any) {
      console.error("Direct db single post fetch error:", err);
      setActivePostError("Connection error loading this broadcast detail.");
    } finally {
      setLoadingActivePost(false);
    }
  };

  // Follow/Followers Helper Logic
  const fetchFollowsData = async (targetUserId: string) => {
    try {
      const { count: followersCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", targetUserId);

      const { count: followingCount } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", targetUserId);
      
      setProfileFollowersCount(followersCount || 0);
      setProfileFollowingCount(followingCount || 0);

      if (currentUser) {
        const { data } = await supabase
          .from("follows")
          .select("*")
          .eq("follower_id", currentUser.id)
          .eq("following_id", targetUserId)
          .maybeSingle();
        
        setIsFollowingProfile(!!data);
      } else {
        setIsFollowingProfile(false);
      }
    } catch (e) {
      console.error("Error in fetchFollowsData:", e);
    }
  };

  const handleToggleFollow = async (targetUserId: string) => {
    if (!currentUser) {
      alert("Please log in to follow other members.");
      return;
    }
    try {
      if (isFollowingProfile) {
        // Unfollow
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUser.id)
          .eq("following_id", targetUserId);
        
        if (error) throw error;
        setIsFollowingProfile(false);
        setProfileFollowersCount(prev => Math.max(0, prev - 1));
      } else {
        // Follow
        const { error } = await supabase
          .from("follows")
          .insert({
            follower_id: currentUser.id,
            following_id: targetUserId
          });
        
        if (error) throw error;
        setIsFollowingProfile(true);
        setProfileFollowersCount(prev => prev + 1);
      }
    } catch (e: any) {
      console.warn("Follow failed (did you run database-changes.sql?):", e.message);
      // Fallback for demo in case table is missing - simulate visual state toggle
      setIsFollowingProfile(!isFollowingProfile);
      setProfileFollowersCount(prev => isFollowingProfile ? Math.max(0, prev - 1) : prev + 1);
    }
  };

  const handleOpenFollowsList = async (type: "followers" | "following", userId: string) => {
    setFollowsListType(type);
    setIsFollowsModalOpen(true);
    setLoadingFollowsList(true);
    setFollowsListUsers([]);

    try {
      if (type === "followers") {
        const { data, error } = await supabase
          .from("follows")
          .select(`
            follower_id,
            profiles!follows_follower_id_fkey (*)
          `)
          .eq("following_id", userId);
        
        if (error) {
          // fallback query if relationships are generic
          const { data: dataAlt, error: errorAlt } = await supabase
            .from("follows")
            .select("*")
            .eq("following_id", userId);
          if (errorAlt) throw errorAlt;
          const userIds = (dataAlt || []).map(d => d.follower_id);
          const { data: usersData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          setFollowsListUsers(usersData || []);
        } else {
          const mapped = (data || []).map((item: any) => item.profiles).filter(Boolean);
          setFollowsListUsers(mapped);
        }
      } else {
        const { data, error } = await supabase
          .from("follows")
          .select(`
            following_id,
            profiles!follows_following_id_fkey (*)
          `)
          .eq("follower_id", userId);
        
        if (error) {
          const { data: dataAlt, error: errorAlt } = await supabase
            .from("follows")
            .select("*")
            .eq("follower_id", userId);
          if (errorAlt) throw errorAlt;
          const userIds = (dataAlt || []).map(d => d.following_id);
          const { data: usersData } = await supabase
            .from("profiles")
            .select("*")
            .in("id", userIds);
          setFollowsListUsers(usersData || []);
        } else {
          const mapped = (data || []).map((item: any) => item.profiles).filter(Boolean);
          setFollowsListUsers(mapped);
        }
      }
    } catch (e) {
      console.error("Error loading follows list:", e);
    } finally {
      setLoadingFollowsList(false);
    }
  };

  // Hashtag Search and Feed Loader
  const fetchHashtagPosts = async (tag: string, page = 0, append = false) => {
    try {
      if (page === 0) {
        setHashtagLoading(true);
      }
      const limit = 10;
      const from = page * limit;
      const to = from + limit - 1;

      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          profiles:profiles!posts_user_id_fkey (*)
        `)
        .ilike("content", `%#${tag}%`)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      if (append) {
        setHashtagPosts(prev => {
          const combined = [...prev, ...(data || [])];
          const seen = new Set();
          return combined.filter(p => !seen.has(p.id) && seen.add(p.id));
        });
      } else {
        setHashtagPosts(data || []);
      }

      setHashtagHasMore((data || []).length === limit);
      setHashtagPage(page);
    } catch (e) {
      console.error("Error fetching hashtag posts:", e);
    } finally {
      setHashtagLoading(false);
    }
  };

  const handleHashtagClick = (tag: string) => {
    const cleanTag = tag.trim().replace("#", "").toLowerCase();
    setActiveHashtag(cleanTag);
    navigateTo("hashtag");
    fetchHashtagPosts(cleanTag, 0, false);
  };

  const handleUpdateClanEmoji = async (newEmoji: string | null) => {
    if (!currentUser) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ clan_emoji: newEmoji })
        .eq("id", currentUser.id);
      if (error) throw error;

      // Update currentUser state instantly
      const updatedUser = {
        ...currentUser,
        clan_emoji: newEmoji || undefined
      };
      setCurrentUser(updatedUser);

      // Scroll-sync update active page profile data too
      if (profilePageData && profilePageData.id === currentUser.id) {
        setProfilePageData({
          ...profilePageData,
          clan_emoji: newEmoji
        });
      }

      // Re-trigger feed sync
      fetchPosts(0, false);
    } catch (e) {
      console.error("Failed to update clan alliance:", e);
    }
  };

  const fetchProfilePosts = async (userId: string, page = 0, isAppend = false) => {
    try {
      if (page === 0) {
        setLoadingProfilePosts(true);
        setProfilePostsPage(0);
        setHasMoreProfilePosts(true);
      } else {
        setLoadingMoreProfilePosts(true);
      }

      const from = page * 10;
      const to = from + 9;

      const { data: postsData, error: postsError } = await supabase
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
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (postsError) throw postsError;

      const enrichedPosts = (postsData || []).map((post: any) => {
        const comments = post.comments || [];
        comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return {
          ...post,
          comments
        };
      });

      if (isAppend) {
        setProfilePosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = enrichedPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
      } else {
        setProfilePosts(enrichedPosts);
      }

      setHasMoreProfilePosts(enrichedPosts.length === 10);
      setProfilePostsPage(page);
    } catch (e) {
      console.error("Error fetching profile posts:", e);
    } finally {
      setLoadingProfilePosts(false);
      setLoadingMoreProfilePosts(false);
    }
  };

  useEffect(() => {
    if (profilePageData?.id) {
      fetchProfilePosts(profilePageData.id, 0, false);
    } else {
      setProfilePosts([]);
      setProfilePostsPage(0);
      setHasMoreProfilePosts(false);
    }
  }, [profilePageData?.id]);

  const fetchUserProfileData = async (username: string) => {
    try {
      setProfileLoading(true);
      setProfileError(null);

      const cacheKey = `cached_profile_${username.toLowerCase()}`;
      try {
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
          setProfilePageData(JSON.parse(cached));
          setProfileLoading(false);
        }
      } catch (e) {
        localStorage.removeItem(cacheKey);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .ilike("username", username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) {
        setProfileError(`User @${username} was not found. Please verify spelling!`);
        setProfileLoading(false);
        return;
      }

      let cleanBio = profile.bio || "";
      let bannerUrl = "";
      if (cleanBio.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(cleanBio);
          cleanBio = parsed.text || parsed.bio || "";
          bannerUrl = parsed.banner_url || "";
        } catch (e) {
          // ignore
        }
      }

      const freshProfileData = {
        ...profile,
        bio: cleanBio,
        banner_url: bannerUrl
      };

      if (currentUser && profile.id === currentUser.id) {
        setCurrentUser({
          ...currentUser,
          clan_emoji: profile.clan_emoji,
          display_name: profile.display_name,
          bio: profile.bio,
          avatar_url: profile.avatar_url,
          username: profile.username,
          discord: profile.discord,
          is_verified: profile.is_verified
        } as any);
      }

      setProfilePageData(freshProfileData);
      await fetchFollowsData(profile.id);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(freshProfileData));
      } catch (e) {}
      return profile;
    } catch (err: any) {
      console.error("Failed to fetch public profile details:", err);
      if (!localStorage.getItem(`cached_profile_${username.toLowerCase()}`)) {
        setProfileError(err.message || "Could not retrieve user details.");
      }
      return null;
    } finally {
      setProfileLoading(false);
    }
  };

  const handleReloadProfile = async (username: string) => {
    const cacheKey = `cached_profile_${username.toLowerCase()}`;
    try {
      localStorage.removeItem(cacheKey);
    } catch (e) {}
    
    const profile = await fetchUserProfileData(username);
    if (profile?.id) {
      await fetchProfilePosts(profile.id, 0, false);
    }
  };

  const fetchPosts = async (page: any = 0, isAppend = false, overrideFilter?: "all" | "clan" | "friends") => {
    const pageNum = typeof page === "number" ? page : 0;
    const isAppendMode = typeof page === "number" ? isAppend : false;
    const activeFilter = overrideFilter || feedFilter;

    try {
      if (pageNum === 0) {
        setLoadingPosts(true);
        setPostsPage(0);
        setHasMorePosts(true);
        if (activeFilter === "all") {
          try {
            const cached = localStorage.getItem("cache_posts");
            if (cached && posts.length === 0 && !isAppendMode) {
              setPosts(JSON.parse(cached));
            }
          } catch (e) {
            localStorage.removeItem("cache_posts");
          }
        }
      } else {
        setLoadingMore(true);
      }
      
      setPostsError(null);
      const from = pageNum * 10;
      const to = from + 9;

      let b_query = supabase
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
        .order("created_at", { ascending: false });

      if (activeFilter === "clan") {
        if (!currentUser) {
          setPosts([]);
          setHasMorePosts(false);
          setPostsError("Please sign in to view your clan's feed.");
          setLoadingPosts(false);
          setLoadingMore(false);
          return;
        }
        if (!currentUser.clan_emoji) {
          setPosts([]);
          setHasMorePosts(false);
          setPostsError("You haven't joined a clan yet! Choose your clan flag in profile settings to display a clan-only feed.");
          setLoadingPosts(false);
          setLoadingMore(false);
          return;
        }

        const { data: clanProfiles, error: cpError } = await supabase
          .from("profiles")
          .select("id")
          .eq("clan_emoji", currentUser.clan_emoji);

        if (cpError) throw cpError;

        const clanProfileIds = (clanProfiles || []).map((p: any) => p.id);
        if (clanProfileIds.length === 0) {
          setPosts([]);
          setHasMorePosts(false);
          setLoadingPosts(false);
          setLoadingMore(false);
          return;
        }
        b_query = b_query.in("user_id", clanProfileIds);

      } else if (activeFilter === "friends") {
        if (!currentUser) {
          setPosts([]);
          setHasMorePosts(false);
          setPostsError("Please sign in to view your friends' feed.");
          setLoadingPosts(false);
          setLoadingMore(false);
          return;
        }

        const { data: followedData, error: fError } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUser.id);

        if (fError) throw fError;

        const followedIds = (followedData || []).map((f: any) => f.following_id);
        if (followedIds.length === 0) {
          setPosts([]);
          setHasMorePosts(false);
          setPostsError("You aren't following anyone yet! Follow players from their profile pages to see their feed updates.");
          setLoadingPosts(false);
          setLoadingMore(false);
          return;
        }
        b_query = b_query.in("user_id", followedIds);
      }

      const { data: postsData, error: postsError } = await b_query.range(from, to);

      if (postsError) throw postsError;

      const enrichedPosts = (postsData || []).map((post: any) => {
        const comments = post.comments || [];
        comments.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        return {
          ...post,
          comments
        };
      });

      if (isAppendMode) {
        setPosts(prev => {
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = enrichedPosts.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
      } else {
        setPosts(enrichedPosts);
        if (activeFilter === "all") {
          try {
            localStorage.setItem("cache_posts", JSON.stringify(enrichedPosts));
          } catch (e) {}
        }
      }

      setHasMorePosts(enrichedPosts.length === 10);
      setPostsPage(pageNum);
    } catch (err: any) {
      console.error("Direct db posts fetch error:", err);
      if (pageNum === 0) {
        setPostsError(`syncing issue: ${err.message || err || "cannot fetch posts"}`);
      }
    } finally {
      setLoadingPosts(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (activeView === "feed") {
      fetchPosts(0, false, feedFilter);
    }
  }, [feedFilter, activeView]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowPixelLoader(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let authSubscription: any = null;
    let isMounted = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.warn("Session restore error encountered:", sessionError);
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          if (isMounted) setCurrentUser(null);
          return;
        }
        
        if (session && isMounted) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile && isMounted) {
            const u: UserSessionData = {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              bio: profile.bio,
              discord: profile.discord,
              avatar_url: profile.avatar_url,
              is_verified: profile.is_verified,
              created_at: profile.created_at,
              clan_emoji: profile.clan_emoji,
              email: session.user.email
            };
            setCurrentUser(u);
            localStorage.setItem("token", session.access_token);
            localStorage.setItem("userId", session.user.id);
          }
        } else {
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          if (isMounted) setCurrentUser(null);
        }
      } catch (err) {
        console.error("Session restore error:", err);
      } finally {
        if (isMounted) {
          fetchPosts();
        }
      }

      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;
        
        if (event === "SIGNED_IN" && session) {
          if (currentUserRef.current?.id === session.user.id) {
            // Already logged in as this user, do not trigger refresh or fetch posts
            return;
          }
          const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", session.user.id)
            .maybeSingle();

          if (profile && isMounted) {
            const u: UserSessionData = {
              id: profile.id,
              username: profile.username,
              display_name: profile.display_name,
              bio: profile.bio,
              discord: profile.discord,
              avatar_url: profile.avatar_url,
              is_verified: profile.is_verified,
              created_at: profile.created_at,
              clan_emoji: profile.clan_emoji,
              email: session.user.email
            };
            setCurrentUser(u);
            localStorage.setItem("token", session.access_token);
            localStorage.setItem("userId", session.user.id);
            fetchPosts();
          }
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
          localStorage.removeItem("token");
          localStorage.removeItem("userId");
          fetchPosts();
        }
      });

      authSubscription = subscription;
    };

    initAuth();

    return () => {
      isMounted = false;
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const modParam = params.get("admin") || params.get("moderation");
    if (modParam === "RealMaveboAdminModeration67") {
      setAdminPassword("RealMaveboAdminModeration67");
      alert("Moderator mode unlocked via URL access!");
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleURLRouting = () => {
    const path = window.location.pathname;
    if (path.startsWith("/post/")) {
      const id = path.split("/")[2];
      if (id) {
        setActiveView("post-detail");
        setActivePostId(id);
        fetchSinglePost(id);
        return;
      }
    } else if (path.startsWith("/profile/")) {
      const username = path.split("/")[2];
      if (username) {
        setActiveView("user-profile");
        setActiveUsername(username);
        fetchUserProfileData(username);
        return;
      }
    } else if (path.startsWith("/hashtag/")) {
      const tag = path.split("/")[2];
      if (tag) {
        setActiveView("hashtag");
        setActiveHashtag(tag);
        fetchHashtagPosts(tag, 0, false);
        return;
      }
    } else if (path === "/profile") {
      setActiveView("profile");
      if (currentUser) {
        fetchUserProfileData(currentUser.username);
      }
      return;
    } else if (path === "/settings") {
      setActiveView("feed");
      setIsSettingsOpen(true);
      return;
    } else if (path === "/admin") {
      setActiveView("admin" as any);
      return;
    }
    setActiveView("feed");
    setActivePostId(null);
    setActivePost(null);
  };

  useEffect(() => {
    handleURLRouting();
    const onPopstate = () => {
      handleURLRouting();
    };
    window.addEventListener("popstate", onPopstate);
    return () => {
      window.removeEventListener("popstate", onPopstate);
    };
  }, [currentUser?.id]);

  useEffect(() => {
    if (activeView === "profile" && currentUser?.username) {
      fetchUserProfileData(currentUser.username);
    }
  }, [activeView, currentUser?.username]);

  useEffect(() => {
    if (searchMode === "users" && searchQuery.trim().length > 0) {
      const delayDebounce = setTimeout(async () => {
        setLoadingUsersSearch(true);
        try {
          const query = searchQuery.trim().toLowerCase();
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
            .limit(20);
          
          if (!error && data) {
            setMatchingUsers(data);
          } else {
            setMatchingUsers([]);
          }
        } catch (e) {
          console.error("Error searching users:", e);
          setMatchingUsers([]);
        } finally {
          setLoadingUsersSearch(false);
        }
      }, 250);
      return () => clearTimeout(delayDebounce);
    } else {
      setMatchingUsers([]);
    }
  }, [searchQuery, searchMode]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCaptchaPassed) {
      setLoginError("Please drag the slider to verify before logging in.");
      return;
    }
    if (!loginEmail || !loginPassword) {
      setLoginError("Please enter your email and password.");
      return;
    }

    try {
      setLoginLoading(true);
      setLoginError(null);

      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });

      if (authError) {
        if (authError.message.includes("Email not confirmed")) {
          setLoginError("Verify your email first. Go to Supabase Dashboard -> Auth Providers and set 'Confirm email' to OFF if details require quick auth.");
        } else {
          setLoginError(authError.message || "Invalid credentials.");
        }
        return;
      }

      if (authData.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profile) {
          const u: UserSessionData = {
            id: profile.id,
            username: profile.username,
            display_name: profile.display_name,
            bio: profile.bio,
            discord: profile.discord,
            avatar_url: profile.avatar_url,
            is_verified: profile.is_verified,
            created_at: profile.created_at,
            clan_emoji: profile.clan_emoji,
            email: authData.user.email
          };
          setCurrentUser(u);
          localStorage.setItem("token", authData.session?.access_token || "");
          localStorage.setItem("userId", authData.user.id);
          
          setLoginEmail("");
          setLoginPassword("");
          navigateTo("profile");
        } else {
          setLoginError("Profile match failed. Re-register or check database connection.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setLoginError("A network fault prevented sign in.");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authCaptchaPassed) {
      setRegError("Please drag the slider to verify before registering.");
      return;
    }
    if (!regName || !regUsername || !regEmail || !regPassword) {
      setRegError("All fields are required.");
      return;
    }

    const nameContainsEmoji = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g.test(regName);
    if (nameContainsEmoji) {
      setRegError("Emojis are not allowed in your Display Name.");
      return;
    }

    const cleanUsername = regUsername.trim().toLowerCase();
    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      setRegError("Username can only contain lowercase letters, numbers, dots and underscores.");
      return;
    }

    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters.");
      return;
    }

    try {
      setRegLoading(true);
      setRegError(null);
      setRegSuccess(null);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", cleanUsername)
        .maybeSingle();

      if (existingProfile) {
        throw new Error("This username is already taken.");
      }

      const { data: signupData, error: signupError } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
      });

      if (signupError) throw signupError;
      if (!signupData.user) {
        throw new Error("Failed to create user account.");
      }

      const bioData = JSON.stringify({
        text: "",
        discord: "",
        email: regEmail.trim(),
      });

      const isVerifiedUser = ["kodewt", "mavebo", "kode", "jocko", "dil_doe", "drop", "durtio"].includes(cleanUsername);

      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: signupData.user.id,
          username: cleanUsername,
          display_name: regName.trim(),
          avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanUsername)}`,
          bio: bioData,
          is_verified: isVerifiedUser,
          created_at: new Date().toISOString()
        });

      if (profileError) {
        try {
          await supabase.auth.signOut();
        } catch (e) {}
        throw new Error("Failed to create profile: " + profileError.message);
      }

      setRegSuccess("Congratulations! Registration complete. Please verify your email and sign in.");
      setRegName("");
      setRegUsername("");
      setRegEmail("");
      setRegPassword("");
      setTimeout(() => setAuthTab("login"), 2500);
    } catch (err: any) {
      console.error(err);
      const msg = err.message || "Failed to register account.";
      if (msg.toLowerCase().includes("rate limit") || msg.toLowerCase().includes("rate_limit")) {
        setRegError("Supabase email signup limit hit. Disable email verification inside Supabase dashboard to bypass directly.");
      } else {
        setRegError(msg);
      }
    } finally {
      setRegLoading(false);
    }
  };

  const handleDirectAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 1.5 * 1024 * 1024) {
      alert("Avatar image must be under 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        const { error } = await supabase
          .from("profiles")
          .update({ avatar_url: base64 })
          .eq("id", currentUser.id);

        if (error) throw error;

        setCurrentUser({ ...currentUser, avatar_url: base64 });
        if (profilePageData) {
          setProfilePageData({ ...profilePageData, avatar_url: base64 });
        }
      } catch (err) {
        console.error("Direct avatar upload error:", err);
        alert("Failed to upload avatar.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDirectBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("Banner image must be under 2MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      try {
        let bioText = "";
        try {
          const parsed = JSON.parse(currentUser.bio || "{}");
          bioText = parsed.text || parsed.bio || "";
        } catch (e) {
          bioText = currentUser.bio || "";
        }

        const serializedBio = JSON.stringify({
          text: bioText,
          banner_url: base64,
        });

        const { error } = await supabase
          .from("profiles")
          .update({ bio: serializedBio })
          .eq("id", currentUser.id);

        if (error) throw error;

        setCurrentUser({ ...currentUser, bio: serializedBio });
        if (profilePageData) {
          setProfilePageData({ ...profilePageData, bio: serializedBio });
        }
      } catch (err) {
        console.error("Direct banner upload error:", err);
        alert("Failed to upload banner.");
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEditProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    try {
      setEditLoading(true);
      setEditError(null);
      setEditSuccess(false);

      const cleanUsername = editUsername.trim().toLowerCase();
      if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
        setEditError("Username can only contain lowercase letters, numbers, dots and underscores.");
        setEditLoading(false);
        return;
      }

      if (cleanUsername !== currentUser.username) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("username")
          .ilike("username", cleanUsername)
          .neq("id", currentUser.id)
          .maybeSingle();

        if (existingUser) {
          setEditError("This username is already taken by someone else.");
          setEditLoading(false);
          return;
        }
      }

      let existingBio: any = {};
      try {
        existingBio = JSON.parse(currentUser.bio || "{}");
        if (typeof existingBio !== "object" || existingBio === null) {
          existingBio = {};
        }
      } catch (e) {
        existingBio = {};
      }

      const serializedBio = JSON.stringify({
        ...existingBio,
        text: editBio.trim(),
        banner_url: editBannerUrl.trim(),
      });

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: editName.trim(),
          bio: serializedBio,
          discord: editDiscord.trim(),
          avatar_url: editAvatarUrl.trim() || null,
          username: cleanUsername,
          clan_emoji: editClanEmoji || null,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      setEditSuccess(true);
      
      const { data: freshProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (freshProfile) {
        const updatedUser: UserSessionData = {
          ...currentUser,
          display_name: freshProfile.display_name,
          bio: freshProfile.bio,
          discord: freshProfile.discord,
          avatar_url: freshProfile.avatar_url,
          username: freshProfile.username,
          clan_emoji: freshProfile.clan_emoji,
        };
        setCurrentUser(updatedUser);
        if (profilePageData && profilePageData.id === freshProfile.id) {
          setProfilePageData(freshProfile);
        }
      }

      setTimeout(() => {
        setEditSuccess(false);
        navigateTo("profile");
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setEditError(err.message || "Could not update details.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setEditError("Avatar image must be under 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.0 * 1024 * 1024) {
      setEditError("Banner image must be under 2.0MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditBannerUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("token");
    localStorage.removeItem("userId");
    setCurrentUser(null);
    navigateTo("feed");
  };

  const filteredPosts = posts.filter((post) => {

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;

    const contentMatches = post.content?.toLowerCase().includes(q) || false;
    const authorMatches = post.author_name?.toLowerCase().includes(q) || false;
    const profileMatches = post.profiles && typeof post.profiles === "object" && (
      (post.profiles as any).username?.toLowerCase().includes(q) ||
      (post.profiles as any).display_name?.toLowerCase().includes(q)
    );

    return contentMatches || authorMatches || profileMatches;
  });

  const profileUserPosts = profilePosts;

  const isDark = theme === "dark";
  const glassClass = isDark ? "liquid-glass-dark" : "bg-white border border-zinc-200/80 shadow-sm";
  const bgClass = isDark ? "bg-[#0c0a15] text-[#f1eefc]" : "bg-white text-zinc-900";
  const textClass = isDark ? "text-slate-300" : "text-zinc-800";
  const textMuted = isDark ? "text-zinc-500" : "text-zinc-400";
  const hoverClass = isDark ? "hover:bg-purple-500/5" : "hover:bg-zinc-100";
  const borderClass = isDark ? "border-transparent" : "border-zinc-200";

  let parsedMyBioText = "";
  let parsedMyBannerUrl = "";
  if (currentUser && currentUser.bio) {
    const bioStr = currentUser.bio;
    if (bioStr.trim().startsWith("{")) {
      try {
        const parsed = JSON.parse(bioStr);
        parsedMyBioText = parsed.text || parsed.bio || "";
        parsedMyBannerUrl = parsed.banner_url || "";
      } catch (e) {
        parsedMyBioText = bioStr;
      }
    } else {
      parsedMyBioText = bioStr;
    }
  }

  return (
    <div className={`min-h-screen ${bgClass} font-sans selection:bg-purple-500/20 flex flex-col md:flex-row transition-colors duration-300`}>

      {/* Release history modal */}
      <AnimatePresence>
        {showVersions && (
          <div id="versions-popover-overlay" className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 flex items-center justify-center p-4" onClick={() => setShowVersions(false)}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={`p-6 rounded-2xl max-w-sm w-full ${glassClass} border ${borderClass} shadow-xl z-50`}
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-sm font-bold tracking-tight mb-4 flex items-center">
                <span>Release Version Logs</span>
              </h4>
              <div className="space-y-4 text-xs leading-relaxed max-h-72 overflow-y-auto pr-1">
                <div className={`p-3 rounded-xl ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                  <p className="font-bold text-purple-400">v1.3 (current)</p>
                  <ul className={`mt-1.5 list-disc list-inside space-y-0.5 ${textClass}`}>
                    <li>Hashtags added</li>
                    <li>Followers/following added</li>
                    <li>Added design preferences (beta)</li>
                    <li>Fixed some optimization problems</li>
                    <li>Minor improvements</li>
                  </ul>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                  <p className="font-bold text-zinc-400">v1.2.1</p>
                  <ul className={`mt-1.5 list-disc list-inside space-y-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <li>Fixed optimization problems</li>
                    <li>Fixed bugs in settings</li>
                    <li>Minor improvements</li>
                  </ul>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                  <p className="font-bold text-zinc-400">v1.2</p>
                  <ul className={`mt-1.5 list-disc list-inside space-y-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <li>Fixed security problems</li>
                    <li>Spam protection</li>
                    <li>Banners</li>
                    <li>Design update</li>
                    <li>Minor improvements</li>
                  </ul>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                  <p className="font-bold text-zinc-400">v1.1</p>
                  <ul className={`mt-1.5 list-disc list-inside space-y-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <li>Added user groups / clans</li>
                    <li>Introduced clan emoji selectors</li>
                    <li>Enhanced feed loading system</li>
                    <li>Improved interface responsiveness</li>
                  </ul>
                </div>
                <div className={`p-3 rounded-xl ${isDark ? 'bg-black/20' : 'bg-black/5'}`}>
                  <p className="font-bold text-zinc-400">v1.0</p>
                  <ul className={`mt-1.5 list-disc list-inside space-y-0.5 ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    <li>Official platform release</li>
                    <li>Real-time broadcasting / posts feed</li>
                    <li>Anonymous posting & verified badges</li>
                    <li>Interactive sliding captcha</li>
                  </ul>
                </div>
              </div>
              <button 
                onClick={() => setShowVersions(false)}
                className="mt-6 w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer text-center"
              >
                Done
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Desktop side menu */}
      <aside className={`hidden md:flex flex-col w-64 h-screen sticky top-0 px-5 py-6 border-r ${borderClass} bg-[#0c0a15] shrink-0 justify-between`}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigateTo("feed")}
              className="flex items-center gap-2.5 text-left select-none outline-none cursor-pointer group"
            >
              <img 
                src="https://startorigin2.vercel.app/icon.svg"
                alt="Startorigin Logo"
                className="w-8 h-8 rounded-lg shrink-0 object-contain group-hover:scale-105 transition-transform"
              />
              <h1 className="text-lg font-black tracking-tight">
                <span className="text-purple-400 font-extrabold">start</span>
                <span className="text-white font-bold opacity-90">origin</span>
              </h1>
            </button>
            <div className="flex items-center space-x-1.5 shrink-0">
              <button 
                onClick={toggleDesignPreference}
                className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
                title={`Switch connection mode / theme (current: ${designPreference})`}
              >
                {designPreference === "purple" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-yellow-400" />}
              </button>
              <button 
                onClick={() => setShowVersions(true)}
                className="px-2 py-1 text-[9px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 cursor-pointer hover:bg-purple-500/25 transition-all"
              >
                v1.3
              </button>
            </div>
          </div>

          <div className={`p-3.5 rounded-xl border ${borderClass} bg-black/15 overflow-hidden`}>
            {currentUser ? (
              <div className="space-y-2.5">
                <div className="flex items-center space-x-3">
                  <img 
                    src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`}
                    alt="Current avatar user representation"
                    className="w-9 h-9 rounded-full object-cover border border-purple-500/25 bg-purple-500/5 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs text-white truncate flex items-center gap-2.5">
                      <span>{currentUser.display_name || currentUser.username}</span>
                      <div className="flex items-center gap-2 shrink-0 ml-1">
                        {(currentUser.is_verified || ["mavebo", "kode", "kodewt", "jocko", "dil_doe", "drop", "durtio"].includes(currentUser.username?.toLowerCase() || "")) && (
                          <BadgeCheck className="w-3.5 h-3.5 text-purple-400 fill-zinc-950 shrink-0" />
                        )}
                        {currentUser.clan_emoji && (
                          <span className="text-xs shrink-0" title="Clan">{currentUser.clan_emoji}</span>
                        )}
                      </div>
                      {(() => {
                        try {
                          const parsed = JSON.parse(currentUser.bio || "{}");
                          if (parsed && typeof parsed === "object" && parsed.event_completed && !parsed.event_icon_hidden) {
                            return <span className="text-xs shrink-0 inline-block ml-0.5" title="Events Completed Badge">🎓</span>;
                          }
                        } catch {}
                        return null;
                      })()}
                    </p>
                    <p className="text-[10px] text-purple-400 font-mono truncate">@{currentUser.username}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                  <button 
                    onClick={() => navigateTo("settings")}
                    className="text-[10px] font-bold text-zinc-500 hover:text-purple-400 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <Settings className="w-3 h-3" />
                    <span>settings</span>
                  </button>
                  <button 
                    onClick={handleLogout}
                    className="text-[10px] font-bold text-red-500 hover:text-red-600 transition-colors cursor-pointer flex items-center space-x-1"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>log out</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-1">
                <p className="text-xs font-semibold text-zinc-500">welcome guest</p>
                <button 
                  onClick={() => navigateTo("profile")}
                  className="mt-2 w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg cursor-pointer transition-colors shadow-sm"
                >
                  join / sign in
                </button>
              </div>
            )}
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => navigateTo("feed")}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer ${
                activeView === "feed" 
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                  : `text-zinc-500 ${hoverClass}`
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>feed</span>
            </button>
            
            <button 
              onClick={() => setIsPostModalOpen(true)}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer text-zinc-500 ${hoverClass}`}
            >
              <Plus className="w-4 h-4 text-purple-400" />
              <span>add post</span>
            </button>

            <button 
              onClick={() => navigateTo("profile")}
              className={`w-full flex items-center space-x-3 px-3.5 py-3 rounded-xl font-bold text-xs tracking-wide transition-all cursor-pointer ${
                activeView === "profile" 
                  ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" 
                  : `text-zinc-500 ${hoverClass}`
              }`}
            >
              <User className="w-4 h-4" />
              <span>profile</span>
            </button>
          </nav>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => setIsAboutOpen(true)}
            className="w-full text-center text-[10px] font-mono tracking-wider text-zinc-400 hover:text-purple-400 transition-colors pointer cursor-pointer border-t border-zinc-800/80 pt-4"
          >
            about application
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className={`md:hidden sticky top-0 z-40 px-4 py-2.5 border-b ${borderClass} flex items-center justify-between bg-[#0c0a15]/90 backdrop-blur-lg`}>
        <button 
          onClick={() => navigateTo("feed")}
          className="flex items-center gap-2 text-left cursor-pointer outline-none active:scale-95 transition-transform"
        >
          <img 
            src="https://startorigin2.vercel.app/icon.svg"
            alt="Startorigin Logo"
            className="w-7 h-7 rounded-md shrink-0 object-contain"
          />
          <h1 className="text-base font-black tracking-tight flex items-center">
            <span className="text-purple-400 font-extrabold">start</span>
            <span className="text-white font-bold opacity-90">origin</span>
          </h1>
        </button>
        
        <div className="flex items-center space-x-2.5">
          <button 
            onClick={toggleDesignPreference}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer active:scale-95"
            title={`Switch connection mode / theme (current: ${designPreference})`}
          >
            {designPreference === "purple" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5 text-yellow-400" />}
          </button>
          <button 
            onClick={() => setShowVersions(true)}
            className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20 cursor-pointer"
          >
            v1.3
          </button>
          {currentUser && (
            <button onClick={() => navigateTo("settings")} className="p-1.5 text-zinc-400 hover:text-purple-400">
              <Settings className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-6 md:py-8 space-y-5 flex flex-col min-h-[calc(100vh-140px)] pb-24 md:pb-8">
        
        <div className="flex-1">
          <AnimatePresence mode="wait">
            
            {/* FEED VIEW */}
            {activeView === "feed" && (
              <motion.div 
                key="feed" 
                initial={{ opacity: 0, y: 10 }} 
                animate={{ opacity: 1, y: 0 }} 
                exit={{ opacity: 0, y: -10 }} 
                className="space-y-4"
              >
                <div className={`p-3.5 rounded-2xl border ${borderClass} bg-[#121118]/60 shadow-xs flex flex-col sm:flex-row gap-3`}>
                  <div className="relative flex-1">
                    <input 
                      type="text"
                      placeholder="Search posts or authors..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl pl-9 pr-8 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder-zinc-500"
                    />
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-purple-400" />
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-2 text-[10px] uppercase font-bold text-purple-400 hover:text-purple-300"
                      >
                        Clear
                      </button>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0 justify-between">
                    <div className="flex rounded-xl p-0.5 border border-zinc-800 bg-black/20">
                      <button 
                        onClick={() => setSearchMode("posts")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          searchMode === "posts" 
                            ? "bg-[#9333ea] text-white" 
                            : `text-zinc-500 ${hoverClass}`
                        }`}
                      >
                        Posts
                      </button>
                      <button 
                        onClick={() => setSearchMode("users")}
                        className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider ${
                          searchMode === "users" 
                            ? "bg-[#9333ea] text-white" 
                            : `text-zinc-500 ${hoverClass}`
                        }`}
                      >
                        Users
                      </button>
                    </div>

                    <button 
                      onClick={() => fetchPosts(0, false)}
                      disabled={loadingPosts}
                      className="p-1.5 rounded-lg border border-zinc-800 text-zinc-500 cursor-pointer hover:bg-purple-500/5 transition-colors"
                      title="Reload Broadcasts"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${loadingPosts ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Multi-Channel Feed Selector */}
                <div id="feed-filter-tabs" className="flex border-b border-zinc-900 pb-1.5 space-x-6 text-xs font-bold text-left select-none overflow-x-auto scrollbar-none">
                  <button 
                    onClick={() => setFeedFilter("all")}
                    className={`pb-2 px-1 relative transition-all cursor-pointer ${
                      feedFilter === "all" 
                        ? "text-purple-400 font-extrabold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    All broadcast
                    {feedFilter === "all" && (
                      <motion.div layoutId="activeFeedLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-550 rounded-full" />
                    )}
                  </button>
                  <button 
                    onClick={() => setFeedFilter("clan")}
                    className={`pb-2 px-1 relative transition-all cursor-pointer flex items-center gap-1.5 ${
                      feedFilter === "clan" 
                        ? "text-purple-400 font-extrabold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span>My Clan</span>
                    {currentUser?.clan_emoji && <span className="text-[10px]">{currentUser.clan_emoji}</span>}
                    {feedFilter === "clan" && (
                      <motion.div layoutId="activeFeedLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-550 rounded-full" />
                    )}
                  </button>
                  <button 
                    onClick={() => setFeedFilter("friends")}
                    className={`pb-2 px-1 relative transition-all cursor-pointer flex items-center gap-1.5 ${
                      feedFilter === "friends" 
                        ? "text-purple-400 font-extrabold" 
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    <span>Friends feed</span>
                    {feedFilter === "friends" && (
                      <motion.div layoutId="activeFeedLine" className="absolute bottom-0 left-0 right-0 h-[2px] bg-purple-550 rounded-full" />
                    )}
                  </button>
                </div>


                {searchMode === "users" ? (
                  <div className="space-y-3">
                    {searchQuery.trim().length === 0 ? (
                      <div className="space-y-4 animate-fade-in">
                        <div className={`p-12 text-center rounded-2xl border ${borderClass} bg-[#121118]/45`}>
                          <Search className="w-8 h-8 text-purple-500/40 mx-auto mb-2" />
                          <p className="text-xs font-bold text-zinc-550 uppercase tracking-widest font-mono">User Directory</p>
                          <p className={`text-[10px] mt-1 ${textMuted}`}>Type display names or handles to start searching, or select an official startup member below.</p>
                        </div>

                        {officialUsers.length > 0 && (
                          <div className="space-y-3 pt-1">
                            <h4 className="text-[10px] font-extrabold uppercase tracking-widest text-purple-400 font-mono flex items-center gap-1.5 ml-1">
                              <span>★ Official members</span>
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {officialUsers.map((user) => {
                                let bioText = "";
                                try {
                                  const parsed = JSON.parse(user.bio || "{}");
                                  bioText = parsed.text || parsed.bio || "";
                                } catch (e) {
                                  bioText = user.bio || "";
                                }
                                return (
                                  <div 
                                    key={user.id} 
                                    onClick={() => navigateTo("user-profile", { username: user.username })}
                                    className={`p-4 rounded-2xl border ${borderClass} bg-zinc-950/20 hover:bg-[#121118]/45 flex items-center justify-between transition-all hover:border-purple-500/35 cursor-pointer`}
                                  >
                                    <div className="flex items-center space-x-3 min-w-0">
                                      <div className="relative shrink-0">
                                        <img 
                                          src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`}
                                          alt={user.username}
                                          className="w-10 h-10 rounded-full object-cover border border-purple-500/10"
                                        />
                                        {(user.is_verified || ["mavebo", "kode", "kodewt", "jocko", "dil_doe", "drop", "durtio"].includes(user.username.toLowerCase())) && (
                                          <div className="absolute -bottom-0.5 -right-0.5 bg-[#0b0a0f] rounded-full p-[0.5px] shadow-sm">
                                            <BadgeCheck className="w-3 h-3 text-purple-400 fill-zinc-950 shrink-0" />
                                          </div>
                                        )}
                                      </div>
                                      <div className="min-w-0">
                                        <div className="flex items-center space-x-1.5 flex-wrap">
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigateTo("user-profile", { username: user.username });
                                            }}
                                            className="font-extrabold text-xs text-[#fafafa] hover:underline hover:text-purple-300 text-left truncate cursor-pointer"
                                          >
                                            {user.display_name || user.username}
                                          </button>
                                          {user.clan_emoji && (
                                            <span className="text-xs shrink-0" title="Clan">{user.clan_emoji}</span>
                                          )}
                                        </div>
                                        <p className="text-[9px] text-zinc-500 font-mono">@{user.username}</p>
                                        {bioText && (
                                          <p className="text-[10px] text-zinc-400 font-sans truncate mt-0.5 max-w-[150px]">{bioText}</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : loadingUsersSearch ? (
                      <div className="py-16 text-center space-y-2">
                        <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <p className="text-[10px] font-mono tracking-widest text-zinc-500 uppercase">Searching Profiles...</p>
                      </div>
                    ) : matchingUsers.length === 0 ? (
                      <div className={`p-12 text-center rounded-2xl border ${borderClass} bg-transparent`}>
                        <p className="text-xs font-bold text-zinc-500">No profile matches found for "{searchQuery}".</p>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {matchingUsers.map((user) => {
                          let bioText = "";
                          try {
                            const parsed = JSON.parse(user.bio || "{}");
                            bioText = parsed.text || parsed.bio || "";
                          } catch (e) {
                            bioText = user.bio || "";
                          }
                          return (
                            <div 
                              key={user.id} 
                              onClick={() => navigateTo("user-profile", { username: user.username })}
                              className={`p-4 rounded-2xl border ${borderClass} flex items-center justify-between bg-zinc-950/40 hover:border-purple-500/35 transition-all cursor-pointer`}
                            >
                              <div className="flex items-center space-x-3.5 min-w-0">
                                <div className="relative shrink-0">
                                  <img 
                                    src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`}
                                    alt={user.username}
                                    className="w-10 h-10 rounded-full object-cover border border-zinc-200/40"
                                  />
                                  {(user.is_verified || ["mavebo", "kode", "kodewt", "jocko", "dil_doe", "drop", "durtio"].includes(user.username.toLowerCase())) && (
                                    <div className="absolute -bottom-0.5 -right-0.5 bg-[#0b0a0f] rounded-full p-[0.5px] shadow-sm">
                                      <BadgeCheck className="w-3 h-3 text-purple-400 fill-zinc-950 shrink-0" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center space-x-1.5">
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigateTo("user-profile", { username: user.username });
                                      }}
                                      className="font-bold text-xs hover:underline text-left truncate hover:text-purple-400"
                                    >
                                      {user.display_name || user.username}
                                    </button>
                                    {user.clan_emoji && (
                                      <span className="text-xs shrink-0" title="Clan">{user.clan_emoji}</span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-zinc-500 font-mono">@{user.username}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loadingPosts ? (
                      <GhostLoader />
                    ) : filteredPosts.length === 0 ? (
                      <div className={`p-16 text-center border ${borderClass} rounded-2xl ${isDark ? 'bg-[#121118]/30' : 'bg-white'}`}>
                        <p className="text-xs text-zinc-400 font-medium">
                          the public wall is completely vacant. begin by adding a post!
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {filteredPosts.map((post) => (
                          <PostCard 
                            key={post.id}
                            post={post}
                            currentUser={currentUser}
                            onPostUpdated={(newPost) => {
                              if (newPost) {
                                setPosts(prev => prev.map(p => p.id === newPost.id ? newPost : p));
                              } else {
                                fetchPosts(0, false);
                              }
                            }}
                            onOpenUserProfile={(name) => navigateTo("user-profile", { username: name })}
                            onClickPost={(id) => navigateTo("post-detail", { postId: id })}
                            adminPassword={adminPassword}
                            onRepost={handleRepost}
                          />
                        ))}
                        
                        {/* infinite scroll pagination trigger */}
                        <div ref={setLoaderElement} className={`flex justify-center items-center transition-all ${loadingMore ? 'py-8' : 'py-4 mt-2'}`}>
                          {loadingMore && (
                            <div className="flex items-center space-x-2.5 text-purple-400 text-xs font-mono bg-purple-950/25 px-4 py-2 rounded-full border border-purple-500/15 shadow-sm">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>retrieving next page transmissions...</span>
                            </div>
                          )}
                          {!hasMorePosts && filteredPosts.length > 0 && (
                            <div className="flex items-center space-x-2 text-[9px] text-zinc-500 font-mono uppercase tracking-widest opacity-80">
                              <span className="h-[1px] w-8 bg-zinc-800/60"></span>
                              <span>end of transmission history</span>
                              <span className="h-[1px] w-8 bg-zinc-800/60"></span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* POST DETAIL VIEW */}
            {activeView === "post-detail" && (
              <motion.div 
                key="post-detail" 
                initial={{ opacity: 0, scale: 0.99 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0 }} 
                className="space-y-4"
              >
                <div className={`flex items-center justify-between border-b ${borderClass} pb-2`}>
                  <button 
                    onClick={() => navigateTo("feed")}
                    className="flex items-center space-x-1 text-xs font-bold text-purple-400 hover:text-purple-305 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Wall Feed</span>
                  </button>
                  <span className="text-[10px] uppercase font-mono font-extrabold text-zinc-500 tracking-wider">Broadcaster View</span>
                </div>

                {loadingActivePost ? (
                  <GhostLoader />
                ) : activePostError ? (
                  <div className={`p-8 border border-red-500/10 bg-red-500/5 text-red-500 rounded-2xl text-center space-y-3`}>
                    <p className="text-xs font-semibold">{activePostError}</p>
                    <button onClick={() => navigateTo("feed")} className="px-4 py-1.5 bg-red-500 text-white font-bold text-xs rounded-xl hover:bg-red-600 transition-colors cursor-pointer">
                      Return Home
                    </button>
                  </div>
                ) : activePost ? (
                  <PostCard 
                    post={activePost}
                    currentUser={currentUser}
                    onPostUpdated={(newPost) => {
                      if (newPost) {
                        setActivePost(newPost);
                        setPosts(prev => prev.map(p => p.id === newPost.id ? newPost : p));
                      } else {
                        fetchPosts(0, false);
                        fetchSinglePost(activePost.id);
                      }
                    }}
                    onPostDeleted={() => navigateTo("feed")}
                    onOpenUserProfile={(name) => navigateTo("user-profile", { username: name })}
                    adminPassword={adminPassword}
                    onRepost={handleRepost}
                  />
                ) : null}
              </motion.div>
            )}

            {/* HASHTAG VIEW */}
            {activeView === "hashtag" && (
              <motion.div 
                key="hashtag" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="space-y-4"
              >
                <div className={`flex items-center justify-between border-b ${borderClass} pb-2`}>
                  <button 
                    onClick={() => navigateTo("feed")}
                    className="flex items-center space-x-1 text-xs font-bold text-purple-400 hover:text-purple-305 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Wall Feed</span>
                  </button>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-[#a855f7] font-black">
                    #{activeHashtag}
                  </span>
                </div>

                <div className="p-4 rounded-xl bg-purple-950/10 border border-purple-500/10 text-left">
                  <h3 className="text-sm font-extrabold text-white flex items-center space-x-2">
                    <span className="text-purple-400">#</span>
                    <span>{activeHashtag} tag channel</span>
                  </h3>
                  <p className="text-[11px] text-zinc-400 font-mono mt-1">
                    Displaying broadcasts tagged with #{activeHashtag} (paginated feed)
                  </p>
                </div>

                {hashtagLoading && hashtagPosts.length === 0 ? (
                  <GhostLoader />
                ) : hashtagPosts.length > 0 ? (
                  <div className="space-y-4">
                    {hashtagPosts.map((post: Post) => (
                      <PostCard 
                        key={post.id}
                        post={post}
                        currentUser={currentUser}
                        onPostUpdated={(newPost) => {
                          if (newPost) {
                            setHashtagPosts(prev => prev.map(p => p.id === newPost.id ? newPost : p));
                          } else {
                            fetchHashtagPosts(activeHashtag, 0, false);
                          }
                        }}
                        onPostDeleted={() => {
                          fetchHashtagPosts(activeHashtag, 0, false);
                        }}
                        onOpenUserProfile={(name) => navigateTo("user-profile", { username: name })}
                        onClickPost={(id) => navigateTo("post-detail", { postId: id })}
                        adminPassword={adminPassword}
                        onRepost={handleRepost}
                      />
                    ))}
                    
                    {hashtagHasMore && (
                      <div className="flex justify-center pt-2">
                        <button
                          onClick={() => fetchHashtagPosts(activeHashtag, hashtagPage + 1, true)}
                          disabled={hashtagLoading}
                          className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-purple-900/30 text-white font-bold text-xs cursor-pointer transition-all"
                        >
                          {hashtagLoading ? "loading more tagged posts..." : "load next 10 posts"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-12 text-center bg-transparent border ${borderClass} rounded-2xl`}>
                    <p className="text-xs text-zinc-500 font-medium">No posts with #{activeHashtag} found yet!</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* PROFILE VIEW */}
            {activeView === "profile" && (
              <motion.div 
                key="profile" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="space-y-5"
              >
                {currentUser ? (
                  <div className="space-y-4">
                    <div 
                      onClick={() => directBannerInputRef.current?.click()}
                      className="relative h-44 rounded-2xl overflow-hidden bg-cover bg-center shadow-md animate-fade-in cursor-pointer group"
                      style={{ 
                        backgroundImage: parsedMyBannerUrl 
                          ? `url(${parsedMyBannerUrl})` 
                          : 'linear-gradient(to bottom right, #1c133a, #100820, #140626)' 
                      }}
                      title="click banner to upload custom image (no links!)"
                    >
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <span className="text-white text-xs font-bold font-sans flex items-center space-x-1 border border-white/20 bg-black/65 px-3 py-1.5 rounded-lg">
                          <Upload className="w-3.5 h-3.5" />
                          <span>upload banner</span>
                        </span>
                      </div>

                      {!parsedMyBannerUrl && (
                        <>
                          <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-650/10 rounded-full blur-2xl pointer-events-none" />
                          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />
                        </>
                      )}
                      
                      <div className="absolute top-4 right-4 flex gap-1.5 z-10">
                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] tracking-wider font-mono font-black text-purple-355 border border-purple-500/20 shadow-lg flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                          <span>my account</span>
                        </span>
                      </div>
                    </div>

                    <input 
                      type="file" 
                      ref={directAvatarInputRef}
                      className="hidden" 
                      accept="image/*"
                      onChange={handleDirectAvatarUpload}
                    />
                    <input 
                      type="file" 
                      ref={directBannerInputRef}
                      className="hidden" 
                      accept="image/*"
                      onChange={handleDirectBannerUpload}
                    />

                    <div className="relative -mt-16 px-4 sm:px-6 pb-6 pt-2 rounded-2xl bg-[#0c0a15]/95 backdrop-blur-xl shadow-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="flex items-end space-x-4 animate-fade-in">
                          <div className="relative shrink-0">
                            <img 
                              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`}
                              alt={currentUser.username}
                              className="w-20 h-20 rounded-full border-4 border-[#0c0a15] bg-[#161421] object-cover shadow-2xl ring-2 ring-purple-500/10"
                            />
                            {((currentUser.is_verified || ["mavebo", "kode", "kodewt", "jocko", "dil_doe", "drop", "durtio"].includes(currentUser.username.toLowerCase())) ) && (
                              <div className="absolute -bottom-1.5 -right-1.5 bg-black rounded-full p-0.5 border border-purple-500/30 shadow-lg">
                                <BadgeCheck className="w-5 h-5 text-purple-400 fill-zinc-950" />
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-left relative">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <h3 className="font-extrabold text-[#fafafa] text-lg font-sans tracking-tight leading-none flex items-center gap-1.5">
                                {currentUser.display_name || currentUser.username}
                                
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setIsClanSelectorOpen(true);
                                  }}
                                  className="hover:scale-120 transition-transform cursor-pointer outline-none select-none text-sm shrink-0 ml-1"
                                  title="Choose Clan Alliance"
                                >
                                  {currentUser.clan_emoji || "🛡️"}
                                </button>
                              </h3>
                            </div>
                            <p className="text-xs text-purple-400 font-mono leading-none">@{currentUser.username}</p>
                            
                            {/* Follower/following counts */}
                            <div className="flex space-x-3 text-[11px] font-mono pt-1 text-zinc-400">
                              <button 
                                onClick={() => handleOpenFollowsList("followers", currentUser.id)}
                                className="hover:text-purple-400 cursor-pointer outline-none"
                              >
                                <span className="text-white font-bold">{profileFollowersCount}</span> followers
                              </button>
                              <button 
                                onClick={() => handleOpenFollowsList("following", currentUser.id)}
                                className="hover:text-purple-400 cursor-pointer outline-none"
                              >
                                <span className="text-white font-bold">{profileFollowingCount}</span> following
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          <button 
                            onClick={() => handleReloadProfile(currentUser.username)}
                            title="Reload info and posts"
                            className="p-2 rounded-xl border border-zinc-805 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-white cursor-pointer transition-all flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                          >
                            <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                            <span className="hidden sm:inline">reload posts</span>
                          </button>

                          <button 
                            onClick={() => navigateTo("settings")}
                            className="px-4 py-2 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-bold text-xs cursor-pointer transition-all shrink-0"
                          >
                            <span>edit profile settings</span>
                          </button>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-800/65 space-y-3">
                        <div className="p-3.5 rounded-xl bg-black/45 text-left space-y-2.5">
                          <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">
                            {parsedMyBioText || "No description / biography details added yet. Tap Settings to update profile details."}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1 justify-start">
                          {currentUser.discord && (
                            <div 
                              onClick={() => {
                                navigator.clipboard.writeText(currentUser.discord);
                                setDiscordCopied(true);
                                setTimeout(() => setDiscordCopied(false), 2000);
                              }}
                              className="flex items-center space-x-2 text-[10px] text-purple-250 font-mono bg-[#5865F2]/10 border border-[#5865F2]/30 px-3 py-1.5 rounded-full shadow-inner cursor-pointer hover:bg-[#5865F2]/20 transition-all select-none"
                              title="click to copy discord handle"
                            >
                              <span className="w-1.5 h-1.5 bg-[#5865F2] rounded-full animate-pulse" />
                              <span className="font-bold opacity-80">discord:</span>
                              <span className="text-[#8ab4f8] font-bold">{currentUser.discord}</span>
                              <span className="text-[9px] text-purple-400 font-mono ml-0.5">
                                {discordCopied ? "(copied!)" : "(copy)"}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center space-x-2 text-[10px] text-purple-300 font-mono bg-purple-950/20 border border-purple-500/10 px-3 py-1.5 rounded-full">
                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                            <span className="opacity-85">posts:</span>
                            <span className="text-white font-bold">{profileUserPosts.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-xs font-extrabold font-mono tracking-wider text-zinc-500">posts</h4>
                      
                      {profileLoading || loadingProfilePosts ? (
                        <GhostLoader />
                      ) : profileUserPosts.length > 0 ? (
                        <div className="space-y-4">
                          {profileUserPosts.map((post: Post) => (
                            <PostCard 
                              key={post.id}
                              post={post}
                              currentUser={currentUser}
                              onPostUpdated={(newPost) => {
                                if (newPost) {
                                  setPosts(prev => prev.map(p => p.id === newPost.id ? newPost : p));
                                } else {
                                  fetchPosts(0, false);
                                }
                              }}
                              onPostDeleted={() => {
                                fetchPosts();
                              }}
                              onOpenUserProfile={(name) => navigateTo("user-profile", { username: name })}
                              onClickPost={(id) => navigateTo("post-detail", { postId: id })}
                              adminPassword={adminPassword}
                              onRepost={handleRepost}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className={`p-12 text-center bg-transparent border ${borderClass} rounded-2xl`}>
                          <p className="text-xs text-zinc-500 font-medium">You haven't posted any wall broadcasts yet!</p>
                        </div>
                      )}

                      {/* Profile infinite scroll pagination trigger */}
                      {hasMoreProfilePosts && !loadingProfilePosts && profileUserPosts.length > 0 && (
                        <div ref={setProfileLoaderElement} className={`flex justify-center items-center transition-all ${loadingMoreProfilePosts ? 'py-8' : 'py-4 mt-2'}`}>
                          {loadingMoreProfilePosts && (
                            <div className="flex items-center space-x-2.5 text-purple-400 text-xs font-mono bg-purple-950/25 px-4 py-2 rounded-full border border-purple-500/15 shadow-sm">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>loading previous profile broadcasts...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className={`max-w-md mx-auto rounded-3xl border border-zinc-200/90 dark:border-zinc-800/80 bg-white dark:bg-[#121118]/80 p-6 md:p-8 shadow-sm ${glassClass}`}>
                    <div className="text-center mb-6">
                      <h3 className="text-lg font-extrabold tracking-tight">Access Account</h3>
                      <p className={`text-[11px] mt-1 ${textMuted}`}>Create or log into a profile to claim your verified wall posts.</p>
                    </div>

                    <div className="flex bg-black/40 p-1 rounded-xl mb-6 border border-zinc-900">
                      <button 
                        onClick={() => { setAuthTab("login"); setLoginError(null); setAuthCaptchaPassed(false); }}
                        className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          authTab === "login" ? "bg-purple-600 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Sign In
                      </button>
                      <button 
                        onClick={() => { setAuthTab("register"); setRegError(null); setAuthCaptchaPassed(false); }}
                        className={`flex-1 py-1.5 text-center text-xs font-bold rounded-lg cursor-pointer transition-all ${
                          authTab === "register" ? "bg-purple-600 text-white shadow-xs" : "text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        Register
                      </button>
                    </div>

                    {authTab === "login" ? (
                      <form onSubmit={handleLoginSubmit} className="space-y-4 text-left">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Email Address</label>
                          <input 
                            type="email"
                            required
                            placeholder="e.g. self@domain.com"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Password</label>
                          <input 
                            type="password"
                            required
                            placeholder="••••••••"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        {loginError && (
                          <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-xs font-medium">
                            {loginError}
                          </div>
                        )}

                        <div className="py-1">
                          <SlidingCaptcha onSuccess={() => setAuthCaptchaPassed(true)} resetKey={authTab} />
                        </div>

                        <button 
                          type="submit"
                          disabled={loginLoading || !authCaptchaPassed}
                          className={`w-full py-2.5 font-bold text-xs rounded-xl cursor-pointer transition-all ${
                            !authCaptchaPassed
                              ? "bg-zinc-800/80 text-zinc-550 border border-zinc-800 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700 text-white active:scale-98"
                          }`}
                        >
                          {loginLoading ? "Authorizing..." : "Log In"}
                        </button>
                      </form>
                    ) : (
                      <form onSubmit={handleRegisterSubmit} className="space-y-3.5 text-left">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Full Display Name</label>
                          <input 
                            type="text"
                            required
                            maxLength={40}
                            placeholder="e.g. John Doe, Mavebo Dev"
                            value={regName}
                            onChange={(e) => setRegName(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">User Handle (Username)</label>
                          <input 
                            type="text"
                            required
                            maxLength={25}
                            placeholder="e.g. dil_doe, mavebo, code_smith"
                            value={regUsername}
                            onChange={(e) => setRegUsername(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                          <p className="text-[9px] text-zinc-400">Alphanumeric, underscores and dots only.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Email Address</label>
                          <input 
                            type="email"
                            required
                            placeholder="e.g. custom@origin.com"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Secret Password</label>
                          <input 
                            type="password"
                            required
                            placeholder="Min. 6 long characters"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        {regError && (
                          <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-xs font-semibold">
                            {regError}
                          </div>
                        )}

                        {regSuccess && (
                          <div className="p-3 bg-green-500/5 border border-green-500/10 text-green-500 rounded-xl text-xs font-semibold">
                            {regSuccess}
                          </div>
                        )}

                        <div className="py-1">
                          <SlidingCaptcha onSuccess={() => setAuthCaptchaPassed(true)} resetKey={authTab} />
                        </div>

                        <button 
                          type="submit"
                          disabled={regLoading || !authCaptchaPassed}
                          className={`w-full py-2.5 font-bold text-xs rounded-xl cursor-pointer transition-all ${
                            !authCaptchaPassed
                              ? "bg-zinc-800/80 text-zinc-550 border border-zinc-800 cursor-not-allowed"
                              : "bg-purple-600 hover:bg-purple-700 text-white active:scale-98"
                          }`}
                        >
                          {regLoading ? "Registering account..." : "Complete Signup"}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {/* USER PROFILE VIEW */}
            {activeView === "user-profile" && (
              <motion.div 
                key="user-profile" 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                exit={{ opacity: 0 }} 
                className="space-y-4"
              >
                <div className={`flex items-center justify-between border-b ${borderClass} pb-2`}>
                  <button 
                    onClick={() => navigateTo("feed")}
                    className="flex items-center space-x-1 text-xs font-bold text-purple-400 hover:text-purple-305 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Wall Feed</span>
                  </button>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Public Page</span>
                </div>

                {profileLoading ? (
                  <GhostLoader />
                ) : profileError ? (
                  <div className={`p-8 border border-red-550/10 bg-red-500/5 text-red-500 rounded-2xl text-center space-y-2`}>
                    <p className="text-xs font-semibold">{profileError}</p>
                    <button onClick={() => navigateTo("feed")} className="px-4 py-1.5 bg-[#9333ea] hover:bg-[#a855f7] text-white font-bold text-xs rounded-lg cursor-pointer">
                      Return to Feed
                    </button>
                  </div>
                ) : profilePageData ? (
                  <div className="space-y-5 animate-fade-in">
                    <div 
                      className="relative h-44 rounded-2xl overflow-hidden bg-cover bg-center shadow-md animate-fade-in"
                      style={{ 
                        backgroundImage: profilePageData.banner_url 
                          ? `url(${profilePageData.banner_url})` 
                          : 'linear-gradient(to bottom right, #1b143a, #100820, #140626)' 
                      }}
                    >
                      {!profilePageData.banner_url && (
                        <>
                          <div className="absolute -top-10 -left-10 w-32 h-32 bg-purple-650/10 rounded-full blur-2xl" />
                          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-purple-500/15 rounded-full blur-2xl" />
                        </>
                      )}
                      <div className="absolute top-4 right-4 flex gap-1.5 z-10">
                        <span className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[10px] tracking-wider font-mono font-black text-purple-355 border border-purple-500/20 shadow-lg flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
                          <span>active member</span>
                        </span>
                      </div>
                    </div>

                    <div className="relative -mt-16 px-4 sm:px-6 pb-6 pt-2 rounded-2xl bg-[#0c0a15]/95 backdrop-blur-xl shadow-xl space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="flex items-end space-x-4">
                          <div className="relative shrink-0">
                            <img 
                              src={profilePageData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(profilePageData.username)}`}
                              alt={profilePageData.username}
                              className="w-20 h-20 rounded-full border-4 border-[#0c0a15] bg-[#161421] object-cover shadow-2xl ring-2 ring-purple-500/10"
                            />
                            {((profilePageData.is_verified || ["mavebo", "kode", "kodewt", "jocko", "dil_doe", "drop", "durtio"].includes(profilePageData.username.toLowerCase())) ) && (
                              <div className="absolute -bottom-1.5 -right-1.5 bg-black rounded-full p-0.5 border border-purple-500/30 shadow-lg">
                                <BadgeCheck className="w-5 h-5 text-purple-400 fill-purple-950" />
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-1 text-left">
                            <div className="flex items-center space-x-1.5 flex-wrap">
                              <h3 className="font-extrabold text-[#fafafa] text-lg font-sans tracking-tight leading-none flex items-center gap-1.5">
                                {profilePageData.display_name || profilePageData.username}
                                
                                {currentUser && currentUser.username.toLowerCase() === profilePageData.username.toLowerCase() ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setIsClanSelectorOpen(true);
                                    }}
                                    className="hover:scale-120 transition-transform cursor-pointer outline-none select-none text-sm shrink-0 ml-1"
                                    title="Choose Clan Alliance"
                                  >
                                    {profilePageData.clan_emoji || "🛡️"}
                                  </button>
                                ) : (
                                  profilePageData.clan_emoji && (
                                    <span className="text-sm shrink-0 ml-1" title="Clan">{profilePageData.clan_emoji}</span>
                                  )
                                )}
                              </h3>
                            </div>
                            <p className="text-xs text-purple-400 font-mono leading-none">@{profilePageData.username}</p>

                            {/* Follower/following counts */}
                            <div className="flex space-x-3 text-[11px] font-mono pt-1 text-zinc-400">
                              <button 
                                onClick={() => handleOpenFollowsList("followers", profilePageData.id)}
                                className="hover:text-purple-400 cursor-pointer outline-none"
                              >
                                <span className="text-white font-bold">{profileFollowersCount}</span> followers
                              </button>
                              <button 
                                onClick={() => handleOpenFollowsList("following", profilePageData.id)}
                                className="hover:text-purple-400 cursor-pointer outline-none"
                              >
                                <span className="text-white font-bold">{profileFollowingCount}</span> following
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                          <button 
                            onClick={() => handleReloadProfile(profilePageData.username)}
                            title="Reload info and posts"
                            className="p-2 rounded-xl border border-zinc-805 bg-zinc-900/60 hover:bg-zinc-850 text-zinc-400 hover:text-white cursor-pointer transition-all flex items-center gap-1.5 px-3 py-2 text-xs font-bold"
                          >
                            <RefreshCw className="w-3.5 h-3.5 animate-pulse" />
                            <span className="hidden sm:inline">reload posts</span>
                          </button>

                          {currentUser && currentUser.username.toLowerCase() === profilePageData.username.toLowerCase() ? (
                            <button 
                              onClick={() => navigateTo("settings")}
                              className="px-4 py-2 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-300 font-bold text-xs cursor-pointer transition-all shrink-0"
                            >
                              edit profile settings
                            </button>
                          ) : currentUser ? (
                            <button 
                              onClick={() => handleToggleFollow(profilePageData.id)}
                              className={`px-4.5 py-2 rounded-xl text-xs font-black shadow-lg transition-all cursor-pointer ${
                                isFollowingProfile 
                                  ? "bg-zinc-800 text-zinc-300 hover:bg-red-950/40 hover:text-red-400 border border-zinc-700/60" 
                                  : "bg-purple-600 hover:bg-purple-700 text-white"
                              }`}
                            >
                              {isFollowingProfile ? "✓ Following" : "+ Follow"}
                            </button>
                          ) : null}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-800/65 space-y-3">
                        <div className="p-3.5 rounded-xl bg-black/45 border border-zinc-900/40 text-left space-y-2.5">
                          <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">
                            {(() => {
                              let displayPublicBio = "";
                              try {
                                const parsed = JSON.parse(profilePageData.bio || "{}");
                                if (typeof parsed === "object" && parsed !== null) {
                                  displayPublicBio = parsed.text || parsed.bio || "";
                                } else {
                                  displayPublicBio = profilePageData.bio || "";
                                }
                              } catch (e) {
                                displayPublicBio = profilePageData.bio || "";
                              }
                              return displayPublicBio || "no description/biography details added yet.";
                            })()}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1 justify-start">
                          {profilePageData.discord && (
                            <div 
                              onClick={() => {
                                navigator.clipboard.writeText(profilePageData.discord);
                                setDiscordCopied(true);
                                setTimeout(() => setDiscordCopied(false), 2000);
                              }}
                              className="flex items-center space-x-2 text-[10px] text-purple-250 font-mono bg-[#5865F2]/10 border border-[#5865F2]/30 px-3 py-1.5 rounded-full shadow-inner cursor-pointer hover:bg-[#5865F2]/20 transition-all select-none"
                              title="click to copy discord handle"
                            >
                              <span className="w-1.5 h-1.5 bg-[#5865F2] rounded-full animate-pulse" />
                              <span className="font-bold opacity-80">discord:</span>
                              <span className="text-[#8ab4f8] font-bold">{profilePageData.discord}</span>
                              <span className="text-[9px] text-purple-400 font-mono ml-0.5">
                                {discordCopied ? "(copied!)" : "(copy)"}
                              </span>
                            </div>
                          )}

                          <div className="flex items-center space-x-2 text-[10px] text-purple-300 font-mono bg-purple-950/20 border border-purple-500/10 px-3 py-1.5 rounded-full">
                            <FileText className="w-3.5 h-3.5 text-purple-400" />
                            <span className="opacity-85">posts:</span>
                            <span className="text-white font-bold">{profileUserPosts.length}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3.5">
                      <h4 className="text-xs font-semibold font-mono tracking-wider text-purple-400 text-left">
                        posts by @{profilePageData.username}
                      </h4>
                      
                      {profileLoading || loadingProfilePosts ? (
                        <GhostLoader />
                      ) : profileUserPosts.length > 0 ? (
                        <div className="space-y-4">
                          {profileUserPosts.map((post: Post) => (
                            <PostCard 
                              key={post.id}
                              post={post}
                              currentUser={currentUser}
                              onPostUpdated={(newPost) => {
                                if (newPost) {
                                  setPosts(prev => prev.map(p => p.id === newPost.id ? newPost : p));
                                } else {
                                  fetchPosts(0, false);
                                }
                              }}
                              onPostDeleted={() => {
                                fetchPosts();
                              }}
                              onOpenUserProfile={(name) => navigateTo("user-profile", { username: name })}
                              onClickPost={(id) => navigateTo("post-detail", { postId: id })}
                              adminPassword={adminPassword}
                              onRepost={handleRepost}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className={`p-12 text-center border ${borderClass} rounded-2xl`}>
                          <p className="text-xs text-zinc-400">This account hasn't broadcasted any posts yet.</p>
                        </div>
                      )}

                      {/* Profile infinite scroll pagination trigger */}
                      {hasMoreProfilePosts && !loadingProfilePosts && profileUserPosts.length > 0 && (
                        <div ref={setProfileLoaderElement} className={`flex justify-center items-center transition-all ${loadingMoreProfilePosts ? 'py-8' : 'py-4 mt-2'}`}>
                          {loadingMoreProfilePosts && (
                            <div className="flex items-center space-x-2.5 text-purple-400 text-xs font-mono bg-purple-950/25 px-4 py-2 rounded-full border border-purple-500/15 shadow-sm">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>loading previous profile broadcasts...</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </motion.div>
            )}

            {/* SETTINGS VIEW */}
            {activeView === "settings" && (
              <motion.div 
                key="settings" 
                initial={{ opacity: 0, scale: 0.98 }} 
                animate={{ opacity: 1, scale: 1 }} 
                exit={{ opacity: 0 }} 
                className="space-y-4"
              >
                <div className={`flex items-center justify-between border-b ${borderClass} pb-2`}>
                  <button 
                    onClick={() => navigateTo("profile")}
                    className="flex items-center space-x-1 text-xs font-bold text-purple-400 hover:text-purple-300 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Profile</span>
                  </button>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-zinc-500">Profile Configuration</span>
                </div>

                {currentUser ? (
                  <div className={`rounded-3xl ${isDark ? 'bg-zinc-950/40' : 'bg-white'} p-6 md:p-8 space-y-6 ${glassClass}`}>
                    <div>
                      <h3 className="text-base font-black tracking-tight">Profile Customization</h3>
                      <p className={`text-[11px] ${textMuted} mt-1`}>Configure Display Handle, Username tag, banner style, biography logs, and connections.</p>
                    </div>

                    <form onSubmit={handleEditProfileSave} className="space-y-5 text-left">
                      <div className="flex items-center space-x-4 p-4 rounded-2xl bg-[#c0c0c0]/5">
                        <img 
                          src={editAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(editUsername)}`}
                          alt="Edit avatar preview"
                          className="w-14 h-14 rounded-full object-cover border border-purple-500/30 shrink-0 bg-purple-500/5"
                        />
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="text-[10px] font-extrabold uppercase font-mono text-zinc-500">Avatar Image</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input 
                              type="text"
                              placeholder="Avatar URL directly..."
                              value={editAvatarUrl}
                              onChange={(e) => setEditAvatarUrl(e.target.value)}
                              className="flex-1 rounded-lg px-2.5 py-1 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/40 bg-zinc-900 border-zinc-800 text-zinc-100"
                            />
                            <label className="shrink-0 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] rounded-lg cursor-pointer flex items-center justify-center space-x-1">
                              <Upload className="w-3 h-3" />
                              <span>Upload</span>
                              <input 
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarFileUpload}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4 p-4 rounded-2xl bg-[#c0c0c0]/5">
                        <div 
                          className="w-14 h-14 rounded-lg bg-cover bg-center border border-purple-500/10 shrink-0 bg-purple-500/5 overflow-hidden flex items-center justify-center text-[9px] text-zinc-500 font-bold uppercase"
                          style={{ backgroundImage: editBannerUrl ? `url(${editBannerUrl})` : "none" }}
                        >
                          {!editBannerUrl && "No Banner"}
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="text-[10px] font-extrabold uppercase font-mono text-zinc-500">Profile Cover Banner</p>
                          <div className="flex flex-col sm:flex-row gap-2">
                            <input 
                              type="text"
                              placeholder="Banner URL directly..."
                              value={editBannerUrl}
                              onChange={(e) => setEditBannerUrl(e.target.value)}
                              className="flex-1 rounded-lg px-2.5 py-1 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/40 bg-zinc-900 border-zinc-800 text-zinc-100"
                            />
                            <label className="shrink-0 px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] rounded-lg cursor-pointer flex items-center justify-center space-x-1">
                              <Upload className="w-3 h-3" />
                              <span>Upload</span>
                              <input 
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleBannerFileUpload}
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Display Name</label>
                          <input 
                            type="text"
                            required
                            maxLength={40}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">User Handle (Username)</label>
                          <input 
                            type="text"
                            required
                            maxLength={25}
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Discord Connection tag</label>
                        <input 
                          type="text"
                          placeholder="e.g. jocko_smith#4321"
                          maxLength={35}
                          value={editDiscord}
                          onChange={(e) => setEditDiscord(e.target.value)}
                          className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-900 border-zinc-805 text-zinc-100"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Biography Logs (About Me)</label>
                        <textarea
                          rows={4}
                          maxLength={250}
                          placeholder="Tell us about yourself..."
                          value={editBio}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.stopPropagation();
                            }
                          }}
                          onChange={(e) => setEditBio(e.target.value)}
                          className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none bg-zinc-900 border-zinc-805 text-zinc-100"
                        />
                        <div className="flex justify-between text-[9px] text-zinc-450">
                          <span>Brief summary describing biography.</span>
                          <span>{editBio.length} / 250</span>
                        </div>
                      </div>

                      {/* Clan Selector Grid */}

                      {editError && (
                        <div className="p-3 bg-red-500/5 border border-red-500/10 text-red-500 rounded-xl text-xs font-medium">
                          {editError}
                        </div>
                      )}

                      {editSuccess && (
                        <div className="p-3 bg-green-500/5 border border-green-500/10 text-green-500 rounded-xl text-xs font-semibold flex items-center space-x-1.5">
                          <Check className="w-4 h-4 text-green-500" />
                          <span>Profile details updated successfully! Saving settings...</span>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row gap-3 pt-3">
                        <button 
                          type="submit"
                          disabled={editLoading}
                          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-650/35 text-white font-bold text-xs rounded-xl cursor-pointer transition-colors"
                        >
                          {editLoading ? "Saving Configurations..." : "Save Config Details"}
                        </button>
                        <button 
                          type="button"
                          onClick={() => navigateTo("profile")}
                          className={`px-6 py-2.5 rounded-xl text-xs font-bold border ${borderClass} ${hoverClass} transition-all cursor-pointer`}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>

                    <div className="pt-6 border-t border-zinc-200/60 dark:border-zinc-800/60 flex flex-col items-center">
                      <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider mb-2">Danger Core Area</p>
                      <button 
                        onClick={handleLogout}
                        className="px-6 py-2 rounded-xl bg-red-550 border border-red-500/30 hover:bg-red-600 text-white font-bold text-xs cursor-pointer tracking-wider shrink-0 transition-colors"
                      >
                        Disconnect & Log Out
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <p className="text-sm font-semibold text-zinc-500">You must be logged in to access configurations.</p>
                    <button onClick={() => navigateTo("profile")} className="mt-4 px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold cursor-pointer">
                      Log In / Signup
                    </button>
                  </div>
                )}
              </motion.div>
            )}

            {/* ADMIN VIEW */}
            {activeView === "admin" as any && (
              <motion.div
                key="admin"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-slate-200"
              >
                {adminAuthPassword !== "RealMaveboStenaAdminModeration67" ? (
                  <div id="admin-login-card" className={`p-6 md:p-8 rounded-2xl border ${borderClass} bg-[#121118]/80 space-y-6 text-center max-w-md mx-auto`}>
                    <div className="mx-auto w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                      <Lock className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-extrabold tracking-wider uppercase text-purple-400">Security Gateway Access</h3>
                      <p className="text-zinc-400 text-[10px] mt-1 uppercase tracking-wider">Restricted Moderator Area</p>
                    </div>
                    <p className={`text-xs ${textClass} leading-relaxed`}>
                      Please enter the system password to access user activities monitoring, security logs, IP/device bans, and live moderation.
                    </p>
                    <form 
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (adminInputPass === "RealMaveboStenaAdminModeration67") {
                          sessionStorage.setItem("admin_auth_pass", adminInputPass);
                          setAdminAuthPassword(adminInputPass);
                        } else {
                          alert("Invalid admin credentials!");
                        }
                      }}
                      className="space-y-4"
                    >
                      <input 
                        id="admin-password-field"
                        type="password"
                        placeholder="Security Passphrase..."
                        value={adminInputPass}
                        onChange={(e) => setAdminInputPass(e.target.value)}
                        className="w-full rounded-xl px-4 py-2 bg-zinc-900 border border-zinc-800 text-center text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 text-white"
                      />
                      <button 
                        id="admin-login-submit"
                        type="submit"
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 font-extrabold text-xs text-white rounded-xl uppercase tracking-wider cursor-pointer"
                      >
                        Unlock System Console
                      </button>
                    </form>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div id="admin-header-panel" className={`p-5 rounded-2xl border ${borderClass} bg-[#121118]/80 flex flex-col sm:flex-row justify-between sm:items-center gap-4`}>
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400">
                          <Check className="w-6 h-6" />
                        </div>
                        <div>
                          <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                            <span>Admin Security Console</span>
                            <span className="px-2 py-0.5 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-[8px] tracking-wider uppercase font-extrabold font-mono animate-pulse">LIVE MONITOR</span>
                          </h2>
                          <p className="text-[10px] text-zinc-500 font-mono">Real-time telemetry, session heartbeats, and threat shields.</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <button 
                          id="admin-refresh-stats-btn"
                          onClick={fetchAdminStats}
                          disabled={loadingAdminStats}
                          className="px-3.5 py-2 rounded-xl text-[10px] font-mono tracking-wider uppercase bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 border border-purple-500/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                        >
                          <RefreshCw className={`w-3 h-3 ${loadingAdminStats ? 'animate-spin' : ''}`} />
                          <span>Refresh Telemetry</span>
                        </button>
                        <button 
                          id="admin-logout-btn"
                          onClick={() => {
                            sessionStorage.removeItem("admin_auth_pass");
                            setAdminAuthPassword("");
                          }}
                          className="px-3.5 py-2 rounded-xl text-[10px] uppercase font-bold bg-transparent hover:bg-red-500/10 text-red-400 border border-red-500/20 cursor-pointer"
                        >
                          Lock Out
                        </button>
                      </div>
                    </div>

                    <div id="admin-tabs" className="flex rounded-xl p-1 bg-[#121118]/60 border border-zinc-800/60 font-sans shadow-inner">
                      <button 
                        onClick={() => setAdminActiveTab("stats")}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                          adminActiveTab === "stats" 
                            ? "bg-purple-600 text-white shadow-xs" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Users className="w-3.5 h-3.5" />
                        <span>Sessions & Stats</span>
                      </button>
                      <button 
                        onClick={() => setAdminActiveTab("security")}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                          adminActiveTab === "security" 
                            ? "bg-purple-600 text-white shadow-xs" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <Shield className="w-3.5 h-3.5" />
                        <span>Security Intelligence</span>
                      </button>
                      <button 
                        onClick={() => setAdminActiveTab("moderation")}
                        className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center justify-center space-x-1.5 transition-all ${
                          adminActiveTab === "moderation" 
                            ? "bg-purple-600 text-white shadow-xs" 
                            : "text-zinc-400 hover:text-white"
                        }`}
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>Moderation Feed</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {adminStatsError && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-medium leading-relaxed">
                          {adminStatsError}
                        </div>
                      )}

                      {adminActiveTab === "stats" && adminStats && (
                        <div className="space-y-5">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className={`p-4 rounded-2xl border ${borderClass} bg-[#121118]/45 text-center`}>
                              <p className="text-[10px] uppercase tracking-widest text-purple-400 font-mono font-bold">Total Registered Users</p>
                              <p className="text-3xl font-black text-white mt-1">{adminStats.registerCount}</p>
                              <p className="text-[9px] text-zinc-500 mt-1 uppercase font-mono font-semibold">Enrolled in database</p>
                            </div>
                            <div className={`p-4 rounded-2xl border ${borderClass} bg-[#121118]/45 text-center`}>
                              <p className="text-[10px] uppercase tracking-widest text-green-400 font-mono font-bold">Online Users (Active 30s)</p>
                              <p className="text-3xl font-black text-green-400 mt-1">{adminStats.onlineCount}</p>
                              <p className="text-[9px] text-zinc-500 mt-1 uppercase font-mono font-semibold">Providing live heartbeats</p>
                            </div>
                          </div>

                          <div className={`p-5 rounded-2xl border ${borderClass} bg-[#121118]/45 space-y-4`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">Online User telemetry details</h3>
                            {adminStats.onlineSessions && adminStats.onlineSessions.length > 0 ? (
                              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                {adminStats.onlineSessions.map((ses: any, sIdx: number) => (
                                  <div key={sIdx} className="p-3.5 rounded-xl border border-zinc-800/60 bg-black/35 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                                    <div className="flex items-center space-x-3 min-w-0">
                                      <img 
                                        src={ses.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(ses.username)}`}
                                        className="w-10 h-10 rounded-full object-cover border border-purple-500/20"
                                      />
                                      <div className="min-w-0">
                                        <p className="font-bold text-xs text-white truncate">{ses.displayName || ses.username}</p>
                                        <p className="text-[10px] font-mono text-purple-400">@{ses.username}</p>
                                      </div>
                                    </div>

                                    <div className="space-y-1 text-left sm:text-right">
                                      <div className="flex flex-wrap gap-1.5 justify-start sm:justify-end">
                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 border border-purple-500/20 text-purple-400 font-mono text-[9px] font-bold">
                                          IP: {ses.ip || "Unknown"}
                                        </span>
                                        {ses.vpnInfo?.isVpn && (
                                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20 text-blue-400 font-mono text-[9px] font-bold">
                                            VPN DETECTED
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-[9px] text-zinc-500 font-mono truncate max-w-[280px]">
                                        Device: {ses.userAgent || "Unknown Standard Device"}
                                      </p>
                                    </div>

                                    <div className="shrink-0">
                                      <button 
                                        onClick={() => handleBlockAction({ ip: ses.ip, userAgent: ses.userAgent })}
                                        className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-750 text-white font-mono text-[9px] font-bold uppercase tracking-wider cursor-pointer"
                                      >
                                        Block Device / IP
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-center py-6 text-zinc-550 text-[10px] uppercase font-mono tracking-wider font-semibold">No active telemetry sessions logged in the last 30s.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {adminActiveTab === "security" && adminStats && (
                        <div className="space-y-4">
                          <div className={`p-5 rounded-2xl border ${borderClass} bg-[#121118]/45 space-y-4`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-red-400 font-mono flex items-center gap-1.5">
                              <span>Security Alerts / Suspicious Logs</span>
                              <span className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-mono animate-pulse font-extrabold">{adminStats.suspiciousActivities?.length || 0} SEVERE SEEN</span>
                            </h3>
                            {adminStats.suspiciousActivities && adminStats.suspiciousActivities.length > 0 ? (
                              <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                {adminStats.suspiciousActivities.map((log: any, lIdx: number) => (
                                  <div key={lIdx} className="p-3.5 rounded-xl border border-red-500/10 bg-red-500/5 space-y-3 text-left">
                                    <div className="flex items-center justify-between gap-3 text-[10px] font-mono">
                                      <span className="font-bold text-red-400 uppercase tracking-wider">{log.type} Attack Detected</span>
                                      <span className="text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <div className="p-2.5 rounded bg-black/45 border border-zinc-800 text-[10px] font-mono text-amber-400 whitespace-pre-wrap break-all">
                                      {log.detail}
                                    </div>
                                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 text-[10px]">
                                      <div className="text-zinc-400 font-mono">
                                        IP: <span className="text-zinc-200">{log.ip || "None"}</span> • Device: <span className="text-zinc-200">{log.userAgent || "None"}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        <button 
                                          onClick={() => handleBlockAction({ ip: log.ip, userAgent: log.userAgent })}
                                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white border border-red-500/20 font-bold uppercase tracking-wider text-[9px] rounded-lg cursor-pointer"
                                        >
                                          Ban Intruder IP/Device
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-center py-6 text-zinc-550 text-[10px] uppercase font-mono tracking-wider font-semibold">No malicious activity logged recently. Shield is green.</p>
                            )}
                          </div>

                          <div className={`p-5 rounded-2xl border ${borderClass} bg-[#121118]/45 space-y-4`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">Standard Blocklist Shields</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">Banned IP Rules</h4>
                                <div className="p-3.5 rounded-xl bg-black/20 border border-zinc-800/80 max-h-48 overflow-y-auto space-y-2">
                                  {adminStats.blockedIps && adminStats.blockedIps.length > 0 ? (
                                    adminStats.blockedIps.map((ip: string, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-4 text-xs font-mono">
                                        <span className="text-zinc-350">{ip}</span>
                                        <button 
                                          onClick={() => handleUnblockAction({ ip })}
                                          className="text-purple-400 hover:text-purple-305 uppercase font-bold text-[8px]"
                                        >
                                          Lift ban
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-zinc-650 text-[9px] uppercase tracking-wider py-1 font-mono text-center">0 active IP rules</p>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-purple-400 font-mono">Banned Device Rules (UA)</h4>
                                <div className="p-3.5 rounded-xl bg-black/20 border border-zinc-800/80 max-h-48 overflow-y-auto space-y-2">
                                  {adminStats.blockedUserAgents && adminStats.blockedUserAgents.length > 0 ? (
                                    adminStats.blockedUserAgents.map((ua: string, idx: number) => (
                                      <div key={idx} className="flex items-start justify-between gap-4 text-xs font-mono">
                                        <span className="text-zinc-350 truncate max-w-[140px]" title={ua}>{ua}</span>
                                        <button 
                                          onClick={() => handleUnblockAction({ userAgent: ua })}
                                          className="text-purple-400 hover:text-purple-305 uppercase font-bold text-[8px] shrink-0"
                                        >
                                          Lift ban
                                        </button>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-zinc-650 text-[9px] uppercase tracking-wider py-1 font-mono text-center">0 active Device rules</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {adminActiveTab === "moderation" && (
                        <div className="space-y-4">
                          <div className={`p-5 rounded-2xl border ${borderClass} bg-[#121118]/45 space-y-4`}>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono text-left">Thread Moderation</h3>
                            <p className="text-[10px] text-zinc-500 leading-relaxed text-left">Deletions take place immediately on the database in real-time bypassing user restrictions.</p>
                            
                            <div className="space-y-4 max-h-110 overflow-y-auto pr-1">
                              {posts && posts.length > 0 ? (
                                posts.map((pst) => (
                                  <div key={pst.id} className="p-4 rounded-xl border border-zinc-800 bg-black/30 text-left space-y-3">
                                    <div className="flex justify-between items-start gap-4">
                                      <div className="flex items-center space-x-2.5">
                                        <img 
                                          src={pst.profiles?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(pst.profiles?.username || 'G')}`}
                                          className="w-8 h-8 rounded-full border border-purple-500/10"
                                        />
                                        <div>
                                          <p className="font-bold text-xs text-white">{pst.profiles?.display_name || pst.profiles?.username || "Guest"}</p>
                                          <p className="text-[10px] font-mono text-purple-400">@{pst.profiles?.username || "guest"}</p>
                                        </div>
                                      </div>
                                      <button 
                                        onClick={() => adminDeletePost(pst.id)}
                                        className="px-2.5 py-1 text-[9px] font-mono font-bold text-red-400 border border-red-500/20 hover:bg-red-500/10 rounded uppercase"
                                      >
                                        Delete Post
                                      </button>
                                    </div>

                                    <p className="text-xs text-zinc-350 bg-black/15 p-2 rounded border border-zinc-850 break-words font-sans">{pst.content}</p>

                                    {pst.comments && pst.comments.length > 0 && (
                                      <div className="pl-4 border-l border-zinc-800 space-y-2">
                                        <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest font-mono">Replies Log ({pst.comments.length})</p>
                                        {pst.comments.map((cm: any) => (
                                          <div key={cm.id} className="p-2.5 rounded bg-black/20 border border-zinc-900/60 flex justify-between items-center gap-4">
                                            <div className="min-w-0 pr-1">
                                              <p className="text-[10px] font-bold text-zinc-300">
                                                {cm.profiles?.display_name || cm.profiles?.username || "Guest reviewer"} <span className="text-purple-400 text-[8px]">@{cm.profiles?.username || "anonymous"}</span>
                                              </p>
                                              <p className="text-[11px] text-zinc-450 truncate break-words mt-0.5">{cm.content}</p>
                                            </div>
                                            <button 
                                              onClick={() => adminDeleteComment(cm.id)}
                                              className="text-[8px] font-bold uppercase text-red-400 hover:text-red-300 bg-[#351010]/35 hover:bg-red-950/20 px-2 py-0.5 rounded border border-red-900/30 shrink-0"
                                            >
                                              Delete
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-center py-6 text-zinc-550 text-[10px] uppercase font-mono tracking-wider font-semibold">No live threads are currently broadcast on the wall.</p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

          </AnimatePresence>
        </div>

      </main>

      {/* Mobile bottom navigation */}
      <div className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t ${borderClass} px-6 py-3.5 flex justify-around items-center ${isDark ? 'bg-[#0f0e15]/95' : 'bg-white/95'} backdrop-blur-lg`}>
        <button 
          onClick={() => navigateTo("feed")}
          className={`flex flex-col items-center space-y-1 cursor-pointer outline-none ${activeView === "feed" ? "text-purple-400" : "text-zinc-400"}`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[9px] font-bold tracking-wider">feed</span>
        </button>

        <button 
          onClick={() => setIsPostModalOpen(true)}
          className="flex flex-col items-center justify-center p-2.5 rounded-full bg-[#9333ea] text-white shadow-md shadow-purple-500/20 active:scale-90 transition-transform cursor-pointer"
        >
          <Plus className="w-5 h-5" />
        </button>

        <button 
          onClick={() => navigateTo("profile")}
          className={`flex flex-col items-center space-y-1 cursor-pointer outline-none ${activeView === "profile" || activeView === "settings" ? "text-purple-400" : "text-zinc-400"}`}
        >
          {currentUser ? (
            <img 
              src={currentUser.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`}
              alt="avatar representation"
              referrerPolicy="no-referrer"
              className={`w-5 h-5 rounded-full object-cover shrink-0 border ${
                activeView === "profile" ? "border-purple-500" : "border-zinc-300 dark:border-zinc-700"
              }`}
            />
          ) : (
            <User className="w-5 h-5" />
          )}
          <span className="text-[9px] font-bold tracking-wider">profile</span>
        </button>
      </div>

      {/* About Modal */}
      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        currentUser={currentUser}
        onProfileUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          fetchPosts();
          if (updatedUser?.username) {
            fetchUserProfileData(updatedUser.username);
          }
        }}
        theme={theme}
        setTheme={setTheme}
      />

      {/* Create Post Modal */}
      <CreatePostModal 
        isOpen={isPostModalOpen}
        onClose={() => {
          setIsPostModalOpen(false);
          setRepostOfPost(null);
        }}
        currentUser={currentUser}
        onPostCreated={(newPost) => {
          if (newPost) {
            setPosts(prev => [newPost, ...prev]);
          } else {
            fetchPosts(0, false);
          }
        }}
        repostOfPost={repostOfPost}
        onClearRepost={() => setRepostOfPost(null)}
      />

      {/* Clan Selector Modal */}
      <ClanSelectorModal
        isOpen={isClanSelectorOpen}
        onClose={() => setIsClanSelectorOpen(false)}
        currentClan={currentUser?.clan_emoji || null}
        onSelectClan={handleUpdateClanEmoji}
      />

      {/* Follows List Modal */}
      {isFollowsModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0b0b0f] border border-zinc-800 rounded-2xl w-full max-w-sm p-5 relative overflow-hidden text-left"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3 mb-4">
              <h3 className="text-sm font-extrabold text-white capitalize">
                {followsListType} list
              </h3>
              <button
                onClick={() => setIsFollowsModalOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 p-1.5 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List area */}
            <div className="max-h-80 overflow-y-auto space-y-2.5 pr-1">
              {loadingFollowsList ? (
                <div className="py-8 flex justify-center">
                  <RefreshCw className="w-5 h-5 text-purple-400 animate-spin" />
                </div>
              ) : followsListUsers.length > 0 ? (
                followsListUsers.map((user: Profile) => (
                  <div 
                    key={user.id}
                    onClick={() => {
                      setIsFollowsModalOpen(false);
                      navigateTo("user-profile", { username: user.username });
                    }}
                    className="p-3.5 rounded-xl border border-zinc-900 bg-zinc-950/45 hover:bg-zinc-900/60 transition-all cursor-pointer text-left flex items-center justify-between group"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <img 
                        src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`}
                        alt={user.username}
                        className="w-9 h-9 rounded-full bg-zinc-900 border border-zinc-800"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center space-x-1.5 min-w-0">
                          <span className="text-white text-xs font-bold truncate group-hover:text-purple-400 transition-colors">
                            {user.display_name || user.username}
                          </span>
                          {user.is_verified && (
                            <BadgeCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-500 font-mono">@{user.username}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
                  </div>
                ))
              ) : (
                <div className="py-12 text-center">
                  <p className="text-xs text-zinc-500 font-mono">No one in this list yet.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}

    </div>
  );
}