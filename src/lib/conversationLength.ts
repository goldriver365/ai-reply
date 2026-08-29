// 긴 대화를 매번 통째로 AI에 보내지 않기 위한 길이 판단/분할 유틸리티.
// 정확한 토크나이저 대신 문자 수 기반의 대략적인 추정치를 쓴다(별도 라이브러리 불필요).
// 한글 위주 대화는 문자당 토큰 소비가 큰 편이라 다소 보수적으로 잡는다.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.3);
}

// 이 이상이면 "최근 대화 + 과거 핵심 맥락 요약" 구조를 사용한다.
// 이 미만이면 기존 방식대로 전체 대화를 그대로 한 번에 분석한다.
const LONG_CONVERSATION_TOKEN_THRESHOLD = 3000;

export type ConversationLengthTier = "short" | "long";

export function getConversationLengthTier(text: string): ConversationLengthTier {
  return estimateTokens(text) > LONG_CONVERSATION_TOKEN_THRESHOLD ? "long" : "short";
}

// 최근 대화에 배정할 토큰 예산(대략치). 나머지(더 과거)는 요약 대상이 된다.
export const RECENT_CONVERSATION_TOKEN_BUDGET = 2000;

/**
 * 줄바꿈 기준으로 대화를 "최근"과 "그 이전"으로 나눈다.
 * 메시지 한 줄이 중간에 잘리지 않도록 줄 단위로만 자른다.
 */
export function splitRecentAndOlder(
  text: string,
  recentTokenBudget: number = RECENT_CONVERSATION_TOKEN_BUDGET,
): { recent: string; older: string } {
  const lines = text.split("\n");
  const recentLines: string[] = [];
  let usedTokens = 0;

  for (let i = lines.length - 1; i >= 0; i--) {
    const lineTokens = estimateTokens(lines[i]);
    // 최소 한 줄은 항상 "최근"에 포함시킨다.
    if (recentLines.length > 0 && usedTokens + lineTokens > recentTokenBudget) break;
    recentLines.unshift(lines[i]);
    usedTokens += lineTokens;
  }

  const olderLines = lines.slice(0, lines.length - recentLines.length);
  return { recent: recentLines.join("\n"), older: olderLines.join("\n") };
}
