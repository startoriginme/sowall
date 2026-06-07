/**
 * @license
 * SPDX-License-Identifier: Apache-2.5
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { MessageSquare, Edit3, Trash2, Calendar, CornerDownRight, Check, X, ShieldAlert, BadgeCheck, Heart, BarChart3, Paperclip, FileText, Maximize2, Repeat } from "lucide-react";
import { Post, Comment, UserSessionData } from "../types";
import { formatRelativeTime } from "../utils";
import { supabase } from "../lib/supabase";
import FormattedText from "./FormattedText";

interface PostCardProps {
  key?: any;
  post: Post;
  currentUser: UserSessionData | null;
  onPostUpdated: () => void;
  onPostDeleted?: () => void;
  onOpenUserProfile: (username: string) => void;
  onClickPost?: (id: string) => void;
  adminPassword?: string;
  onRepost?: (post: Post) => void;
}

export default function PostCard({
  post,
  currentUser,
  onPostUpdated,
  onPostDeleted,
  onOpenUserProfile,
  onClickPost,
  adminPassword,
  onRepost,
}: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentContent, setCommentContent] = useState("");
  const [isAnonymousComment, setIsAnonymousComment] = useState(true);
  const [customCommentName, setCustomCommentName] = useState("");
  const [addCommentLoading, setAddCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  // Liking states
  const [likeLoading, setLikeLoading] = useState(false);
  const [voteLoading, setVoteLoading] = useState(false);

  // Parse custom metadata for attachments or polls embedded in content
  const separator = "\n\n---STARTORIGIN_METADATA_JSON---";
  const contentParts = post.content.split(separator);
  const mainContent = contentParts[0];

  let metadata: {
    attachment?: { name: string; type: string; data: string };
    poll?: {
      question: string;
      options: string[];
      votes: Record<string, number>;
      voters: string[];
    };
    repost?: {
      id: string;
      content: string;
      author_name: string;
      created_at: string;
      user_id: string | null;
      profiles?: any;
    };
  } | null = null;

  if (contentParts.length > 1) {
    try {
      metadata = JSON.parse(contentParts[1]);
    } catch (e) {
      // ignore
    }
  }

  // Generate or retrieve visitor liking/voting identifier
  const getViewerLikerId = (): string => {
    if (currentUser) return currentUser.id;
    let fallbackId = localStorage.getItem("start_origin_liker_id");
    if (!fallbackId) {
      fallbackId = "anon_liker_" + Math.random().toString(36).substring(2, 11);
      localStorage.setItem("start_origin_liker_id", fallbackId);
    }
    return fallbackId;
  };

  const viewerLikerId = getViewerLikerId();
  const hasLiked = post.post_likes ? post.post_likes.some((lik: any) => lik.liker_id === viewerLikerId || lik.user_id === viewerLikerId) : false;

  const handleToggleLike = async () => {
    if (likeLoading) return;
    try {
      setLikeLoading(true);
      
      if (hasLiked) {
        // Unlike: delete the like
        const { error } = await supabase
          .from("post_likes")
          .delete()
          .eq("post_id", post.id)
          .eq("liker_id", viewerLikerId);
        
        if (error) throw error;
      } else {
        // Like: insert new like
        const { error } = await supabase
          .from("post_likes")
          .insert({
            post_id: post.id,
            liker_id: viewerLikerId,
            user_id: currentUser?.id || null,
          });
        
        if (error) throw error;
      }
      
      onPostUpdated();
    } catch (e) {
      console.error("Failed to toggle like status", e);
    } finally {
      setLikeLoading(false);
    }
  };

  const handleVote = async (optionIndex: number) => {
    if (voteLoading || !metadata?.poll) return;
    try {
      setVoteLoading(true);
      
      // 1. Fetch the latest post content directly from Supabase to prevent overwriting other votes
      const { data: latestPost, error: fetchError } = await supabase
        .from("posts")
        .select("content")
        .eq("id", post.id)
        .single();
        
      if (fetchError || !latestPost) {
        throw new Error("Could not fetch the latest post data.");
      }

      const parts = latestPost.content.split(separator);
      const postMainContent = parts[0];
      let latestMetadata: any = {};
      if (parts.length > 1) {
        try {
          latestMetadata = JSON.parse(parts[1]);
        } catch (e) {
          latestMetadata = {};
        }
      }

      if (!latestMetadata.poll) {
        throw new Error("This post does not contain a poll.");
      }

      // Initialize tracking arrays
      if (!latestMetadata.poll.voters) {
        latestMetadata.poll.voters = [];
      }
      if (!latestMetadata.poll.votes) {
        latestMetadata.poll.votes = {};
      }

      // Prevent duplicate voting
      if (latestMetadata.poll.voters.includes(viewerLikerId)) {
        throw new Error("You've already voted in this poll.");
      }

      // Increment selection index
      const currentCount = latestMetadata.poll.votes[optionIndex] || 0;
      latestMetadata.poll.votes[optionIndex] = currentCount + 1;
      latestMetadata.poll.voters.push(viewerLikerId);

      // Assembly back
      const updatedContent = `${postMainContent}${separator}${JSON.stringify(latestMetadata)}`;

      // Update the database record directly
      const { error: updateError } = await supabase
        .from("posts")
        .update({ content: updatedContent })
        .eq("id", post.id);

      if (updateError) throw updateError;
      
      onPostUpdated();
    } catch (e: any) {
      console.error("Failed to cast vote", e);
      alert(e.message || "Cannot complete vote.");
    } finally {
      setVoteLoading(false);
    }
  };

  // Editing post properties
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(mainContent);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const isOwner = currentUser && post.user_id === currentUser.id;
  const isAdminActive = !!adminPassword;

  const handleUpdatePost = async () => {
    if (!editedContent.trim()) {
      setEditError("Post content cannot be empty.");
      return;
    }

    let finalContent = editedContent.trim();
    if (metadata) {
      finalContent = `${finalContent}${separator}${JSON.stringify(metadata)}`;
    }

    try {
      setEditLoading(true);
      setEditError(null);
      
      const { error } = await supabase
        .from("posts")
        .update({ content: finalContent })
        .eq("id", post.id);
      
      if (error) throw error;
      
      setIsEditing(false);
      onPostUpdated();
    } catch (e) {
      console.error("Failed to update post:", e);
      setEditError("Failed to save post.");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDeletePost = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this post from the wall?")) return;
    try {
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", post.id);
      
      if (error) throw error;
      
      if (onPostDeleted) {
        onPostDeleted();
      } else {
        onPostUpdated();
      }
    } catch (e) {
      console.error("Failed to delete post:", e);
      alert("Failed to delete post.");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) {
      setCommentError("Comment content cannot be empty.");
      return;
    }
    try {
      setAddCommentLoading(true);
      setCommentError(null);

      const commentData: any = {
        post_id: post.id,
        content: commentContent.trim(),
        created_at: new Date().toISOString(),
      };

      if (currentUser && !isAnonymousComment) {
        commentData.user_id = currentUser.id;
        commentData.author_name = currentUser.username;
      } else if (currentUser && isAnonymousComment) {
        commentData.user_id = null;
        commentData.author_name = "Anonymous";
      } else {
        // Guest comment
        commentData.user_id = null;
        commentData.author_name = customCommentName.trim() || "Guest";
      }

      const { error } = await supabase
        .from("comments")
        .insert(commentData);
      
      if (error) throw error;
      
      setCommentContent("");
      setCustomCommentName("");
      setIsAnonymousComment(true);
      onPostUpdated();
    } catch (err) {
      console.error("Failed to add comment:", err);
      setCommentError("Failed to submit comment.");
    } finally {
      setAddCommentLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm("Are you sure you want to delete this comment?")) return;
    try {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      
      if (error) throw error;
      
      onPostUpdated();
    } catch (e) {
      console.error("Failed to delete comment:", e);
      alert("Failed to delete comment.");
    }
  };

  const hasJoinedProfile = post.profiles && typeof post.profiles === "object";

  // Check if voter already cast ballot
  const userHasVoted = metadata?.poll?.voters?.includes(viewerLikerId) || false;
  const shouldShowResults = userHasVoted;

  // Compute vote details
  const totalVotes = metadata?.poll?.voters?.length || 0;

  const [isFullscreenImageOpen, setIsFullscreenImageOpen] = useState(false);

  // Parse @mentions and URLs with FormattedText component
  const renderContentWithMentions = (text: string) => {
    return <FormattedText text={text} onOpenUserProfile={onOpenUserProfile} />;
  };

  const handleCardClick = (e: React.MouseEvent) => {
    const selection = window.getSelection();
    if (selection && selection.toString()) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest("button, input, textarea, a, label")) {
      return;
    }
    if (onClickPost) {
      onClickPost(post.id);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="bg-[#0b0b0f] border border-transparent hover:border-purple-950/30 p-3.5 sm:p-4 rounded-xl transition-all text-slate-200 shadow-sm relative flex flex-col select-text cursor-pointer hover:bg-[#0d0d14]"
    >
      {/* Absolute admin indicator badge */}
      {isAdminActive && (
        <div className="absolute top-2.5 right-2.5 bg-red-650/25 text-red-400 text-[8px] tracking-wider font-mono border border-red-500/20 px-2 py-0.5 rounded-full z-10 font-bold">
          MOD
        </div>
      )}

      {/* Main post row */}
      <div className="flex space-x-3.5 w-full">
        {/* Left side: Avatar Column */}
        <div className="shrink-0">
          {hasJoinedProfile ? (
            <button
              onClick={() => onOpenUserProfile((post.profiles as any).username)}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-purple-500/10 overflow-hidden bg-slate-950 p-0.5 hover:opacity-90 transition-opacity cursor-pointer block"
            >
              <img
                src={(post.profiles as any).avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${(post.profiles as any).username}`}
                alt="avatar"
                referrerPolicy="no-referrer"
                className="w-full h-full rounded-full object-cover"
              />
            </button>
          ) : (
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full border border-slate-800 bg-slate-900 flex items-center justify-center text-xs font-bold text-slate-400 select-none">
              {post.author_name ? post.author_name.charAt(0).toUpperCase() : "A"}
            </div>
          )}
        </div>

        {/* Right side: Content area */}
        <div className="flex-1 min-w-0 space-y-2 text-left">
          {/* Author information header row */}
          <div className="flex items-start justify-between flex-nowrap w-full gap-x-2">
            <div className="flex items-start space-x-2">
              {hasJoinedProfile ? (
                <div className="flex flex-col text-left">
                  <div className="flex items-center space-x-1 flex-wrap">
                    <button
                      onClick={() => onOpenUserProfile((post.profiles as any).username)}
                      className="font-bold text-xs text-purple-200 hover:text-purple-300 transition-colors hover:underline text-left cursor-pointer"
                    >
                      {(post.profiles as any).display_name || (post.profiles as any).username}
                    </button>
                    {((post.profiles as any).is_verified ||
                      (post.profiles as any).username.toLowerCase() === "mavebo" ||
                      (post.profiles as any).username.toLowerCase() === "kode" ||
                      (post.profiles as any).username.toLowerCase() === "kodewt" ||
                      (post.profiles as any).username.toLowerCase() === "jocko" ||
                      (post.profiles as any).username.toLowerCase() === "dil_doe"
                    ) && (
                      <BadgeCheck className="w-3.5 h-3.5 text-purple-400 shrink-0 fill-purple-950 inline-block" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">
                    @{(post.profiles as any).username}
                  </span>
                </div>
              ) : (
                <div className="flex flex-col text-left">
                  <div className="flex items-center space-x-1">
                    <span className="font-bold text-xs text-slate-300">
                      {post.author_name || "Anonymous"}
                    </span>
                    <span className="text-[9px] bg-slate-900 text-slate-500 px-1 py-0.2 rounded font-mono uppercase font-semibold">
                      ANON
                    </span>
                  </div>
                </div>
              )}
              <span className="text-slate-600 text-[10px] self-start mt-0.5">•</span>
              <span className="text-[10px] text-slate-500 font-mono self-start mt-0.5">
                {formatRelativeTime(post.created_at)}
              </span>
            </div>
          </div>

          {/* Content paragraph */}
          <div className="space-y-3">
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={3}
                  className="w-full bg-[#121118] border border-slate-800 rounded-xl px-3 py-2 text-slate-100 text-xs focus:outline-none focus:ring-1 focus:ring-purple-500/30 resize-none"
                />
                {editError && <div className="text-xs text-red-400">{editError}</div>}
                <div className="flex items-center space-x-2 justify-end">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-[10px] uppercase font-semibold px-3 py-1.5 rounded-lg border border-slate-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdatePost}
                    disabled={editLoading}
                    className="bg-purple-600 hover:bg-purple-500 text-white text-[10px] uppercase font-semibold px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer flex items-center"
                  >
                    {editLoading ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-slate-200 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                {renderContentWithMentions(mainContent)}
              </p>
            )}

            {/* VISUAL FILE ATTACHMENT RENDERING */}
            {metadata?.attachment && (
              <div className="relative overflow-hidden bg-slate-950/20 border border-slate-900 rounded-xl max-w-sm mt-2 animate-fade-in group">
                {metadata.attachment.type.startsWith("image/") ? (
                  <div 
                    className="max-h-[300px] overflow-hidden flex items-center cursor-zoom-in relative group"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFullscreenImageOpen(true);
                    }}
                  >
                    <img
                      src={metadata.attachment.data}
                      alt="attachment payload representation"
                      referrerPolicy="no-referrer"
                      className="w-full object-cover rounded-xl transition-all duration-300 hover:scale-[1.02]"
                    />
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-[10px] font-semibold px-2.5 py-1.5 rounded-lg bg-black/75 backdrop-blur-md flex items-center space-x-1.5 border border-white/10 shadow-lg">
                        <Maximize2 className="w-3 h-3 text-purple-300" />
                        <span>View Full Screen</span>
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-lg bg-purple-950/30 border border-purple-500/10 flex items-center justify-center font-bold text-xl text-purple-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-200 truncate">{metadata.attachment.name}</p>
                      <p className="text-[9px] text-slate-500 uppercase font-mono tracking-wider">ATTACHED FILE DOCUMENT</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* INTERACTIVE POLL RESULTS & VOTING COMPRESSED CARD */}
            {metadata?.poll && (
              <div className="bg-[#121118]/60 border border-purple-950/30 rounded-xl p-3.5 space-y-3 mt-3 animate-fade-in max-w-sm">
                <div className="flex items-center space-x-1.5 text-purple-400">
                  <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
                  <span className="text-[10px] font-bold uppercase tracking-wider font-display shrink-0">Interactive Poll</span>
                </div>
                
                <h4 className="text-xs font-semibold text-white">{metadata.poll.question}</h4>

                <div className="space-y-2 pt-1">
                  {metadata.poll.options.map((option, idx) => {
                    const votesCount = metadata.poll?.votes?.[idx] || 0;
                    const ratio = totalVotes > 0 ? (votesCount / totalVotes) * 100 : 0;

                    return (
                      <div key={idx} className="relative">
                        {shouldShowResults ? (
                          <div className="relative overflow-hidden rounded-lg bg-slate-900 border border-slate-850/50 py-2.5 px-3 flex items-center justify-between text-xs text-slate-200">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${ratio}%` }}
                              transition={{ duration: 0.8 }}
                              className="absolute top-0 bottom-0 left-0 bg-purple-600/20"
                            />
                            <span className="relative z-10 font-medium">{option}</span>
                            <span className="relative z-10 font-mono text-[10px] text-slate-400">
                              {ratio.toFixed(0)}% ({votesCount})
                            </span>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleVote(idx)}
                            disabled={voteLoading}
                            className="w-full text-left py-2.5 px-3 border border-slate-800 hover:border-purple-500/30 bg-[#161620] hover:bg-purple-950/25 rounded-lg text-xs text-slate-300 hover:text-white transition-all duration-150 cursor-pointer disabled:opacity-50"
                          >
                            {option}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono border-t border-slate-850 pt-2 flex-wrap">
                  <span>{totalVotes} total votes</span>
                  {shouldShowResults && <span className="text-purple-400/80">Results active</span>}
                </div>
              </div>
            )}

            {/* REPOSTED ORIGINAL POST SUB-CARD */}
            {metadata?.repost && (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  if (onClickPost && metadata?.repost) {
                    onClickPost(metadata.repost.id);
                  }
                }}
                className="bg-[#050508]/60 border border-slate-900 hover:border-purple-950/20 rounded-xl p-3 space-y-2 text-left mt-3 animate-fade-in transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  {metadata.repost.profiles && typeof metadata.repost.profiles === "object" ? (
                    <div className="w-5 h-5 rounded-full overflow-hidden bg-slate-950 p-[1px] border border-purple-500/10 shrink-0">
                      <img
                        src={metadata.repost.profiles.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${metadata.repost.profiles.username}`}
                        alt="original poster's avatar"
                        className="w-full h-full rounded-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-400 shrink-0 select-none">
                      {metadata.repost.author_name ? metadata.repost.author_name.charAt(0).toUpperCase() : "A"}
                    </div>
                  )}
                  <div className="flex items-center space-x-1 flex-wrap text-[11px]">
                    <span className="font-bold text-purple-200">
                      {metadata.repost.profiles && typeof metadata.repost.profiles === "object"
                        ? metadata.repost.profiles.display_name || metadata.repost.profiles.username
                        : metadata.repost.author_name || "Anonymous"
                      }
                    </span>
                    {metadata.repost.profiles && typeof metadata.repost.profiles === "object" && (
                      <span className="text-slate-500 font-mono">@{metadata.repost.profiles.username}</span>
                    )}
                    <span className="text-slate-650">•</span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      {formatRelativeTime(metadata.repost.created_at)}
                    </span>
                  </div>
                </div>
                <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap pl-1">
                  {renderContentWithMentions(metadata.repost.content.split("\n\n---STARTORIGIN_METADATA_JSON---")[0])}
                </p>
              </div>
            )}
          </div>

          {/* Bottom Interactive actions bar */}
          <div className="flex items-center space-x-4 border-t border-slate-900/40 pt-2 justify-start">
            {/* Heart Like Trigger */}
            <button
              onClick={handleToggleLike}
              disabled={likeLoading}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                hasLiked
                  ? "bg-red-950/20 text-red-400"
                  : "text-slate-500 hover:text-red-400 hover:bg-red-950/5"
              }`}
            >
              <Heart className={`w-3.5 h-3.5 transition-transform ${hasLiked ? "fill-red-500 text-red-500 scale-110" : ""}`} />
              <span>{post.post_likes ? post.post_likes.length : 0}</span>
            </button>

            {/* Comment Bubble Trigger */}
            <button
              onClick={() => setShowComments(!showComments)}
              className={`flex items-center space-x-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                showComments
                  ? "bg-purple-950/20 text-purple-300"
                  : "text-slate-500 hover:text-purple-300"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{post.comments ? post.comments.length : 0}</span>
            </button>

            {/* Repost Trigger Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onRepost) {
                  onRepost(post);
                }
              }}
              className="flex items-center text-xs font-semibold p-1.5 rounded-lg text-slate-500 hover:text-green-400 hover:bg-green-950/5 transition-all cursor-pointer"
              title="Repost with comment (Quote Repost)"
            >
              <Repeat className="w-4 h-4" />
            </button>

            {/* Edit/Trash Actions */}
            <div className="flex-1" />

            {(isOwner || isAdminActive) && !isEditing && (
              <button
                onClick={handleDeletePost}
                className="text-slate-600 hover:text-red-400 p-1 rounded-lg transition-all cursor-pointer"
                title="Delete Post"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            {isOwner && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-slate-600 hover:text-slate-200 p-1 rounded-lg transition-all transition-colors cursor-pointer"
                title="Edit Post"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* RENDER EXPANDED COMMENTS DRAWER */}
      {showComments && (
        <div className="border-t border-slate-900/40 mt-3.5 pt-3.5 space-y-4 w-full pl-1 sm:pl-12">
          <div className="space-y-3.5">
            {post.comments && post.comments.length > 0 ? (
              post.comments.map((comment: Comment) => {
                const commentHasProfile = comment.profiles && typeof comment.profiles === "object";
                const isCommentOwner = currentUser && comment.user_id === currentUser.id;

                return (
                  <div key={comment.id} className="flex items-start space-x-3 bg-slate-900/10 border border-slate-900/50 p-3 rounded-lg relative text-xs">
                    <CornerDownRight className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
                    
                    {commentHasProfile ? (
                      <button
                        onClick={() => onOpenUserProfile((comment.profiles as any).username)}
                        className="w-6 h-6 rounded-full overflow-hidden bg-slate-950 shrink-0 cursor-pointer block"
                      >
                        <img
                          src={(comment.profiles as any).avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${(comment.profiles as any).username}`}
                          alt="comment author avatar representation"
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-850 border border-slate-800 text-[9px] font-bold text-slate-450 flex items-center justify-center shrink-0">
                        {comment.author_name ? comment.author_name.charAt(0).toUpperCase() : "A"}
                      </div>
                    )}

                    <div className="flex-1 min-w-0 space-y-1 text-left">
                      <div className="flex items-baseline justify-between">
                        <div className="flex items-center space-x-1">
                          {commentHasProfile ? (
                            <button
                              onClick={() => onOpenUserProfile((comment.profiles as any).username)}
                              className="font-bold text-xs text-purple-300 hover:underline cursor-pointer"
                            >
                              {(comment.profiles as any).display_name || (comment.profiles as any).username}
                            </button>
                          ) : (
                            <span className="font-bold text-xs text-slate-405">{comment.author_name || "Anonymous"}</span>
                          )}
                        </div>
                        <span className="text-[9px] text-slate-500 font-mono">{formatRelativeTime(comment.created_at)}</span>
                      </div>
                      <p className="text-slate-300 leading-relaxed text-xs whitespace-pre-wrap">{renderContentWithMentions(comment.content)}</p>
                    </div>

                    {(isCommentOwner || isAdminActive) && (
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        className="absolute right-2 top-2 p-1 text-slate-600 hover:text-red-400 transition-all cursor-pointer"
                        title="Delete Comment"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-[10px] text-slate-650 text-center py-2">No comments published yet. Be the first to reply!</p>
            )}
          </div>

          {/* Quick Comment submission panel */}
          <form onSubmit={handleAddComment} className="bg-[#121118]/45 border border-slate-900 rounded-xl p-3 space-y-2.5">
            <textarea
              rows={2}
              value={commentContent}
              onChange={(e) => {
                setCommentContent(e.target.value);
                if (commentError) setCommentError(null);
              }}
              placeholder="Reply to this thread..."
              className="w-full bg-[#161620] border border-slate-850 focus:border-purple-500/20 rounded-lg px-3 py-1.5 text-slate-200 placeholder-slate-600 text-xs focus:outline-none resize-none"
            />

            {commentError && <div className="text-[10px] text-red-450 text-left">{commentError}</div>}

            <div className="flex items-center justify-between gap-2.5">
              {currentUser ? (
                <label className="flex items-center space-x-1.5 text-xs text-slate-500 cursor-pointer user-select-none">
                  <input
                    type="checkbox"
                    checked={isAnonymousComment}
                    onChange={(e) => setIsAnonymousComment(e.target.checked)}
                    className="accent-purple-500 rounded border-slate-800"
                  />
                  <span>Comment anonymously</span>
                </label>
              ) : (
                <input
                  type="text"
                  maxLength={20}
                  placeholder="Reviewer Display Name"
                  value={customCommentName}
                  onChange={(e) => {
                    setCustomCommentName(e.target.value);
                    setIsAnonymousComment(false);
                  }}
                  className="bg-[#161620] border border-slate-850 focus:border-purple-500/20 rounded-md px-2 py-1 text-[10px] text-slate-200 placeholder-slate-650 focus:outline-none w-32"
                />
              )}

              <button
                type="submit"
                disabled={addCommentLoading}
                className="bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white text-[10px] uppercase font-bold px-3 py-1.5 rounded-lg transition-all"
              >
                {addCommentLoading ? "Posting..." : "Reply"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* FULLSCREEN IMAGE MODAL OVERLAY */}
      <AnimatePresence>
        {isFullscreenImageOpen && metadata?.attachment?.data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              setIsFullscreenImageOpen(false);
            }}
            className="fixed inset-0 bg-black/95 flex items-center justify-center p-4 z-[9999] cursor-zoom-out"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsFullscreenImageOpen(false);
              }}
              className="absolute top-4 right-4 bg-slate-900/80 hover:bg-slate-800 text-slate-200 border border-slate-800/60 p-2 rounded-full transition-colors cursor-pointer z-[10000]"
            >
              <X className="w-5 h-5" />
            </button>
            <motion.img
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 180 }}
              src={metadata.attachment.data}
              alt="fullscreen attachment payload"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl select-none"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}