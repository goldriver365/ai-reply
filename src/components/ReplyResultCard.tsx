"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import type { RefineAdjustment } from "@/lib/types";

const ADJUSTMENT_OPTIONS: { value: RefineAdjustment; label: string }[] = [
  { value: "shorter", label: "더 짧게" },
  { value: "friendlier", label: "더 친근하게" },
  { value: "polite", label: "더 정중하게" },
];

export default function ReplyResultCard({
  index,
  text,
  translation,
  emojiOnly,
  typeLabel,
  onRefine,
  isRefining,
  refineDisabled,
}: {
  index: number;
  text: string;
  /** 외국어 답변일 때의 한국어 뜻. 한국어 답변이거나 이모티콘 전용 답변이면 없음. */
  translation?: string | null;
  /** 이모티콘만으로 구성된 답변이면 더 크게 표시한다. */
  emojiOnly?: boolean;
  /** 아주 작은 유형명. 예: "자연스럽게", "조금 더 적극적으로" */
  typeLabel?: string;
  /** 이 카드의 답변만 다듬어달라는 요청. 생략하면 조정 버튼을 표시하지 않는다. */
  onRefine?: (adjustment: RefineAdjustment) => void;
  /** 지금 이 카드가 다듬어지는 중인지(조정 중... 표시) */
  isRefining?: boolean;
  /** 다른 AI 요청이 진행 중이라 이 카드의 조정 버튼도 눌러선 안 되는지 */
  refineDisabled?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm">
      <button
        type="button"
        onClick={handleCopy}
        className="block w-full text-left transition-colors active:opacity-70"
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            추천 {index + 1}
            {typeLabel && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                {typeLabel}
              </span>
            )}
          </span>
          <span
            className={`shrink-0 text-xs font-medium ${
              copied ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {copied ? "복사됨" : "복사"}
          </span>
        </div>
        <p
          className={
            emojiOnly
              ? "text-3xl leading-relaxed tracking-wide"
              : "text-base leading-relaxed text-slate-900"
          }
        >
          {text}
        </p>
        {translation && (
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{translation}</p>
        )}
      </button>

      {onRefine && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {ADJUSTMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRefine(option.value)}
              disabled={isRefining || refineDisabled}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
          {isRefining && <span className="self-center text-xs text-slate-400">조정 중...</span>}
        </div>
      )}
    </div>
  );
}
