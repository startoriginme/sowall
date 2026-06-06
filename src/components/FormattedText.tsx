/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";

interface FormattedTextProps {
  text: string;
  onOpenUserProfile: (username: string) => void;
}

export default function FormattedText({ text, onOpenUserProfile }: FormattedTextProps) {
  if (!text) return null;

  // Split by URLs (http/https) or Mentions (@username)
  // Regexp matches either a full http/https URL up to a whitespace, or a mention start (@) with alphanumeric/dot/underscore/hyphen
  const parts = text.split(/(https?:\/\/[^\s]+|@[a-zA-Z0-9._-]+)/g);

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith("@") && part.length > 1) {
          // Clean username from auxiliary punctuation if attached
          const cleanUsername = part.substring(1).replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
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
