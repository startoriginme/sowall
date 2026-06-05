/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion, AnimatePresence } from "motion/react";
import { HelpCircle, X, Layers, MessageSquare, ShieldCheck, Heart } from "lucide-react";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AboutModal({ isOpen, onClose }: AboutModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div id="about-modal-backdrop" className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div
            id="about-modal-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-[#0d0d12] border-2 border-slate-800 rounded-2xl w-full max-w-lg p-6 relative overflow-hidden"
          >
            {/* Background absolute flare */}
            <div className="absolute -top-16 -right-16 w-36 h-36 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5">
              <div className="flex items-center space-x-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                <h2 className="text-xl font-semibold text-white font-display">About StartOrigin</h2>
              </div>
              <button
                id="close-about-btn"
                onClick={onClose}
                className="text-slate-400 hover:text-white transition-colors bg-slate-800 p-1.5 rounded-lg border border-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
              <p>
                Welcome to <span className="text-purple-400 font-semibold font-display">StartOrigin</span> — a minimalist anonymous microblogging space, inspired by the pure freedom of open self-expression.
              </p>

              <div className="grid grid-cols-1 gap-3.5 mt-2">
                <div className="flex space-x-3 bg-slate-900/30 border border-slate-800 p-3 rounded-xl">
                  <Layers className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-200">Anonymity First</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Write freely without registration. Anyone can post anonymously or specify a custom nickname in one click.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 bg-slate-900/30 border border-slate-800 p-3 rounded-xl">
                  <MessageSquare className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-200 font-display">Comment & Discuss</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Engage with others in the thoughts section of each post. Commenters also fully support anonymous publication modes.
                    </p>
                  </div>
                </div>

                <div className="flex space-x-3 bg-slate-900/30 border border-slate-800 p-3 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-medium text-slate-200">Profiles & Customization</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create personal accounts to build persistent profiles, customize your Discord handle, edit your registered posts, and review your historic activity.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-slate-500 text-xs">
                <span className="flex items-center"><Heart className="w-3.5 h-3.5 text-purple-500 mr-1 fill-purple-500" /> Made with love</span>
                <span>Database: Connected</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
