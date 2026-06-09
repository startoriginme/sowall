/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Send, UserCheck, ShieldAlert, Sparkles, Hash, Paperclip, BarChart3, Plus, Trash2, Image, X, Repeat } from "lucide-react";
import { UserSessionData, Post } from "../types";
import { supabase } from "../lib/supabase";
import SlidingCaptcha from "./SlidingCaptcha";

interface PostFormProps {
  currentUser: UserSessionData | null;
  onPostCreated: () => void;
  onClose?: () => void;
  repostOfPost?: Post | null;
  onClearRepost?: () => void;
}

export default function PostForm({ currentUser, onPostCreated, onClose, repostOfPost, onClearRepost }: PostFormProps) {
  const [content, setContent] = useState("");
  const [postMode, setPostMode] = useState<"anonymous" | "custom" | "account">(currentUser ? "account" : "anonymous");
  const [customName, setCustomName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [postCaptchaPassed, setPostCaptchaPassed] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  React.useEffect(() => {
    const checkCooldown = () => {
      const lastPostString = localStorage.getItem("last_post_time");
      if (lastPostString) {
        const lastPostTime = parseInt(lastPostString, 10);
        const elapsed = Date.now() - lastPostTime;
        const cooldownMs = 5 * 60 * 1000;
        if (elapsed < cooldownMs) {
          setCooldownSeconds(Math.ceil((cooldownMs - elapsed) / 1000));
        } else {
          setCooldownSeconds(0);
        }
      } else {
        setCooldownSeconds(0);
      }
    };

    checkCooldown();
    const interval = setInterval(checkCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Attachment states
  const [attachedFile, setAttachedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll states
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2.5 * 1024 * 1024) {
      setErrorMsg("File is too large. High contrast files should be under 2.5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedFile({
        name: file.name,
        type: file.type,
        data: reader.result as string,
      });
      setErrorMsg(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAddPollOption = () => {
    if (pollOptions.length < 5) {
      setPollOptions([...pollOptions, ""]);
    }
  };

  const handleRemovePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      const updated = pollOptions.filter((_, i) => i !== index);
      setPollOptions(updated);
    }
  };

  const handleUpdateOptionText = (index: number, val: string) => {
    const updated = [...pollOptions];
    updated[index] = val;
    setPollOptions(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postCaptchaPassed) {
      setErrorMsg("Please drag the slider to verify before publishing.");
      return;
    }
    if (!content.trim()) {
      setErrorMsg("Please enter text content for your publication.");
      return;
    }
    if (postMode === "custom" && !customName.trim()) {
      setErrorMsg("Please specify a custom authorship name.");
      return;
    }

    // Assemble metadata
    let finalContent = content.trim();
    const metadata: any = {};

    if (attachedFile) {
      metadata.attachment = attachedFile;
    }

    if (showPollCreator && pollQuestion.trim()) {
      const activeOptions = pollOptions.map(opt => opt.trim()).filter(opt => opt !== "");
      if (activeOptions.length < 2) {
        setErrorMsg("Please input at least 2 non-empty options for the poll.");
        return;
      }
      metadata.poll = {
        question: pollQuestion.trim(),
        options: activeOptions,
        votes: {},
        voters: [],
      };
    }

    if (repostOfPost) {
      metadata.repost = {
        id: repostOfPost.id,
        content: repostOfPost.content,
        author_name: repostOfPost.author_name,
        created_at: repostOfPost.created_at,
        user_id: repostOfPost.user_id,
        profiles: repostOfPost.profiles,
      };
    }

    if (Object.keys(metadata).length > 0) {
      const separator = "\n\n---STARTORIGIN_METADATA_JSON---";
      finalContent = `${finalContent}${separator}${JSON.stringify(metadata)}`;
    }

    try {
      setLoading(true);
      setErrorMsg(null);

      let user_id: string | null = null;
      let author_name = "Anonymous";

      if (postMode === "account" && currentUser) {
        user_id = currentUser.id;
        author_name = currentUser.display_name || currentUser.username || "User";
      } else if (postMode === "custom" && customName.trim() !== "") {
        author_name = customName.trim();
      }

      const { data: postData, error: postErr } = await supabase
        .from("posts")
        .insert({
          content: finalContent,
          author_name,
          user_id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (postErr) throw postErr;

      // Handle repost creation as well if modern repost table is used/exists
      if (repostOfPost && postData) {
        try {
          await supabase
            .from("reposts")
            .insert({
              post_id: postData.id,
              original_post_id: repostOfPost.id,
              user_id: currentUser ? currentUser.id : null,
              created_at: new Date().toISOString(),
            });
        } catch (repostEx) {
          console.warn("Failed to insert into reposts table, but parent post succeeded:", repostEx);
        }
      }

      // Store local timestamp on success
      localStorage.setItem("last_post_time", Date.now().toString());

      // Clear form and close
      setContent("");
      setCustomName("");
      setAttachedFile(null);
      setPollQuestion("");
      setPollOptions(["", ""]);
      setShowPollCreator(false);
      setPostCaptchaPassed(false);
      if (onClearRepost) onClearRepost();
      onPostCreated();
      if (onClose) onClose();
      
    } catch (err: any) {
      console.error("Error creating post:", err);
      setErrorMsg(err.message || "Failed to publish post.");
    } finally {
      setLoading(false);
    }
  };

  const charLimit = 800;

  return (
    <div className="bg-[#0b0b0f] text-slate-200 text-left font-sans">
      <form 
        onSubmit={handleSubmit} 
        onKeyDown={(e) => {
          if (e.key === "Enter" && !postCaptchaPassed) {
            e.preventDefault();
          }
        }}
        className="space-y-4"
      >
        {/* Top input area */}
        <div className="space-y-2">
          <textarea
            id="post-content-textarea"
            rows={5}
            value={content}
            onChange={(e) => {
              if (e.target.value.length <= charLimit) {
                setContent(e.target.value);
                if (errorMsg) setErrorMsg(null);
              }
            }}
            placeholder={repostOfPost ? "Add a comment to this repost..." : "Share your thoughts anonymously..."}
            className="w-full bg-[#121118] border border-slate-800/80 focus:border-purple-500/50 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-600 text-base focus:outline-none transition-all resize-none leading-relaxed"
            autoFocus
          />
          <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
            <span>Keep it respectful and civil.</span>
            <span>{content.length} / {charLimit}</span>
          </div>
        </div>

        {/* REPOST PREVIEW EMBED */}
        {repostOfPost && (
          <div className="relative bg-[#121118]/80 border border-purple-550/15 rounded-xl p-3.5 space-y-2.5 animate-fade-in shadow-[0_0_15px_rgba(147,51,234,0.02)]">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5 font-display">
                <Repeat className="w-3.5 h-3.5" />
                <span>Reposting / Quoting</span>
              </span>
              {onClearRepost && (
                <button
                  type="button"
                  onClick={onClearRepost}
                  className="text-slate-500 hover:text-slate-200 text-[10px] font-semibold uppercase tracking-wider cursor-pointer"
                >
                  Clear Quote
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              {repostOfPost.profiles && typeof repostOfPost.profiles === "object" ? (
                <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-950 p-[1px] border border-purple-500/10 shrink-0">
                  <img
                    src={repostOfPost.profiles.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${repostOfPost.profiles.username}`}
                    alt="avatar representation"
                    className="w-full h-full rounded-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full bg-slate-900 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0 border border-slate-800">
                  {repostOfPost.author_name ? repostOfPost.author_name.charAt(0).toUpperCase() : "A"}
                </div>
              )}
              <span className="font-bold text-[11px] text-purple-200">
                {repostOfPost.profiles && typeof repostOfPost.profiles === "object" 
                  ? repostOfPost.profiles.display_name || repostOfPost.profiles.username 
                  : repostOfPost.author_name || "Anonymous"
                }
              </span>
              {repostOfPost.profiles && typeof repostOfPost.profiles === "object" && (
                <span className="text-slate-500 font-mono text-[10px]">@{repostOfPost.profiles.username}</span>
              )}
            </div>

            <p className="text-slate-350 text-xs truncate leading-relaxed pl-1 max-w-md">
              {repostOfPost.content.split("\n\n---STARTORIGIN_METADATA_JSON---")[0]}
            </p>
          </div>
        )}

        {/* FILE PREVIEW BLOCK */}
        {attachedFile && (
          <div className="relative bg-[#121118]/80 border border-purple-500/20 rounded-xl p-3 flex items-start justify-between space-x-2 animate-fade-in shadow-[0_0_15px_rgba(147,51,234,0.03)]">
            <div className="flex items-center space-x-3 min-w-0">
              {attachedFile.type.startsWith("image/") ? (
                <img
                  src={attachedFile.data}
                  alt="attached raw display"
                  className="w-12 h-12 rounded-lg object-cover bg-slate-950 border border-slate-800 shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-purple-950/20 border border-purple-500/10 rounded-lg flex items-center justify-center text-purple-400 font-bold shrink-0">
                  📁
                </div>
              )}
              <div className="min-w-0">
                <p className="text-xs text-slate-200 font-semibold truncate">{attachedFile.name}</p>
                <p className="text-[10px] text-slate-500 uppercase font-mono tracking-wider">ATTACHED FILE</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAttachedFile(null)}
              className="text-slate-400 hover:text-red-400 p-1 bg-slate-900 rounded-lg border border-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* POLL CONJECTURE BLOCK */}
        {showPollCreator && (
          <div className="bg-[#121118]/80 border border-purple-500/15 rounded-xl p-3.5 space-y-3 animate-slide-down">
            <div className="flex items-center justify-between border-b border-slate-800/85 pb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 flex items-center space-x-1.5 font-display">
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Create Interactive Poll</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowPollCreator(false);
                  setPollQuestion("");
                  setPollOptions(["", ""]);
                }}
                className="text-slate-500 hover:text-slate-200 text-[10px] font-semibold uppercase tracking-wider"
              >
                Cancel Poll
              </button>
            </div>

            {/* Poll Question field */}
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 font-semibold uppercase font-sans">Poll Question</label>
              <input
                type="text"
                placeholder="What would you like to ask?"
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="w-full bg-[#161620] border border-slate-800 focus:border-purple-500/30 rounded-lg px-3 py-1.5 text-base text-slate-200 focus:outline-none"
              />
            </div>

            {/* Choices Options List */}
            <div className="space-y-2">
              <label className="text-[10px] text-slate-500 font-semibold uppercase font-sans block">Poll Options (2-5 options)</label>
              {pollOptions.map((opt, i) => (
                <div key={i} className="flex items-center space-x-2">
                  <span className="text-[10px] text-purple-400/60 font-mono w-4 shrink-0 text-center">{i + 1}</span>
                  <input
                    type="text"
                    placeholder={`Option ${i + 1}`}
                    value={opt}
                    onChange={(e) => handleUpdateOptionText(i, e.target.value)}
                    className="flex-1 bg-[#161620] border border-slate-800 focus:border-purple-500/30 rounded-lg px-3 py-1.5 text-base text-slate-250 focus:outline-none"
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePollOption(i)}
                      className="text-slate-500 hover:text-red-400 p-1.5 hover:bg-red-950/20 rounded-md transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
              
              {pollOptions.length < 5 && (
                <button
                  type="button"
                  onClick={handleAddPollOption}
                  className="flex items-center space-x-1 text-[10px] font-semibold text-purple-400 hover:text-purple-350 pt-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add another option</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Interactive action toggles for files or polls */}
        <div className="flex items-center space-x-2 bg-[#121118]/50 p-2 rounded-xl border border-slate-900/40">
          <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider pl-1.5 shrink-0">ADD TO POST:</span>
          
          {/* File Picker Toggle */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-semibold uppercase rounded-md border border-slate-800 hover:border-purple-500/20 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
          >
            <Image className="w-3.5 h-3.5 text-purple-400" />
            <span>Photo / File</span>
          </button>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*, application/pdf, .txt"
            onChange={handleFileChange}
          />

          {/* Poll Creator Toggle */}
          {!showPollCreator && (
            <button
              type="button"
              onClick={() => setShowPollCreator(true)}
              className="flex items-center space-x-1 px-2.5 py-1 text-[10px] font-semibold uppercase rounded-md border border-slate-800 hover:border-purple-500/20 text-slate-400 hover:text-slate-200 transition-all cursor-pointer"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span>Poll</span>
            </button>
          )}
        </div>

        {/* Post Authorship Selection */}
        <div className="bg-[#121118]/50 border border-slate-850 rounded-xl p-3.5">
          <span className="text-[10px] font-bold uppercase text-purple-400 tracking-wider block mb-2.5 font-display">
            Posting Mode
          </span>
          <div className="grid grid-cols-3 gap-2">
            {/* Anonymous button */}
            <button
              type="button"
              onClick={() => {
                setPostMode("anonymous");
                if (errorMsg) setErrorMsg(null);
              }}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                postMode === "anonymous"
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                  : "bg-[#121118] border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <Hash className="w-3.5 h-3.5" />
              <span>Anonymous</span>
            </button>

            {/* Custom name button */}
            <button
              type="button"
              onClick={() => {
                setPostMode("custom");
                if (errorMsg) setErrorMsg(null);
              }}
              className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                postMode === "custom"
                  ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                  : "bg-[#121118] border-slate-800/80 text-slate-400 hover:border-slate-700"
              }`}
            >
              <span>Custom Name</span>
            </button>

            {/* From Account button */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setPostMode("account");
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`flex items-center justify-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  postMode === "account"
                    ? "bg-purple-600/20 border-purple-500/40 text-purple-200"
                    : "bg-[#121118] border-slate-800/80 text-slate-400 hover:border-slate-700"
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                <span className="truncate">@{currentUser.username}</span>
              </button>
            ) : (
              <div
                className="flex items-center justify-center space-x-1 px-3 py-2 rounded-lg text-xs font-semibold border border-slate-800/80 text-slate-600 bg-[#121118]/30 cursor-not-allowed"
                title="Log in to claim authorship"
              >
                <span>👤 Signed Out</span>
              </div>
            )}
          </div>

          {/* Condition-specific fields */}
          {postMode === "custom" && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              className="mt-3"
            >
              <input
                type="text"
                maxLength={40}
                placeholder="Enter custom handle (e.g., secret_teller)"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full bg-[#161620] border border-slate-800 focus:border-purple-500/50 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-650 text-base focus:outline-none"
              />
            </motion.div>
          )}

          {postMode === "account" && currentUser && (
            <div className="mt-2 text-[10px] text-purple-400/95 flex items-start space-x-1 leading-relaxed">
              <ShieldAlert className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
              <span>Will display @{currentUser.username}. You can edit or delete this post any time.</span>
            </div>
          )}
        </div>

        {/* Error message box */}
        {errorMsg && (
          <div className="bg-red-950/20 border border-red-900/25 text-red-405 rounded-xl px-4 py-3 text-xs">
            {errorMsg}
          </div>
        )}

        {/* Submit action */}
        <div className="flex flex-col gap-3.5 pt-1.5">
          <div className="w-full">
            <SlidingCaptcha onSuccess={() => setPostCaptchaPassed(true)} resetKey={content ? 1 : 0} />
          </div>

          <div className="flex items-center justify-end">
            <button
              id="submit-post-btn"
              type="submit"
              disabled={loading || !postCaptchaPassed || cooldownSeconds > 0}
              className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-xs text-white flex items-center justify-center space-x-2 cursor-pointer shadow-md transition-all ${
                (!postCaptchaPassed || cooldownSeconds > 0)
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-800"
                  : "bg-purple-600 hover:bg-purple-500 active:bg-purple-700 shadow-purple-500/10 active:scale-98"
              }`}
            >
              {loading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Publishing...</span>
                </>
              ) : cooldownSeconds > 0 ? (
                <>
                  <span>Publish (Cooldown: {Math.floor(cooldownSeconds / 60)}m {cooldownSeconds % 60}s)</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Publish Post</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}