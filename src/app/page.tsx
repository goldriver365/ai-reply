"use client";

import { useMemo, useRef, useState } from "react";
import ChipSelect from "@/components/ChipSelect";
import ImageUploader, { MAX_IMAGES } from "@/components/ImageUploader";
import LabeledSelect from "@/components/LabeledSelect";
import QuickEmojis from "@/components/QuickEmojis";
import ReplyResultCard from "@/components/ReplyResultCard";
import StyleSelector from "@/components/StyleSelector";
import { generateReplies, refineReply } from "@/lib/api";
import { resizeImageFile } from "@/lib/imageResize";
import {
  DEFAULT_GOAL,
  DEFAULT_RELATIONSHIP,
  GOALS,
  PRIMARY_RELATIONSHIPS,
  RELATIONSHIPS,
} from "@/lib/relationshipGoal";
import { REPLY_STYLES } from "@/lib/replyStyles";
import { DEFAULT_SPEECH_LEVEL, SPEECH_LEVELS } from "@/lib/speechLevel";
import type {
  AIReplyItem,
  AIReplyOkResult,
  AIReplyResult,
  ConversationContextData,
  Goal,
  RefineAdjustment,
  Relationship,
  ReplyStyle,
  ReplyType,
  SpeechLevel,
  UploadedImage,
} from "@/lib/types";

let imageIdCounter = 0;

interface DisplayReply {
  type: ReplyType;
  text: string;
  translation?: string | null;
}

// 아주 작은 유형명. 카드에 짧게만 표시한다(복잡한 분석 결과 아님).
const TYPE_LABELS: Record<ReplyType, string> = {
  natural: "자연스럽게",
  active: "조금 더 적극적으로",
  emoji_text: "이모티콘과 함께",
  emoji_only: "이모티콘만",
};

// AI 응답의 순서가 흐트러져도 natural → active → emoji_text → emoji_only 순서로 정렬한다.
function orderAiReplies(result: AIReplyOkResult): AIReplyItem[] {
  const order: ReplyType[] = ["natural", "active", "emoji_text", "emoji_only"];
  const used = new Set<AIReplyItem>();
  const ordered: AIReplyItem[] = [];

  for (const type of order) {
    const found = result.replies.find((r) => r.type === type && !used.has(r));
    if (found) {
      ordered.push(found);
      used.add(found);
    }
  }
  for (const reply of result.replies) {
    if (!used.has(reply)) ordered.push(reply);
  }
  return ordered;
}

// 붙여넣기와 직접 입력을 하나의 입력창으로 합친 대신, 내용 형태로 서버 힌트를 자동 판단한다.
// "상대방:"/"나:" 형식이면 직접 입력에 가깝게, 그 외에는 그대로 붙여넣은 대화로 간주한다.
function detectInputMode(text: string): "paste" | "write" {
  return /(^|\n)\s*(상대방|나)\s*[:：]/.test(text) ? "write" : "paste";
}

function AttachIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export default function Home() {
  const [conversationText, setConversationText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [showAttach, setShowAttach] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [style, setStyle] = useState<ReplyStyle>(REPLY_STYLES[0]);
  const [relationship, setRelationship] = useState<Relationship>(DEFAULT_RELATIONSHIP);
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [speechLevel, setSpeechLevel] = useState<SpeechLevel>(DEFAULT_SPEECH_LEVEL);

  const [aiResult, setAiResult] = useState<AIReplyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refiningType, setRefiningType] = useState<ReplyType | null>(null);
  const isRequestInFlight = useRef(false);
  // 긴 대화에서 서버가 만든 핵심 맥락을 브라우저 세션 동안만 재사용한다(서버 저장 없음).
  // 같은 대화 텍스트일 때만 재사용하고, 대화가 바뀌면 자동으로 무시된다.
  const conversationContextCacheRef = useRef<{
    conversation: string;
    context: ConversationContextData;
  } | null>(null);

  const hasImages = images.length > 0;
  const hasInput = useMemo(
    () => conversationText.trim().length > 0 || hasImages,
    [conversationText, hasImages],
  );

  const handleAddImages = (files: FileList) => {
    // files는 input의 실시간 FileList라서, 호출자가 뒤이어 input.value를 초기화하면
    // 비워질 수 있다. setImages 콜백 밖에서 즉시 배열로 변환해 값을 고정한다.
    const selectedFiles = Array.from(files);

    setImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const added: UploadedImage[] = selectedFiles.slice(0, remaining).map((file) => ({
        id: `img-${Date.now()}-${imageIdCounter++}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...added];
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const handleMoveImage = (id: string, direction: "left" | "right") => {
    setImages((prev) => {
      const index = prev.findIndex((image) => image.id === id);
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // 실제 AI 호출. 중복 클릭으로 여러 번 호출되지 않도록 막는다.
  const runAiGenerate = async () => {
    if (isRequestInFlight.current) return;

    // 다시 추천 시 같은 문장이 반복되지 않도록 직전 답변을 함께 전달한다(대화 재분석은 하지 않음).
    const previousReplies =
      aiResult && aiResult.status === "ok" ? aiResult.replies.map((r) => r.text) : undefined;

    if (hasImages) {
      isRequestInFlight.current = true;
      setIsLoading(true);
      setErrorMessage(null);
      setNotice(null);

      let resizedImages;
      try {
        resizedImages = await Promise.all(images.map((image) => resizeImageFile(image.file)));
      } catch {
        isRequestInFlight.current = false;
        setIsLoading(false);
        setAiResult(null);
        setErrorMessage("이미지를 처리하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const response = await generateReplies({
        inputMode: "file",
        style,
        relationship,
        goal,
        speechLevel,
        previousReplies,
        images: resizedImages,
        note: conversationText.trim().length > 0 ? conversationText.trim() : undefined,
      });

      isRequestInFlight.current = false;
      setIsLoading(false);

      if (response.ok) {
        setAiResult(response.result);
      } else {
        setAiResult(null);
        setErrorMessage(response.message);
      }
      return;
    }

    const conversation = conversationText;
    if (conversation.trim().length === 0) return;

    // 같은 대화라면 이전에 캐시해둔 핵심 맥락을 재사용해 긴 대화를 다시 요약하지 않는다.
    const cachedContext =
      conversationContextCacheRef.current?.conversation === conversation
        ? conversationContextCacheRef.current.context
        : undefined;

    isRequestInFlight.current = true;
    setIsLoading(true);
    setErrorMessage(null);
    setNotice(null);

    const response = await generateReplies({
      inputMode: detectInputMode(conversation),
      style,
      relationship,
      goal,
      speechLevel,
      previousReplies,
      conversation,
      conversationContext: cachedContext,
    });

    isRequestInFlight.current = false;
    setIsLoading(false);

    if (response.ok) {
      setAiResult(response.result);
      setNotice(response.notice ?? null);
      conversationContextCacheRef.current = response.conversationContext
        ? { conversation, context: response.conversationContext }
        : null;
    } else {
      setAiResult(null);
      setErrorMessage(response.message);
    }
  };

  const handleRecommend = () => void runAiGenerate();
  const handleRetry = () => void runAiGenerate();

  // 답변 카드 하나만 다듬는다. 전체 대화를 다시 분석하지 않고 최소한의 AI 호출로 처리한다.
  const handleRefine = async (type: ReplyType, adjustment: RefineAdjustment) => {
    if (!aiResult || aiResult.status !== "ok" || refiningType !== null) return;
    const target = aiResult.replies.find((r) => r.type === type);
    if (!target) return;

    setRefiningType(type);
    setErrorMessage(null);

    const response = await refineReply({
      text: target.text,
      adjustment,
      language: aiResult.language,
      relationship: aiResult.context.relationship,
      goal: aiResult.context.goal,
      tone: aiResult.context.tone,
    });

    setRefiningType(null);

    if (response.ok) {
      setAiResult((prev) => {
        if (!prev || prev.status !== "ok") return prev;
        return {
          ...prev,
          replies: prev.replies.map((r) =>
            r.type === type
              ? { ...r, text: response.result.text, translationKo: response.result.translationKo }
              : r,
          ),
        };
      });
    } else {
      setErrorMessage(response.message);
    }
  };

  const displayReplies: DisplayReply[] | null = useMemo(() => {
    if (!aiResult || aiResult.status !== "ok") return null;
    return orderAiReplies(aiResult).map((reply) => ({
      type: reply.type,
      text: reply.text,
      translation: reply.translationKo,
    }));
  }, [aiResult]);

  const quickEmojis = aiResult && aiResult.status === "ok" ? aiResult.quickEmojis : [];

  const unreadableMessage =
    aiResult && aiResult.status === "unreadable" ? aiResult.message : null;

  return (
    <div className="min-h-full flex-1 bg-stone-50">
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-6">
        <header className="flex items-center">
          {/* TODO: 공식 로고 파일(public/logo.png) 수신 후 아래 자리표시자를
              <img src="/logo.png" alt="말해줄게" className="h-9 w-9 rounded-full object-contain" /> 로 교체 */}
          <div
            aria-label="말해줄게 로고 자리(임시)"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-[10px] font-medium text-emerald-700"
          >
            로고
          </div>
        </header>

        <p className="text-center text-xs text-slate-500">상황에 맞는 답변을 추천해드려요.</p>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">상대방 대화</h2>
            <p className="text-xs text-slate-500">
              상대방이 보낸 대화를 붙여넣거나 입력하세요
            </p>
          </div>

          <textarea
            value={conversationText}
            onChange={(event) => setConversationText(event.target.value)}
            placeholder={
              hasImages
                ? "추가 설명 (선택)\n예: 최근 조금 어색해졌어요 / 제가 먼저 만나자고 하고 싶어요"
                : "상대방: 오늘 뭐해요?\n나: 아직 특별한 일정은 없어요.\n상대방: 그러면 저녁에 볼래요?"
            }
            className="h-64 w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 outline-none focus:border-emerald-400"
          />

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowAttach((prev) => !prev)}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <AttachIcon />
              사진 첨부
            </button>
            <span className="text-[11px] text-slate-400">대화 내용은 저장하지 않습니다.</span>
          </div>

          {(showAttach || hasImages) && (
            <ImageUploader
              images={images}
              onAdd={handleAddImages}
              onRemove={handleRemoveImage}
              onMove={handleMoveImage}
            />
          )}
        </section>

        <section className="space-y-3">
          <ChipSelect
            label="관계"
            value={relationship}
            primaryOptions={PRIMARY_RELATIONSHIPS}
            allOptions={RELATIONSHIPS}
            onChange={setRelationship}
          />
          <ChipSelect
            label="말투"
            value={speechLevel}
            primaryOptions={SPEECH_LEVELS}
            allOptions={SPEECH_LEVELS}
            onChange={setSpeechLevel}
          />
        </section>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            {showAdvanced ? "답변 설정 접기" : "답변 설정 더보기"}
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <LabeledSelect label="내가 원하는 방향" value={goal} options={GOALS} onChange={setGoal} />
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">답변 스타일</span>
                <StyleSelector value={style} onChange={setStyle} />
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!hasInput || isLoading}
          onClick={handleRecommend}
          className="h-14 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isLoading ? "답변을 만들고 있어요..." : "답변 추천"}
        </button>

        {errorMessage && <p className="text-center text-sm text-red-600">{errorMessage}</p>}
        {unreadableMessage && (
          <p className="text-center text-sm text-amber-600">{unreadableMessage}</p>
        )}
        {notice && <p className="text-center text-xs text-slate-400">{notice}</p>}

        {displayReplies && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">추천 답변</h2>
            <div className="space-y-3">
              {displayReplies.map((reply, i) => {
                const emojiOnly = reply.type === "emoji_only";
                return (
                  <ReplyResultCard
                    key={reply.type}
                    index={i}
                    text={reply.text}
                    translation={reply.translation}
                    emojiOnly={emojiOnly}
                    typeLabel={TYPE_LABELS[reply.type]}
                    onRefine={
                      emojiOnly
                        ? undefined
                        : (adjustment) => void handleRefine(reply.type, adjustment)
                    }
                    isRefining={refiningType === reply.type}
                  />
                );
              })}
            </div>

            <QuickEmojis emojis={quickEmojis} />

            <button
              type="button"
              onClick={handleRetry}
              disabled={isLoading}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              다시 추천
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
