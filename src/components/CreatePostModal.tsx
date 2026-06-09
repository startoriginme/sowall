import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Sparkles } from "lucide-react";
import { UserSessionData, Post } from "../types";
import PostForm from "./PostForm";

interface CreatePostModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSessionData | null;
  onPostCreated: () => void;
  repostOfPost?: Post | null;
  onClearRepost?: () => void;
}

export default function CreatePostModal({
  isOpen,
  onClose,
  currentUser,
  onPostCreated,
  repostOfPost,
  onClearRepost,
}: CreatePostModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id="create-post-modal-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            id="create-post-modal-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-[#0b0b0f] border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col relative overflow-hidden shadow-2xl shadow-purple-950/20"
          >
            {/* Top ambient highlight line */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />

            {/* Header Section */}
            <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-4 shrink-0">
              <span className="text-sm font-semibold tracking-wider uppercase text-purple-400 font-display flex items-center space-x-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span>Publish Post</span>
              </span>
              <button
                id="close-create-post-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main Area */}
            <div className="flex-1 overflow-y-auto p-5 md:p-6 min-h-0">
              <PostForm
                currentUser={currentUser}
                onPostCreated={onPostCreated}
                onClose={onClose}
                repostOfPost={repostOfPost}
                onClearRepost={onClearRepost}
              />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
