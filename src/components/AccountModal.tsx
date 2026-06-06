/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, LogIn, UserPlus, Key, Info, Mail, User, BookOpen, AlertCircle, Sparkles, Check, Disc, MessageSquare, LogOut, ChevronRight, Upload } from "lucide-react";
import { UserSessionData, Post } from "../types";
import { formatRelativeTime } from "../utils";
import { supabase } from "../lib/supabase";

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSessionData | null;
  onAuthSuccess: (user: UserSessionData, shouldClose?: boolean) => void;
  onLogout: () => void;
  onPostDeleted?: () => void;
  onPostCreated?: () => void;
}

export default function AccountModal({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
  onLogout,
  onPostDeleted,
  onPostCreated
}: AccountModalProps) {
  // Forms tab switcher
  const [authView, setAuthView] = useState<"login" | "register">("login");

  // Registration Fields
  const [regName, setRegName] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regSuccess, setRegSuccess] = useState<string | null>(null);

  // Login Fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // User Profile Customization fields (for editing)
  const [editName, setEditName] = useState(currentUser?.display_name || "");
  const [editBio, setEditBio] = useState(currentUser?.bio || "");
  const [editDiscord, setEditDiscord] = useState(currentUser?.discord || "");
  const [editAvatarUrl, setEditAvatarUrl] = useState(currentUser?.avatar_url || "");
  const [editUsername, setEditUsername] = useState(currentUser?.username || "");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState(false);

  // Email Verification System State
  const [resendingVerification, setResendingVerification] = useState(false);
  const [isEmailVerified, setIsEmailVerified] = useState(false);

  // Profile-specific posts lists & loaders
  const [profilePosts, setProfilePosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"settings" | "posts">("settings");

  // Load email verification status
  useEffect(() => {
    const checkVerification = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setIsEmailVerified(user?.email_confirmed_at !== null);
    };
    if (currentUser) {
      checkVerification();
    }
  }, [currentUser]);

  // Update edit fields when currentUser changes
  useEffect(() => {
    if (currentUser && isOpen) {
      setEditName(currentUser.display_name || "");
      setEditBio(currentUser.bio || "");
      setEditDiscord(currentUser.discord || "");
      setEditAvatarUrl(currentUser.avatar_url || "");
      setEditUsername(currentUser.username || "");
    }
  }, [currentUser, isOpen]);

  // Fetch current user posts list for reference
  const loadMyPosts = async () => {
    if (!currentUser) return;
    try {
      setPostsLoading(true);
      
      const { data: posts, error } = await supabase
        .from("posts")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      setProfilePosts(posts || []);
    } catch (e) {
      console.error("Failed to load user posts", e);
    } finally {
      setPostsLoading(false);
    }
  };

  // Handle register
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regUsername || !regEmail || !regPassword) {
      setRegError("Please fill in all fields.");
      return;
    }
    const cleanUsername = regUsername.trim().toLowerCase();
    if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
      setRegError("Username can only contain lowercase letters, numbers, dots and underscores.");
      return;
    }

    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters long.");
      return;
    }

    try {
      setRegLoading(true);
      setRegError(null);
      setRegSuccess(null);

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          data: {
            display_name: regName.trim(),
            username: cleanUsername,
          }
        }
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            id: authData.user.id,
            username: cleanUsername,
            display_name: regName.trim(),
            email: regEmail.trim(),
            bio: "",
            discord: "",
          });

        if (profileError) {
          console.error("Profile creation error:", profileError);
          setRegError("Account created but profile setup failed. Please try logging in.");
          return;
        }

        setRegSuccess("Successfully registered! Please check your email to verify your account.");
        
        setRegName("");
        setRegUsername("");
        setRegEmail("");
        setRegPassword("");
        
        setTimeout(() => {
          setAuthView("login");
          setRegSuccess(null);
        }, 2000);
      }
    } catch (err: any) {
      console.error("Registration error:", err);
      setRegError(err.message || "Failed to register.");
    } finally {
      setRegLoading(false);
    }
  };

  // Handle Log In — ТОЛЬКО ПО EMAIL
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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
          setLoginError("Please verify your email before logging in. Check your inbox and spam folder.");
        } else {
          setLoginError("Invalid email or password.");
        }
        return;
      }

      if (authData.user) {
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", authData.user.id)
          .maybeSingle();

        if (profileError || !profile) {
          setLoginError("Profile not found. Please contact support.");
          return;
        }

        const userData: UserSessionData = {
          id: profile.id,
          username: profile.username,
          display_name: profile.display_name,
          bio: profile.bio,
          discord: profile.discord,
          avatar_url: profile.avatar_url,
          is_verified: profile.is_verified,
          created_at: profile.created_at,
          email: authData.user.email
        };

        localStorage.setItem("token", authData.session?.access_token || "");
        localStorage.setItem("userId", authData.user.id);
        onAuthSuccess(userData);
        
        setEditName(userData.display_name || "");
        setEditBio(userData.bio || "");
        setEditDiscord(userData.discord || "");
        setEditAvatarUrl(userData.avatar_url || "");
        setActiveTab("settings");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError("A network error occurred during login.");
    } finally {
      setLoginLoading(false);
    }
  };

  // Handle Resend Verification Email
  const handleResendVerification = async () => {
    if (!currentUser || !currentUser.email) {
      alert("No email address found or user session is invalid.");
      return;
    }
    try {
      setResendingVerification(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: currentUser.email,
      });
      
      if (error) throw error;
      
      alert("Verification email resent successfully! Please check your inbox (and spam folder) for the verification link.");
    } catch (e: any) {
      console.error("Resend error:", e);
      alert(e.message || "Failed to resend verification email. Please try again later.");
    } finally {
      setResendingVerification(false);
    }
  };

  // Handle Edit profile
  const handleUpdateProfile = async (e: React.FormEvent) => {
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
        const { data: existingUser, error: checkError } = await supabase
          .from("profiles")
          .select("username")
          .eq("username", cleanUsername)
          .neq("id", currentUser.id)
          .maybeSingle();
        
        if (checkError) throw checkError;
        if (existingUser) {
          setEditError("Username is already taken.");
          setEditLoading(false);
          return;
        }
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: editName,
          bio: editBio,
          discord: editDiscord,
          avatar_url: editAvatarUrl || null,
          username: cleanUsername,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      setEditSuccess(true);
      
      const { data: freshProfile, error: freshError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (!freshError && freshProfile) {
        const updatedUser: UserSessionData = {
          ...currentUser,
          display_name: freshProfile.display_name,
          bio: freshProfile.bio,
          discord: freshProfile.discord,
          avatar_url: freshProfile.avatar_url,
          username: freshProfile.username,
        };
        onAuthSuccess(updatedUser, false);
      }
      
      setTimeout(() => setEditSuccess(false), 3000);
    } catch (err: any) {
      console.error("Profile update error:", err);
      setEditError(err.message || "Failed to update profile settings.");
    } finally {
      setEditLoading(false);
    }
  };

  // Delete own post inside list
  const handleDeleteOwnPost = async (postId: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId);
      
      if (error) throw error;
      
      setProfilePosts(profilePosts.filter(p => p.id !== postId));
      if (onPostDeleted) onPostDeleted();
    } catch (e) {
      console.error("Delete error:", e);
      alert("Error deleting post.");
    }
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setEditError("Avatar image is too large. Choose an image under 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setEditAvatarUrl(reader.result as string);
      setEditError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle resend verification from login screen
  const handleResendFromLogin = async () => {
    if (!loginEmail.trim()) {
      alert("Please enter your email first to request a resend.");
      return;
    }
    
    try {
      setResendingVerification(true);
      
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: loginEmail.trim(),
      });
      
      if (error) throw error;
      
      alert("Verification link resent! Please check your inbox and spam folder.");
    } catch (e: any) {
      console.error("Resend error:", e);
      alert(e.message || "Failed to resend verification email.");
    } finally {
      setResendingVerification(false);
    }
  };

  // Компонент для отображения статуса верификации
  const VerificationStatus = () => {
    if (isEmailVerified) {
      return (
        <span className="text-[9px] bg-green-500/25 text-green-300 px-2.5 py-0.5 rounded-full border border-green-500/40 flex items-center space-x-1 font-semibold">
          <Check className="w-2.5 h-2.5 text-green-400" />
          <span>Verified Email</span>
        </span>
      );
    }
    
    return (
      <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
        <span className="text-[9px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-semibold">
          Unverified Email
        </span>
        <button
          type="button"
          onClick={handleResendVerification}
          disabled={resendingVerification}
          className="text-[9px] bg-purple-900/40 hover:bg-purple-800 text-purple-200 border border-purple-800/40 px-2 py-0.5 rounded-full transition-colors font-semibold cursor-pointer"
        >
          {resendingVerification ? "Sending..." : "Verify now"}
        </button>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div id="auth-modal-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            id="auth-modal-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-[#08070b] border border-slate-900 rounded-2xl w-full max-w-md max-h-[85vh] flex flex-col relative overflow-hidden shadow-2xl shadow-purple-950/20"
          >
            {/* Ambient visual line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/30 to-transparent" />

            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-slate-900/80 px-5 py-4 shrink-0">
              <span className="text-sm font-semibold tracking-wider uppercase text-purple-400 font-display">
                {currentUser ? "Account Control" : "Account Access"}
              </span>
              <button
                id="close-auth-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors bg-slate-900 p-1.5 rounded-lg border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main scrollable body */}
            {!currentUser ? (
              /* LOGGED OUT AUTHORIZATION FORM */
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-5">
                
                {/* Form Selection Selector */}
                <div className="grid grid-cols-2 p-1 bg-slate-950 border border-slate-900 rounded-xl shrink-0">
                  <button
                    onClick={() => {
                      setAuthView("login");
                      setLoginError(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      authView === "login"
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/20 shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Login
                  </button>
                  <button
                    onClick={() => {
                      setAuthView("register");
                      setRegError(null);
                    }}
                    className={`py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      authView === "register"
                        ? "bg-purple-600/20 text-purple-300 border border-purple-500/20 shadow-sm"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Quick Sign Up
                  </button>
                </div>

                {/* LOGIN FORM - ТОЛЬКО ПО EMAIL */}
                {authView === "login" ? (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Email Address</label>
                      <input
                        id="login-email-input"
                        type="email"
                        required
                        placeholder="your@email.com"
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Password</label>
                      <input
                        id="login-pass-input"
                        type="password"
                        required
                        placeholder="••••••••"
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none transition-all"
                      />
                    </div>

                    {loginError && (
                      <div className="space-y-2">
                        <div className="bg-red-950/20 border border-red-900/20 text-red-400 p-2.5 rounded-xl text-xs flex items-center space-x-2">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>{loginError}</span>
                        </div>
                        {(loginError.toLowerCase().includes("verify") || loginError.toLowerCase().includes("confirm")) && (
                          <button
                            type="button"
                            onClick={handleResendFromLogin}
                            disabled={resendingVerification}
                            className="text-[11px] text-purple-400 hover:text-purple-300 underline block cursor-pointer transition-colors text-left font-medium"
                          >
                            {resendingVerification ? "Sending email..." : "Didn't receive verification email? Click to resend"}
                          </button>
                        )}
                      </div>
                    )}

                    <button
                      id="login-submit-btn"
                      type="submit"
                      disabled={loginLoading}
                      className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl text-xs text-white transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-md shadow-purple-500/10"
                    >
                      {loginLoading ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span>Sign In</span>
                      )}
                    </button>
                  </form>
                ) : (
                  /* REGISTER FORM */
                  <form onSubmit={handleRegister} className="space-y-3.5">
                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Display Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Public name (e.g. Jane Doe)"
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Username Handle</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. dots.and_underscores"
                        value={regUsername}
                        onChange={(e) => setRegUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Email (Private)</label>
                      <input
                        type="email"
                        required
                        placeholder="email@address.com"
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] uppercase font-semibold text-slate-500 tracking-wider">Password (6+ Chars)</label>
                      <input
                        type="password"
                        required
                        minLength={6}
                        placeholder="••••••••"
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 focus:outline-none"
                      />
                    </div>

                    {regError && (
                      <div className="bg-red-950/20 border border-red-900/20 text-red-400 p-2.5 rounded-xl text-xs">
                        {regError}
                      </div>
                    )}

                    {regSuccess && (
                      <div className="bg-[#112d22] border border-[#1d4c38] text-green-300 p-2.5 rounded-xl text-xs flex items-start space-x-2">
                        <Check className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                        <span>{regSuccess}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={regLoading}
                      className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl text-xs text-white transition-all flex items-center justify-center cursor-pointer shadow-md shadow-purple-500/10"
                    >
                      {regLoading ? "Registering..." : "Sign Up"}
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* LOGGED IN ACCOUNT CONTROL PANEL (без изменений) */
              <div className="flex-1 flex flex-col min-h-0">
                {/* Tabs switcher header */}
                <div className="grid grid-cols-2 border-b border-slate-900 p-2 shrink-0 bg-[#0c0a10]/50">
                  <button
                    onClick={() => setActiveTab("settings")}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      activeTab === "settings"
                        ? "bg-purple-900/20 text-purple-300 border border-purple-500/10"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    Customization
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab("posts");
                      loadMyPosts();
                    }}
                    className={`py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer ${
                      activeTab === "posts"
                        ? "bg-purple-900/20 text-purple-300 border border-purple-500/10"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    My Posts ({profilePosts.length || "0"})
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 md:p-6 min-h-0">
                  {/* SETTINGS OPTION */}
                  {activeTab === "settings" && (
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                      {/* Avatar visual card picker */}
                      <div className="flex items-center space-x-4 bg-slate-950/40 border border-slate-900 p-3.5 rounded-xl">
                        <img
                          src={editAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(currentUser.username)}`}
                          alt="avatar visualization reference"
                          className="w-14 h-14 bg-slate-950 border border-slate-900 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-slate-200 font-bold text-sm truncate">{currentUser.display_name || currentUser.username}</h4>
                          <p className="text-[10px] text-purple-400 font-mono">@{currentUser.username}</p>
                          <div className="flex items-center space-x-1.5 mt-1.5 flex-wrap gap-y-1">
                            <VerificationStatus />
                          </div>
                        </div>
                      </div>

                      {/* Name input */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Display Name</label>
                        <input
                          type="text"
                          required
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Public handle signee"
                          className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>

                      {/* Username input */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-mono text-purple-400">Username Handle</label>
                        <input
                          type="text"
                          required
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                          placeholder="e.g. dots.and_underscores"
                          className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none font-mono"
                        />
                      </div>

                      {/* Bio text */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Bio Biography</label>
                        <textarea
                          rows={3}
                          value={editBio}
                          onChange={(e) => setEditBio(e.target.value)}
                          placeholder="Tell us about yourself..."
                          className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none resize-none"
                        />
                      </div>

                      {/* Discord Handle */}
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Discord Username (for connections)</label>
                        <input
                          type="text"
                          value={editDiscord}
                          onChange={(e) => setEditDiscord(e.target.value)}
                          placeholder="e.g. mystic_wanderer"
                          className="w-full bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                        />
                      </div>

                      {/* DEVICE AVATAR UPLOAD AND CUSTOM PHOTO */}
                      <div className="space-y-1.5 border-t border-slate-900 pt-3">
                        <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">Avatar Asset (Device upload & URL)</label>
                        <div className="flex flex-col sm:flex-row gap-2.5">
                          <label className="bg-purple-950/40 hover:bg-purple-900/40 border border-purple-500/25 text-purple-300 px-4 py-2.5 rounded-xl text-xs font-bold cursor-pointer transition-all text-center flex items-center justify-center space-x-2 shrink-0 select-none">
                            <Upload className="w-3.5 h-3.5 text-purple-400" />
                            <span>From Device</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleAvatarFileChange}
                            />
                          </label>
                          <input
                            type="text"
                            value={editAvatarUrl}
                            onChange={(e) => setEditAvatarUrl(e.target.value)}
                            placeholder="Or paste direct image address URL..."
                            className="flex-1 bg-[#121118] border border-slate-900 focus:border-purple-500/30 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none"
                          />
                        </div>
                      </div>

                      {editError && (
                        <div className="bg-red-950/20 border border-red-900/20 text-red-400 p-2 rounded-xl text-xs">
                          {editError}
                        </div>
                      )}

                      {editSuccess && (
                        <div className="bg-[#112d22] border border-[#1d4c38] text-green-300 p-2 rounded-xl text-xs flex items-center justify-center space-x-1.5">
                          <Check className="w-4 h-4 text-green-400" />
                          <span>Customizations saved successfully!</span>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={editLoading}
                        className="w-full bg-purple-600 hover:bg-purple-500 font-bold py-3 rounded-xl text-xs text-white transition-all cursor-pointer"
                      >
                        {editLoading ? "Saving Changes..." : "Save Profile Customizations"}
                      </button>
                    </form>
                  )}

                  {/* PROFILE SELF-PUBLISHED POSTS LIST */}
                  {activeTab === "posts" && (
                    <div className="space-y-4">
                      {postsLoading ? (
                        <div className="py-12 flex flex-col items-center justify-center space-y-2">
                          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                          <p className="text-[10px] text-slate-600">Gathering entries...</p>
                        </div>
                      ) : profilePosts.length === 0 ? (
                        <div className="py-12 text-center text-xs text-slate-500 border border-dashed border-slate-900 rounded-xl">
                          You haven't written any publications under this handle yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {profilePosts.map((p) => {
                            const separator = "\n\n---STARTORIGIN_METADATA_JSON---";
                            const mainTxt = p.content.split(separator)[0];
                            return (
                              <div key={p.id} className="bg-slate-950/30 border border-slate-900 p-3 rounded-xl flex items-start justify-between space-x-2.5 text-xs">
                                <div className="flex-1 min-w-0 space-y-1">
                                  <span className="text-[9px] text-purple-400 font-mono block border-b border-slate-900 pb-1">
                                    {formatRelativeTime(p.created_at)}
                                  </span>
                                  <p className="text-slate-300 line-clamp-2 leading-relaxed pt-1">
                                    {mainTxt}
                                  </p>
                                </div>
                                <button
                                  onClick={() => handleDeleteOwnPost(p.id)}
                                  className="text-red-400/70 hover:text-red-400 transition-colors cursor-pointer shrink-0"
                                  title="Delete post"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Logged in details segment */}
                <div className="border-t border-slate-900 px-5 py-4 shrink-0 bg-[#0c0a10]/65 flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-mono">Mapped: @{currentUser.username}</span>
                  <button
                    onClick={onLogout}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-red-900/20 hover:bg-red-950/10 text-xs text-red-400 hover:text-red-350 transition-all cursor-pointer font-bold uppercase tracking-wider text-[9px]"
                  >
                    <LogOut className="w-3 h-3 text-red-550 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}