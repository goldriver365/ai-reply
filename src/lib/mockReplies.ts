import type { ReplyStyle } from "./types";

// 1단계는 AI를 연결하지 않으므로, 화면 동작 확인용 테스트 답변만 제공한다.
export const REPLY_STYLES: ReplyStyle[] = [
  "자연스럽게",
  "친근하게",
  "정중하게",
  "짧게",
  "적극적으로",
  "부드럽게 거절",
];

export const MOCK_REPLY_SETS: string[][] = [
  [
    "네, 좋아요. 몇 시가 편하세요?",
    "좋아요. 저도 괜찮습니다. 편한 시간 알려주세요.",
    "네 가능합니다. 시간 정해지면 편하게 알려주세요.",
  ],
  [
    "좋아요, 그럼 이따 저녁에 봬요.",
    "네! 장소는 어디가 편하실까요? 제가 맞춰볼게요.",
    "오늘은 일정이 있어서, 다음에 편하실 때 봬도 될까요?",
  ],
  [
    "네 좋습니다, 몇 시쯤이 좋을까요?",
    "좋아요, 오랜만에 얼굴 보면 좋을 것 같아요!",
    "죄송한데 오늘은 조금 어려울 것 같아요. 다음에 봬요.",
  ],
];

export function getMockReplySet(index: number): string[] {
  return MOCK_REPLY_SETS[index % MOCK_REPLY_SETS.length];
}
