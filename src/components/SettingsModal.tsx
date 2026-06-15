/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check, Upload, Disc, User, FileText, BadgeCheck } from "lucide-react";
import { supabase } from "../lib/supabase";
import { UserSessionData } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSessionData | null;
  onProfileUpdated: (updatedUser: UserSessionData) => void;
  theme: "dark" | "white";
  setTheme: (t: "dark" | "white") => void;
}

export const STARTORIGIN_CLANS = [
  { emoji: "💻", name: "Cyber Code Alliance" },
  { emoji: "🎨", name: "Creative Art Guild" },
  { emoji: "🧪", name: "Science & Tech Labs" },
  { emoji: "🦉", name: "Writers & Thought Hub" },
  { emoji: "💎", name: "Elite VIP Club" },
  { emoji: "👽", name: "Rebels Outpost" },
  { emoji: "⚡", name: "Volt Energy Shock" },
  { emoji: "📈", name: "Alpha Traders Guild" },
  { emoji: "🍕", name: "Foodie Crew" },
  { emoji: "🎵", name: "Synth Music Group" },
];

export default function SettingsModal({
  isOpen,
  onClose,
  currentUser,
  onProfileUpdated,
  theme,
  setTheme,
}: SettingsModalProps) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [discord, setDiscord] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState(false);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // Synchronize when opened
  useEffect(() => {
    if (isOpen && currentUser) {
      setName(currentUser.display_name || "");
      setUsername(currentUser.username || "");
      setDiscord(currentUser.discord || "");
      setAvatarUrl(currentUser.avatar_url || "");
      setErrorMsg(null);
      setSuccessMsg(false);

      let cleanBioText = "";
      let banner = "";
      try {
        const parsed = JSON.parse(currentUser.bio || "{}");
        if (typeof parsed === "object" && parsed !== null) {
          cleanBioText = parsed.text || parsed.bio || "";
          banner = parsed.banner_url || "";
        } else {
          cleanBioText = currentUser.bio || "";
        }
      } catch (e) {
        cleanBioText = currentUser.bio || "";
      }
      setBio(cleanBioText);
      setBannerUrl(banner);
    }
  }, [isOpen, currentUser]);

  if (!isOpen || !currentUser) return null;

  // Check if string contains any emoji characters
  const containsEmoji = (str: string) => {
    const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
    return emojiRegex.test(str);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1.5 * 1024 * 1024) {
      setErrorMsg("Avatar image must be under 1.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.0 * 1024 * 1024) {
      setErrorMsg("Banner image must be under 2.0MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setBannerUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(false);

    try {
      // 1. Emoji Block Validation for the display name
      if (containsEmoji(name)) {
        setErrorMsg("Emojis are not allowed in your Display Name. Please use standard characters.");
        setLoading(false);
        return;
      }

      // 2. Validate format of User Handle
      const cleanUsername = username.trim().toLowerCase();
      if (!/^[a-z0-9._]+$/.test(cleanUsername)) {
        setErrorMsg("Username can only contain lowercase letters, numbers, dots and underscores.");
        setLoading(false);
        return;
      }

      // Checking uniqueness
      if (cleanUsername !== currentUser.username) {
        const { data: existingUser } = await supabase
          .from("profiles")
          .select("username")
          .ilike("username", cleanUsername)
          .neq("id", currentUser.id)
          .maybeSingle();

        if (existingUser) {
          setErrorMsg("This username handle is already taken.");
          setLoading(false);
          return;
        }
      }

      let existingBioData: any = {};
      try {
        existingBioData = JSON.parse(currentUser.bio || "{}");
        if (typeof existingBioData !== "object" || existingBioData === null) {
          existingBioData = {};
        }
      } catch (e) {
        existingBioData = {};
      }

      // Serialize bio + banner_url
      const serializedBio = JSON.stringify({
        ...existingBioData,
        text: bio.trim(),
        banner_url: bannerUrl.trim(),
      });

      // Saving updates to database
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          display_name: name.trim(),
          bio: serializedBio,
          discord: discord.trim(),
          avatar_url: avatarUrl.trim() || null,
          username: cleanUsername,
          clan_emoji: currentUser.clan_emoji || null,
        })
        .eq("id", currentUser.id);

      if (updateError) throw updateError;

      // Formulate success state
      const updatedData: UserSessionData = {
        ...currentUser,
        display_name: name.trim(),
        bio: serializedBio,
        discord: discord.trim(),
        avatar_url: avatarUrl.trim() || null,
        username: cleanUsername,
        clan_emoji: currentUser.clan_emoji || null,
      };

      onProfileUpdated(updatedData);
      setSuccessMsg(true);
      setTimeout(() => {
        setSuccessMsg(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Failed to update configurations.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div id="settings-modal-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
        <motion.div
          id="settings-modal-container"
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: "spring", duration: 0.4 }}
          className="bg-[#0b0b0f] border border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative overflow-hidden my-8"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4 mb-5">
            <div className="flex flex-col text-left">
              <h2 className="text-base font-extrabold text-white">profile configurations</h2>
              <p className="text-[10px] text-zinc-500 font-mono mt-0.5">edit credentials & design</p>
            </div>
            <button
              id="close-settings-modal"
              onClick={onClose}
              className="text-zinc-450 hover:text-white transition-colors bg-zinc-900 border border-zinc-800 hover:border-zinc-700 p-1.5 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Visual Header Customizer banner (NO LINKS INPUTS) */}
            <div className="space-y-1.5 text-left">
              <label className="text-[10px] font-bold text-zinc-400">
                profile banner & avatar (click to upload directly)
              </label>
              
              <div 
                onClick={() => bannerInputRef.current?.click()}
                className="relative h-24 rounded-xl overflow-hidden bg-cover bg-center cursor-pointer border border-zinc-800 hover:border-zinc-650 transition-all flex items-center justify-center group"
                style={{ 
                  backgroundImage: bannerUrl 
                    ? `url(${bannerUrl})` 
                    : "linear-gradient(to right, #1a0b2e, #0c0211)" 
                }}
              >
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="text-white text-xs font-bold flex items-center space-x-1.5 bg-black/60 px-3 py-1.5 rounded-lg border border-white/10">
                    <Upload className="w-3.5 h-3.5" />
                    <span>upload cover banner</span>
                  </div>
                </div>
                {!bannerUrl && (
                  <span className="text-[10px] font-mono text-purple-400 group-hover:opacity-0 transition-opacity">select custom banner</span>
                )}

                {/* Avatar Preview Floating Inside Banner */}
                <div 
                  onClick={(e) => {
                    e.stopPropagation(); // prevent triggering banner upload
                    avatarInputRef.current?.click();
                  }}
                  className="absolute bottom-2 left-3 w-14 h-14 rounded-full bg-zinc-900 overflow-hidden border-2 border-[#0b0b0f] cursor-pointer group/avatar shrink-0 z-10"
                >
                  <img 
                    src={avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(username || "guest")}`} 
                    alt="avatar preview" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/65 opacity-0 group-hover/avatar:opacity-100 transition-opacity flex items-center justify-center">
                    <Upload className="w-4 h-4 text-white" />
                  </div>
                </div>
              </div>

              {/* Hidden File Inputs */}
              <input 
                type="file" 
                ref={avatarInputRef}
                onChange={handleAvatarSelect}
                className="hidden" 
                accept="image/*"
              />
              <input 
                type="file" 
                ref={bannerInputRef}
                onChange={handleBannerSelect}
                className="hidden" 
                accept="image/*"
              />
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-zinc-400">display name</label>
                <input 
                  type="text"
                  required
                  maxLength={40}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. jocko smith"
                  className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-90 w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600"
                />
                <span className="text-[9px] text-zinc-550 block leading-tight">no emojis allowed.</span>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold tracking-wider text-zinc-400">username handle</label>
                <input 
                  type="text"
                  required
                  maxLength={25}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. jocko_smith"
                  className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-90 w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600"
                />
              </div>
            </div>

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold tracking-wider text-zinc-400">discord connection tag</label>
              <input 
                type="text"
                maxLength={35}
                value={discord}
                onChange={(e) => setDiscord(e.target.value)}
                placeholder="e.g. jockosmith#4321"
                className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 bg-zinc-950 w-full bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600"
              />
            </div>



            <div className="space-y-1 text-left">
              <label className="text-[10px] font-bold tracking-wider text-zinc-400">biography (about me)</label>
              <textarea
                rows={3}
                maxLength={250}
                placeholder="write some background information..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl px-3.5 py-2 text-base focus:outline-none focus:ring-1 focus:ring-purple-500/50 resize-none bg-zinc-900 border border-zinc-800 text-zinc-100 placeholder-zinc-600"
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-mono">
                <span>maximum 250 characters.</span>
                <span>{bio.length} / 250</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-950/20 border border-red-500/10 text-red-400 rounded-xl text-xs font-semibold text-left">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="p-3 bg-green-950/20 border border-green-500/10 text-green-400 rounded-xl text-xs font-bold flex items-center space-x-1.5 justify-start">
                <Check className="w-4 h-4 text-green-400 shrink-0 animate-bounce" />
                <span>configurations updated successfully!</span>
              </div>
            )}

            <div className="pt-3">
              <button 
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-650/30 text-white font-bold text-xs rounded-xl cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
              >
                {loading ? "registering configs..." : "save profile configurations"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
