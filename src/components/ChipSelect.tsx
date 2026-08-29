"use client";

import { useState } from "react";

export default function ChipSelect<T extends string>({
  label,
  value,
  primaryOptions,
  allOptions,
  onChange,
}: {
  label: string;
  value: T;
  /** 기본으로 보이는 짧은 칩 목록 */
  primaryOptions: readonly T[];
  /** "더보기"를 눌렀을 때 보이는 전체 옵션. 항상 primaryOptions를 포함해야 한다. */
  allOptions: readonly T[];
  onChange: (value: T) => void;
}) {
  const [manuallyExpanded, setManuallyExpanded] = useState(false);
  // 현재 선택값이 기본 목록에 없으면(예: "더보기"에서 고른 값) 항상 펼쳐서 보여준다.
  const expanded = manuallyExpanded || !primaryOptions.includes(value);
  const visibleOptions = expanded ? allOptions : primaryOptions;
  const hasMore = allOptions.length > primaryOptions.length;

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {visibleOptions.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "bg-emerald-600 text-white"
                  : "bg-emerald-50 text-slate-600 hover:bg-emerald-100"
              }`}
            >
              {option}
            </button>
          );
        })}
        {hasMore && (
          <button
            type="button"
            onClick={() => setManuallyExpanded((prev) => !prev)}
            className="rounded-full px-2 py-1 text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        )}
      </div>
    </div>
  );
}
