"use client";

import { useMemo, useState } from "react";
import ImageUploader from "@/components/ImageUploader";
import ModeSelector from "@/components/ModeSelector";
import ReplyResultCard from "@/components/ReplyResultCard";
import StyleSelector from "@/components/StyleSelector";
import { getMockReplySet, REPLY_STYLES } from "@/lib/mockReplies";
import type { InputMode, ReplyStyle, UploadedImage } from "@/lib/types";

let imageIdCounter = 0;

export default function Home() {
  const [mode, setMode] = useState<InputMode>("paste");
  const [pasteText, setPasteText] = useState("");
  const [writeText, setWriteText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [style, setStyle] = useState<ReplyStyle>(REPLY_STYLES[0]);
  const [resultSetIndex, setResultSetIndex] = useState<number | null>(null);

  const hasInput = useMemo(() => {
    if (mode === "paste") return pasteText.trim().length > 0;
    if (mode === "write") return writeText.trim().length > 0;
    return images.length > 0;
  }, [mode, pasteText, writeText, images]);

  const handleAddImages = (files: FileList) => {
    const added: UploadedImage[] = Array.from(files).map((file) => ({
      id: `img-${Date.now()}-${imageIdCounter++}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));
    setImages((prev) => [...prev, ...added]);
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const handleRecommend = () => {
    setResultSetIndex(0);
  };

  const handleRetry = () => {
    setResultSetIndex((prev) => (prev === null ? 0 : prev + 1));
  };

  const results = resultSetIndex === null ? null : getMockReplySet(resultSetIndex);

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
          <ModeSelector value={mode} onChange={setMode} />

          {mode === "paste" && (
            <textarea
              value={pasteText}
              onChange={(event) => setPasteText(event.target.value)}
              placeholder="카카오톡, LINE, WhatsApp, 문자 등 대화 내용을 붙여넣으세요"
              className="h-48 w-full resize-none rounded-xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-900 outline-none focus:border-indigo-400"
            />
          )}

          {mode === "file" && (
            <ImageUploader
              images={images}
              onAdd={handleAddImages}
              onRemove={handleRemoveImage}
            />
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
          disabled={!hasInput}
          onClick={handleRecommend}
          className="h-14 w-full rounded-xl bg-indigo-600 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          답변 추천받기
        </button>

        {results && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">추천 답변</h2>
            <div className="space-y-3">
              {results.map((text, i) => (
                <ReplyResultCard key={i} index={i} text={text} />
              ))}
            </div>
            <button
              type="button"
              onClick={handleRetry}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              다시 추천
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
