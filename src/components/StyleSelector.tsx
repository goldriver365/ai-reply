"use client";

import { REPLY_STYLES } from "@/lib/mockReplies";
import type { ReplyStyle } from "@/lib/types";

export default function StyleSelector({
  value,
  onChange,
}: {
  value: ReplyStyle;
  onChange: (style: ReplyStyle) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {REPLY_STYLES.map((style) => {
        const active = style === value;
        return (
          <button
            key={style}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(style)}
            className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${
              active
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {style}
          </button>
        );
      })}
    </div>
  );
}
