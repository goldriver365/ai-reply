"use client";

import type { UploadedImage } from "@/lib/types";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

export const MAX_IMAGES = 6;

export default function ImageUploader({
  images,
  onAdd,
  onRemove,
  onMove,
}: {
  images: UploadedImage[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "left" | "right") => void;
}) {
  const reachedLimit = images.length >= MAX_IMAGES;

  return (
    <div className="space-y-3">
      <label
        className={`flex flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center ${
          reachedLimit ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-slate-100"
        }`}
      >
        <span className="text-sm font-medium text-slate-700">
          대화 스크린샷을 선택하세요
        </span>
        <span className="text-xs text-slate-400">
          JPG · JPEG · PNG · WEBP (최대 {MAX_IMAGES}장, 업로드 순서 = 대화 순서)
        </span>
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          disabled={reachedLimit}
          className="hidden"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) {
              onAdd(event.target.files);
            }
            event.target.value = "";
          }}
        />
      </label>

      {images.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {images.map((image, index) => (
            <div
              key={image.id}
              className="relative aspect-square overflow-hidden rounded-lg bg-slate-100"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.previewUrl}
                alt="업로드한 대화 스크린샷"
                className="h-full w-full object-cover"
              />
              <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-[11px] font-semibold leading-none text-white">
                {index + 1}
              </span>
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label="이미지 삭제"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold leading-none text-white"
              >
                ×
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <button
                  type="button"
                  onClick={() => onMove(image.id, "left")}
                  disabled={index === 0}
                  aria-label="앞 순서로 이동"
                  className="flex-1 rounded bg-black/60 py-0.5 text-xs leading-none text-white disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => onMove(image.id, "right")}
                  disabled={index === images.length - 1}
                  aria-label="뒤 순서로 이동"
                  className="flex-1 rounded bg-black/60 py-0.5 text-xs leading-none text-white disabled:opacity-30"
                >
                  →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
