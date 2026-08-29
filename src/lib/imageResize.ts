import type { ResizedImagePayload } from "./types";

// Vision 분석 비용(토큰)을 줄이기 위해 업로드 이미지를 적당한 해상도로 축소·압축한다.
// 채팅 스크린샷은 글자만 읽으면 되므로 이 정도 해상도로도 충분하다.
const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

export function resizeImageFile(file: File): Promise<ResizedImagePayload> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("이미지를 처리할 캔버스를 생성하지 못했습니다."));
          return;
        }

        // 투명 배경(PNG 등)이 JPEG 변환 시 검게 나오지 않도록 흰 배경을 먼저 채운다.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
        const data = dataUrl.slice(dataUrl.indexOf(",") + 1);
        resolve({ mediaType: "image/jpeg", data });
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 불러오지 못했습니다."));
    };

    img.src = objectUrl;
  });
}
