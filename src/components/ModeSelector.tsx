"use client";

import type { InputMode } from "@/lib/types";

const OPTIONS: { value: InputMode; label: string }[] = [
  { value: "paste", label: "붙여넣기" },
  { value: "file", label: "파일 넣기" },
  { value: "write", label: "직접 쓰기" },
];

export default function ModeSelector({
  value,
  onChange,
}: {
  value: InputMode;
  onChange: (mode: InputMode) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="대화 입력 방식">
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`h-12 rounded-xl text-sm font-medium transition-colors ${
              active
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
