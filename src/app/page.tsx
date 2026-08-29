"use client";

import { useMemo, useRef, useState } from "react";
import ImageUploader, { MAX_IMAGES } from "@/components/ImageUploader";
import ModeSelector from "@/components/ModeSelector";
import ReplyResultCard from "@/components/ReplyResultCard";
import StyleSelector from "@/components/StyleSelector";
import { generateReplies } from "@/lib/api";
import { resizeImageFile } from "@/lib/imageResize";
import { REPLY_STYLES } from "@/lib/replyStyles";
import type {
  AIReplyItem,
  AIReplyOkResult,
  AIReplyResult,
  InputMode,
  ReplyStyle,
  ReplyType,
  UploadedImage,
} from "@/lib/types";

let imageIdCounter = 0;

interface DisplayReply {
  text: string;
  translation?: string | null;
}

// AI 응답의 순서가 흐트러져도 best → active → gentle 순서로 정렬한다.
function orderAiReplies(result: AIReplyOkResult): AIReplyItem[] {
  const order: ReplyType[] = ["best", "active", "gentle"];
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

export default function Home() {
  const [mode, setMode] = useState<InputMode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [writeText, setWriteText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [fileNote, setFileNote] = useState("");
  const [style, setStyle] = useState<ReplyStyle>(REPLY_STYLES[0]);

  const [aiResult, setAiResult] = useState<AIReplyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isRequestInFlight = useRef(false);

  const hasInput = useMemo(() => {
    if (mode === "paste") return pasteText.trim().length > 0;
    if (mode === "write") return writeText.trim().length > 0;
    return images.length > 0;
  }, [mode, pasteText, writeText, images]);

  const handleModeChange = (nextMode: InputMode) => {
    setMode(nextMode);
    setAiResult(null);
    setErrorMessage(null);
  };

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

    if (mode === "file") {
      if (images.length === 0) return;

      isRequestInFlight.current = true;
      setIsLoading(true);
      setErrorMessage(null);

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
        images: resizedImages,
        note: fileNote.trim().length > 0 ? fileNote.trim() : undefined,
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

    const conversation = mode === "write" ? writeText : pasteText;
    if (conversation.trim().length === 0) return;

    isRequestInFlight.current = true;
    setIsLoading(true);
    setErrorMessage(null);

    const response = await generateReplies({
      inputMode: mode,
      style,
      conversation,
    });

    isRequestInFlight.current = false;
    setIsLoading(false);

    if (response.ok) {
      setAiResult(response.result);
    } else {
      setAiResult(null);
      setErrorMessage(response.message);
    }
  };

  const handleRecommend = () => void runAiGenerate();
  const handleRetry = () => void runAiGenerate();

  const displayReplies: DisplayReply[] | null = useMemo(() => {
    if (!aiResult || aiResult.status !== "ok") return null;
    return orderAiReplies(aiResult).map((reply) => ({
      text: reply.text,
      translation: reply.translationKo,
    }));
  }, [aiResult]);

  const unreadableMessage =
    aiResult && aiResult.status === "unreadable" ? aiResult.message : null;

  const recommendLabel = isLoading
    ? mode === "file"
      ? "대화를 분석하고 있습니다..."
      : "답변을 만들고 있습니다..."
    : "답변 추천받기";

  return (
    <div className="min-h-full flex-1 bg-slate-50">
      <main className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 pb-16 pt-8">
        <header className="space-y-1 text-center">
          <h1 className="text-2xl font-bold text-slate-900">AI 답장 추천</h1>
          <p className="text-sm text-slate-500">
            대화를 붙여넣거나 파일을 올리면 다음 답장을 추천해드립니다.
          </p>
        </header>

        <section className="space-y-3">
          <ModeSelector value={mode} onChange={handleModeChange} />

          {mode === "paste" && (
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="카카오톡, LINE, WhatsApp, 문자 등 대화 내용을 붙여넣으세요"
              className="h-48 w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 outline-none focus:border-indigo-400"
            />
          )}

          {mode === "file" && (
            <div className="space-y-3">
              <ImageUploader
                images={images}
                onAdd={handleAddImages}
                onRemove={handleRemoveImage}
                onMove={handleMoveImage}
              />
              <textarea
                value={fileNote}
                onChange={(event) => setFileNote(event.target.value)}
                placeholder="추가 설명 (선택) 예: 최근 조금 어색해졌어요 / 제가 먼저 만나자고 하고 싶어요"
                className="h-20 w-full resize-none rounded-xl border border-slate-200 bg-white p-3 text-sm leading-relaxed text-slate-900 outline-none focus:border-indigo-400"
              />
            </div>
          )}

          {mode === "write" && (
            <textarea
              value={writeText}
              onChange={(event) => setWriteText(event.target.value)}
              placeholder={
                "상대방: 오늘 뭐해요?\n나: 아직 특별한 일정은 없어요.\n상대방: 그러면 저녁에 볼래요?"
              }
              className="h-48 w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 outline-none focus:border-indigo-400"
            />
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">답변 스타일</h2>
          <StyleSelector value={style} onChange={setStyle} />
        </section>

        <button
          type="button"
          disabled={!hasInput || isLoading}
          onClick={handleRecommend}
          className="h-14 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {recommendLabel}
        </button>

        {errorMessage && <p className="text-center text-sm text-red-600">{errorMessage}</p>}
        {unreadableMessage && (
          <p className="text-center text-sm text-amber-600">{unreadableMessage}</p>
        )}

        {displayReplies && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">추천 답변</h2>
            <div className="space-y-3">
              {displayReplies.map((reply, i) => (
                <ReplyResultCard
                  key={i}
                  index={i}
                  text={reply.text}
                  translation={reply.translation}
                />
              ))}
            </div>
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
