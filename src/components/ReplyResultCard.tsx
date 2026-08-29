"use client";

import { useState } from "react";
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
  reason,
  onRefine,
  isRefining,
}: {
  index: number;
  text: string;
  /** 외국어 답변일 때의 한국어 뜻. 한국어 답변이면 없음. */
  translation?: string | null;
  /** 한 줄을 넘지 않는 짧은 답변 전략 설명 */
  reason?: string | null;
  /** 이 카드의 답변만 다듬어달라는 요청. 생략하면 조정 버튼을 표시하지 않는다. */
  onRefine?: (adjustment: RefineAdjustment) => void;
  isRefining?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 클립보드 API를 사용할 수 없는 환경을 위한 대체 방법
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
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
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-indigo-600">
            추천 {index + 1}
          </span>
          <span
            className={`text-xs font-medium ${
              copied ? "text-emerald-600" : "text-slate-400"
            }`}
          >
            {copied ? "복사됨" : "복사"}
          </span>
        </div>
        <p className="text-base leading-relaxed text-slate-900">{text}</p>
        {translation && (
          <p className="mt-1 text-xs leading-relaxed text-slate-400">{translation}</p>
        )}
      </button>

      {reason && (
        <span className="mt-2 inline-flex max-w-full items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
          {reason}
        </span>
      )}

      {onRefine && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {ADJUSTMENT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onRefine(option.value)}
              disabled={isRefining}
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
