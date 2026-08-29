import type { UserStyleProfile } from "./types";

// "내 말투"는 사용자가 [내 말투 기억]을 직접 눌렀을 때만(opt-in) 이 기기의 localStorage에 저장한다(STEP 10).
// 서버/DB에는 저장하지 않으며, 원본 대화나 예시 문장 자체도 저장하지 않는다 — 스타일 값 5개 필드만 저장한다.
const STORAGE_KEY = "ai-reply:my-style";

function isValidProfile(value: unknown): value is UserStyleProfile {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.speechLevel === "string" &&
    typeof v.averageLength === "string" &&
    typeof v.emojiUsage === "string" &&
    typeof v.laughterStyle === "string" &&
    typeof v.directness === "string" &&
    (v.confidence === "low" || v.confidence === "medium" || v.confidence === "high")
  );
}

// 개인정보 보호 모드, 저장 공간 없음 등으로 localStorage 접근 자체가 던질 수 있으므로 항상 감싼다.
export function loadUserStyleProfile(): UserStyleProfile | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isValidProfile(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveUserStyleProfile(profile: UserStyleProfile): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // 저장 실패(프라이빗 모드 등)는 조용히 무시한다. 이번 세션 동안은 메모리 상태로 계속 동작한다.
  }
}

export function clearUserStyleProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
