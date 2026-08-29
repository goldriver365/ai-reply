"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import type { RefineAdjustment } from "@/lib/types";

// 모바일 화면이 복잡해지지 않도록 "다듬기"를 눌렀을 때만 이 옵션들을 보여준다.
const ADJUSTMENT_OPTIONS: { value: RefineAdjustment; label: string }[] = [
  { value: "shorter", label: "더 짧게" },
  { value: "softer", label: "더 부드럽게" },
  { value: "friendlier", label: "더 친근하게" },
  { value: "polite", label: "더 정중하게" },
  { value: "natural", label: "더 자연스럽게" },
  { value: "noQuestion", label: "질문 없이" },
  { value: "emojiAdd", label: "이모지 추가" },
  { value: "emojiRemove", label: "이모지 빼기" },
];

// "내 말투로"는 사용자가 [내 말투 기억]을 등록해둔 경우에만 의미가 있으므로 항상 보이지 않는다.
const MY_STYLE_OPTION: { value: RefineAdjustment; label: string } = {
  value: "myStyle",
  label: "내 말투로",
};

const MAX_CUSTOM_INSTRUCTION_LENGTH = 40;

export default function ReplyResultCard({
  index,
  text,
  translation,
  emojiOnly,
  typeLabel,
  onRefine,
  isRefining,
  refineDisabled,
  justRefined,
  onUndo,
  hasMyStyle,
}: {
  index: number;
  text: string;
  /** 외국어 답변일 때의 한국어 뜻. 한국어 답변이거나 이모티콘 전용 답변이면 없음. */
  translation?: string | null;
  /** 이모티콘만으로 구성된 답변이면 더 크게 표시한다. */
  emojiOnly?: boolean;
  /** 아주 작은 유형명. 예: "자연스럽게", "조금 더 적극적으로" */
  typeLabel?: string;
  /** 이 카드의 답변만 다듬어달라는 요청. 생략하면 다듬기 버튼을 표시하지 않는다. */
  onRefine?: (adjustment: RefineAdjustment, customInstruction?: string) => void;
  /** 지금 이 카드가 다듬어지는 중인지("다듬고 있어요..." 표시) */
  isRefining?: boolean;
  /** 다른 AI 요청이 진행 중이라 이 카드의 다듬기 버튼도 눌러선 안 되는지 */
  refineDisabled?: boolean;
  /** 방금 이 카드가 다듬어졌는지("수정됨" 표시) */
  justRefined?: boolean;
  /** 방금 다듬은 것을 되돌리는 콜백. 되돌릴 대상이 이 카드일 때만 전달된다. */
  onUndo?: () => void;
  /** 사용자가 "내 말투"를 등록해뒀는지. true일 때만 "내 말투로" 옵션을 보여준다. */
  hasMyStyle?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState("");

  const handleCopy = async () => {
    // 복사되는 것은 지금 화면에 보이는 최종 답변 텍스트뿐이다(다듬기 이전 원문 아님).
    await copyText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const buttonsDisabled = isRefining || refineDisabled;

  const submitCustom = () => {
    const value = customText.trim();
    if (!value || !onRefine) return;
    onRefine("custom", value);
    setCustomText("");
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
            {justRefined && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-600">
                수정됨
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
        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              className="text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {expanded ? "다듬기 접기 ▲" : "다듬기 ▼"}
            </button>
            {isRefining && <span className="text-xs text-slate-400">다듬고 있어요...</span>}
            {onUndo && !isRefining && (
              <button
                type="button"
                onClick={onUndo}
                className="text-xs font-medium text-emerald-600 hover:underline"
              >
                되돌리기
              </button>
            )}
          </div>

          {expanded && (
            <div className="mt-2 flex flex-wrap gap-2">
              {hasMyStyle && (
                <button
                  type="button"
                  onClick={() => onRefine(MY_STYLE_OPTION.value)}
                  disabled={buttonsDisabled}
                  className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {MY_STYLE_OPTION.label}
                </button>
              )}
              {ADJUSTMENT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onRefine(option.value)}
                  disabled={buttonsDisabled}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {option.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowCustomInput((prev) => !prev)}
                disabled={buttonsDisabled}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                직접 입력
              </button>
            </div>
          )}

          {expanded && showCustomInput && (
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={customText}
                onChange={(event) => setCustomText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") submitCustom();
                }}
                placeholder="예: 조금 더 차갑게"
                maxLength={MAX_CUSTOM_INSTRUCTION_LENGTH}
                disabled={buttonsDisabled}
                className="h-8 flex-1 rounded-lg border border-slate-200 px-2 text-xs text-slate-900 outline-none focus:border-emerald-400 disabled:bg-slate-50"
              />
              <button
                type="button"
                onClick={submitCustom}
                disabled={buttonsDisabled || customText.trim().length === 0}
                className="shrink-0 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
              >
                적용
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
