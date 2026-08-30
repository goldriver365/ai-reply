import type { MetadataRoute } from "next";

// 홈 화면에 추가했을 때(Android/PWA 설치) 쓰이는 앱 정보. 아이콘은 기존 말순이
// 로고(public/logo.png)를 크기만 바꿔 저장해둔 파일이며, 캐릭터 자체는 그대로다.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "내가 말해줄게",
    short_name: "내가 말해줄게",
    description: "대화를 붙여넣거나 스크린샷을 올리면 상황에 맞는 답장 4개를 추천해드려요.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#059669",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
