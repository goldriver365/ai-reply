"use client";

import { useEffect, useState } from "react";

// 표준 타입 정의에는 아직 없는 이벤트라 필요한 부분만 직접 선언한다.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "installPromptDismissedAt";
// 한 번 닫으면 이 기간 동안은 다시 띄우지 않는다(매번 뜨면 거슬리므로).
const DISMISS_DURATION_MS = 14 * 24 * 60 * 60 * 1000; // 14일

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari 전용 속성(표준에는 없음).
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    // localStorage를 못 쓰는 환경이면 그냥 이번 방문에서만 배너가 다시 안 뜨는 정도로 넘어간다.
  }
}

// 홈 화면 아이콘이 제대로 나오려면(캐릭터가 보이려면) manifest.ts/app/icon.png/
// app/apple-icon.png가 이미 올바른 크기의 로고 파일을 가리키고 있어야 하고(별도 조치 완료),
// 이 컴포넌트는 그 위에 "홈 화면에 추가"를 유도하는 배너만 추가한다.
// - Android/Chrome: beforeinstallprompt 이벤트를 가로채 직접 만든 배너에서 설치를 띄운다.
// - iOS Safari: beforeinstallprompt 자체가 존재하지 않아(iOS 미지원) 자동으로 띄울 수 없으므로,
//   공유 버튼으로 직접 추가하는 방법을 안내하는 배너만 보여준다.
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // 등록 실패해도 앱 기능에는 영향이 없으므로 조용히 무시한다(설치 배너만 못 뜰 수 있음).
      });
    }

    if (isStandalone() || wasDismissedRecently()) return;

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // iOS Safari는 beforeinstallprompt를 지원하지 않아 UA로 구분해 안내 배너만 보여준다.
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/.test(ua);
    // 마운트 시점에 한 번만 UA를 읽어와 외부 상태(브라우저 종류)를 동기화하는 것으로,
    // 다른 상태를 연쇄적으로 갱신하지 않는다(기존 loadUserStyleProfile 패턴과 동일).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isIos && isSafari) setShowIosHint(true);

    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
  }, []);

  const handleClose = () => {
    setDismissed(true);
    setShowIosHint(false);
    setDeferredPrompt(null);
    markDismissed();
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    markDismissed();
  };

  if (dismissed || (!deferredPrompt && !showIosHint)) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <div className="flex w-full max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-700">내가 말해줄게를 홈 화면에 추가</p>
          <p className="text-[11px] text-slate-500">
            {deferredPrompt
              ? "앱처럼 아이콘으로 바로 열 수 있어요."
              : "공유 버튼 → “홈 화면에 추가”를 눌러주세요."}
          </p>
        </div>
        {deferredPrompt && (
          <button
            type="button"
            onClick={() => void handleInstallClick()}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
          >
            추가
          </button>
        )}
        <button
          type="button"
          onClick={handleClose}
          aria-label="닫기"
          className="shrink-0 text-slate-400 hover:text-slate-600"
        >
          ×
        </button>
      </div>
    </div>
  );
}
