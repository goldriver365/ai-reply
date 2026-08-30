import type { Metadata, Viewport } from "next";
import { Gaegu, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 로고 옆 "내가 말해줄게" 타이틀에만 쓰는 손글씨 느낌의 재미있는 글꼴(말순이 캐릭터와
// 어울리도록). Gaegu는 한글 글자가 하나의 파일에 함께 들어있어(라틴/한글이 나뉘어
// 제공되지 않음) subsets를 latin으로만 지정해도 한글이 정상적으로 표시된다.
const gaegu = Gaegu({
  weight: "700",
  subsets: ["latin"],
  variable: "--font-gaegu",
});

const SITE_TITLE = "내가 말해줄게 | AI 답장 추천";
const SITE_DESCRIPTION =
  "대화를 붙여넣거나 스크린샷을 올리면 상황에 맞는 답장 4개를 추천해드려요.";

export const metadata: Metadata = {
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "ko_KR",
    type: "website",
  },
};

// iPhone처럼 화면 모서리가 둥글거나 하단 홈 인디케이터가 있는 기기에서 콘텐츠가
// 그 영역까지 안전하게 확장/인식되도록 한다(safe-area-inset-* 값이 실제로 채워짐).
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} ${gaegu.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
