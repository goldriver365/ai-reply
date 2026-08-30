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

  // 기본(접힌) 상태에서는 모바일 화면 폭에 맞춰 칩 전부(+ "더보기")가 가로 스크롤 없이
  // 한 줄에 고르게 나뉘도록 칩 개수만큼 그리드 열을 만든다. 데스크톱(sm 이상)에서는
  // 기존처럼 자연스럽게 줄바꿈되는 flex 레이아웃을 그대로 유지한다. "더보기"를 눌러
  // 전체 목록을 펼친 상태는 옵션이 많아 원래도 여러 줄로 감싸는 게 맞으므로 그대로 둔다.
  const compactColumnCount = visibleOptions.length + (hasMore ? 1 : 0);

  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div
        className={
          expanded
            ? "flex flex-wrap gap-1.5"
            : "grid gap-1 sm:flex sm:flex-wrap sm:gap-1.5"
        }
        style={expanded ? undefined : { gridTemplateColumns: `repeat(${compactColumnCount}, minmax(0, 1fr))` }}
      >
        {visibleOptions.map((option) => {
          const active = option === value;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(option)}
              className={`min-w-0 rounded-full px-1.5 py-1 text-[11px] font-medium leading-tight transition-colors sm:px-3 sm:py-1 sm:text-xs ${
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
            className="min-w-0 rounded-full px-1 py-1 text-[11px] font-medium leading-tight text-slate-400 hover:text-slate-600 sm:px-2 sm:text-xs"
          >
            {expanded ? "접기" : "더보기"}
          </button>
        )}
      </div>
    </div>
  );
}
