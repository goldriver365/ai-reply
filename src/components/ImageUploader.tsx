"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import type { UploadedImage } from "@/lib/types";

const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp";

export const MAX_IMAGES = 6;

export interface ImageUploaderHandle {
  /** "사진 첨부" 버튼 등 바깥 UI에서 파일 선택 창을 직접 연다. */
  open: () => void;
}

// 큰 업로드 상자 없이, 선택/붙여넣은 스크린샷이 상대방 대화 입력창 안에 바로 보이도록
// 얇은 썸네일 줄만 그린다(파일 선택 자체는 숨겨진 input을 부모가 open()으로 여는 방식).
const ImageUploader = forwardRef<
  ImageUploaderHandle,
  {
    images: UploadedImage[];
    onAdd: (files: FileList) => void;
    onRemove: (id: string) => void;
    onMove: (id: string, direction: "left" | "right") => void;
    disabled?: boolean;
  }
>(function ImageUploader({ images, onAdd, onRemove, onMove, disabled }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.click(),
  }));

  if (images.length === 0) {
    return (
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onAdd(event.target.files);
          }
          event.target.value = "";
        }}
      />
    );
  }

  return (
    <div className="flex gap-2 overflow-x-auto p-2">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        multiple
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          if (event.target.files && event.target.files.length > 0) {
            onAdd(event.target.files);
          }
          event.target.value = "";
        }}
      />
      {images.map((image, index) => (
        <div
          key={image.id}
          className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.previewUrl}
            alt="업로드한 대화 스크린샷"
            className="h-full w-full object-cover"
          />
          <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] font-semibold leading-none text-white">
            {index + 1}
          </span>
          <button
            type="button"
            onClick={() => onRemove(image.id)}
            aria-label="이미지 삭제"
            className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs font-bold leading-none text-white"
          >
            ×
          </button>
          <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
            <button
              type="button"
              onClick={() => onMove(image.id, "left")}
              disabled={index === 0}
              aria-label="앞 순서로 이동"
              className="flex-1 rounded bg-black/60 py-0.5 text-[10px] leading-none text-white disabled:opacity-30"
            >
              ←
            </button>
            <button
              type="button"
              onClick={() => onMove(image.id, "right")}
              disabled={index === images.length - 1}
              aria-label="뒤 순서로 이동"
              className="flex-1 rounded bg-black/60 py-0.5 text-[10px] leading-none text-white disabled:opacity-30"
            >
              →
            </button>
          </div>
        </div>
      ))}
    </div>
  );
});

export default ImageUploader;
