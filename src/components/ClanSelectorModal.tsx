/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Shield, Star } from "lucide-react";

interface ClanSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentClan: string | null;
  onSelectClan: (emoji: string | null) => void;
}

export const CLAN_EMOJIS_LIST = [
  // Group 1: Fantasy / Combat / RPG
  "🐉", "🐲", "🦁", "🦅", "🐺", "🐻", "🗡️", "🛡️", "⚔️", "🏰", "🔮", "🧙", "👑", "💎", "🌋",
  // Group 2: Cyber / Sci-Fi / Tech
  "🤖", "👾", "💻", "⌨️", "🖥️", "📡", "🛸", "🔫", "🎮", "🧬", "⚡", "🔋", "🌐", "💊", "🎛️",
  // Group 3: Art / Design / Music
  "🎨", "🖌️", "✏️", "🎭", "🎬", "🎧", "🎵", "🎸", "🥁", "📸", "🎞️", "🖼️", "✂️", "🧵", "🪡",
  // Group 4: Sports / Action / Energy
  "🏆", "🥇", "⚽", "🏀", "🎾", "🏈", "💪", "🥊", "🚴", "🏋️", "🧗", "🏊", "⛷️", "🏅",
  // Group 5: Nature / Ambient / Cozy
  "🌿", "🍃", "🌸", "🌻", "🍄", "🪶", "🐾", "🕊️", "🐝", "🦋", "🌙", "✨", "⭐", "☕", "🍜",
  // Group 6: Sovereign / Symbols / Tech
  "🔱", "⚜️", "💠", "🔰", "🧩", "🚀", "💡", "🔐", "🧨"
];

export default function ClanSelectorModal({
  isOpen,
  onClose,
  currentClan,
  onSelectClan,
}: ClanSelectorModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="clan-selector-backdrop" 
          className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            id="clan-selector-container"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ type: "spring", duration: 0.4 }}
            className="bg-[#0c0c11] border border-zinc-800 rounded-2xl w-full max-w-lg p-5 sm:p-6 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Background decorative shine */}
            <div className="absolute -top-16 -right-16 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3.5 mb-4">
              <div className="flex items-center space-x-2.5">
                <Shield className="w-5 h-5 text-purple-400" />
                <div className="text-left">
                  <h2 className="text-base font-bold text-white tracking-tight">Choose Clan Emblem</h2>
                  <p className="text-[10px] text-zinc-500 font-mono">ALLIANCE TRANSLATOR RECEPTOR</p>
                </div>
              </div>
              <button
                id="close-clan-selector-btn"
                onClick={onClose}
                className="text-zinc-500 hover:text-white transition-colors bg-zinc-900/60 hover:bg-zinc-900 p-1.5 rounded-xl border border-zinc-800/80 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Main selection area */}
            <div className="space-y-4">
              {/* Reset/Remove Clan Button */}
              <button
                onClick={() => {
                  onSelectClan(null);
                  onClose();
                }}
                className={`w-full py-2.5 px-4 rounded-xl border text-xs font-bold font-mono transition-all flex items-center justify-center space-x-2 cursor-pointer ${
                  !currentClan
                    ? "bg-purple-900/10 border-purple-500/30 text-purple-300"
                    : "bg-zinc-950/40 border-zinc-900/60 text-zinc-400 hover:text-white hover:border-zinc-800"
                }`}
              >
                <span>🚫</span>
                <span>No Clan Alliance</span>
              </button>

              <div className="space-y-1">
                <label className="text-[9px] font-bold tracking-wider text-zinc-500 uppercase font-mono block text-left">
                  Available Clan Alliances
                </label>
                
                {/* Emoji Grid */}
                <div className="grid grid-cols-8 sm:grid-cols-10 gap-1.5 p-3 rounded-2xl bg-[#09090d] border border-zinc-900 overflow-y-auto max-h-[280px] custom-scrollbar scroll-smooth">
                  {CLAN_EMOJIS_LIST.map((emoji) => {
                    const isSelected = currentClan === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => {
                          onSelectClan(emoji);
                          onClose();
                        }}
                        className={`aspect-square rounded-xl text-lg flex items-center justify-center transition-all cursor-pointer relative hover:scale-115 ${
                          isSelected
                            ? "bg-purple-500/20 border border-purple-500/50 shadow-md shadow-purple-500/5"
                            : "bg-zinc-950/60 border border-transparent hover:border-zinc-800 hover:bg-zinc-900"
                        }`}
                        title="Join this Clan"
                      >
                        {isSelected && (
                          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-purple-400 rounded-full animate-ping" />
                        )}
                        <span>{emoji}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Status display footer */}
              {currentClan && (
                <div className="flex items-center space-x-2 bg-purple-950/10 border border-purple-900/15 p-3 rounded-xl justify-center text-[11px] text-purple-300/90 font-mono">
                  <Star className="w-3.5 h-3.5 text-purple-400 animate-spin-slow shrink-0" />
                  <span>Current Alliance Emblem:</span>
                  <span className="text-sm font-sans">{currentClan}</span>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
