/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface FormattedTextProps {
  text: string;
  onOpenUserProfile: (username: string) => void;
  onHashtagClick?: (hashtag: string) => void;
}

export default function FormattedText({ text, onOpenUserProfile, onHashtagClick }: FormattedTextProps) {
  if (!text) return null;

  // Split by URLs (http/https), Mentions (@username), or Hashtags (#hashtag)
  // Regexp matches either http/https URL, a mention start (@), or a hashtag (#)
  const parts = text.split(/(https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+|#[a-zA-Z0-9_-]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          // Clean username from auxiliary punctuation if attached (keeping underscores and hyphens)
          const cleanUsername = part.substring(1).replace(/[.,\/#!$%\^&\*;:{}=`~()?]/g, "");
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onOpenUserProfile(cleanUsername.toLowerCase());
              }}
              className="text-purple-400 hover:text-purple-300 font-semibold hover:underline cursor-pointer inline"
            >
              {part}
            </span>
          );
        }

        if (part.startsWith("#") && part.length > 1) {
          // Clean hashtag from auxiliary punctuation if attached
          const cleanHashtag = part.substring(1).replace(/[.,\/#!$%\^&\*;:{}=`~()?]/g, "");
          return (
            <span
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (onHashtagClick) {
                  onHashtagClick(cleanHashtag.toLowerCase());
                }
              }}
              className="text-purple-400 hover:text-purple-300 font-semibold hover:underline cursor-pointer inline"
            >
              {part}
            </span>
          );
        }

        if (/^https?:\/\//i.test(part)) {
          return (
            <a
              key={index}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-purple-400 hover:text-purple-300 underline font-medium break-all inline"
            >
              {part}
            </a>
          );
        }

        return part;
      })}
    </>
  );
}
