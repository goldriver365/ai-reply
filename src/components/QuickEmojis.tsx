"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";

export default function QuickEmojis({ emojis }: { emojis: string[] }) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  if (emojis.length === 0) return null;

  const handleCopy = async (emoji: string, index: number) => {
    await copyText(emoji);
    setCopiedIndex(index);
    window.setTimeout(() => {
      setCopiedIndex((prev) => (prev === index ? null : prev));
    }, 1200);
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">이모티콘만 보내기</h2>
      <div className="flex flex-wrap gap-2">
        {emojis.map((emoji, index) => (
          <button
            key={`${emoji}-${index}`}
            type="button"
            onClick={() => void handleCopy(emoji, index)}
            aria-label={`${emoji} 복사`}
            className="flex h-11 min-w-11 items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-xl transition-colors hover:bg-slate-50"
          >
            {copiedIndex === index ? (
              <span className="text-xs font-medium text-emerald-600">복사됨</span>
            ) : (
              emoji
            )}
          </button>
        ))}
      </div>
    </section>
  );
}
