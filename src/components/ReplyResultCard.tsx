"use client";

import { useState } from "react";

export default function ReplyResultCard({
  index,
  text,
  translation,
}: {
  index: number;
  text: string;
  /** 외국어 답변일 때의 한국어 뜻. 한국어 답변이면 없음. */
  translation?: string | null;
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
    <button
      type="button"
      onClick={handleCopy}
      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors active:bg-slate-50"
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
  );
}
