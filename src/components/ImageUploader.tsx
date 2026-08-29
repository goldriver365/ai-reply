"use client";

import type { UploadedImage } from "@/lib/types";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

export default function ImageUploader({
  images,
  onAdd,
  onRemove,
}: {
  images: UploadedImage[];
  onAdd: (files: FileList) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center hover:bg-slate-100">
        <span className="text-sm font-medium text-slate-700">
          대화 스크린샷을 선택하세요
        </span>
        <span className="text-xs text-slate-400">
          JPG · JPEG · PNG · WEBP (여러 장 선택 가능)
        </span>
        <input
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
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
          {images.map((image) => (
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
              <button
                type="button"
                onClick={() => onRemove(image.id)}
                aria-label="이미지 삭제"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs font-bold leading-none text-white"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
