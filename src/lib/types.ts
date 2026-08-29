export type ReplyStyle =
  | "자연스럽게"
  | "친근하게"
  | "정중하게"
  | "짧게"
  | "적극적으로"
  | "부드럽게 거절";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
}

// 상대방과의 관계. "자동 판단"이면 AI가 대화에서 추정한다.
export type Relationship =
  | "자동 판단"
  | "처음 대화하는 사람"
  | "지인"
  | "친구"
  | "가까운 친구"
  | "직장 동료"
  | "상사"
  | "고객"
  | "가족"
  | "연인"
  | "호감 있는 사람"
  | "썸 관계"
  | "헤어진 연인"
  | "관계가 어색해진 사람"
  | "갈등 중인 사람"
  | "기타";

// 사용자가 이번 답변으로 원하는 방향. "자동 추천"이면 AI가 상황에 맞게 판단한다.
export type Goal =
  | "자동 추천"
  | "자연스럽게 대화하기"
  | "대화를 계속 이어가기"
  | "친해지고 싶음"
  | "관계를 좋게 만들기"
  | "호감을 자연스럽게 표현"
  | "상대방의 관심 확인"
  | "약속 잡기"
  | "사과하기"
  | "오해 풀기"
  | "상대방을 위로하기"
  | "내 입장을 설명하기"
  | "부드럽게 거절하기"
  | "거리 두기"
  | "대화 마무리하기"
  | "업무적으로 답하기";

// 답변 카드의 "더 짧게/더 친근하게/더 정중하게" 미세 조정 요청
export type RefineAdjustment = "shorter" | "friendlier" | "polite";

// 말투 지정. "자동"이면 AI가 대화에서 관찰한 사용자의 평소 말투를 따른다.
export type SpeechLevel = "자동" | "반말" | "존댓말";

// AI가 생성하는 답변 4개의 형태 구분(STEP 6)
// natural: 가장 자연스럽고 안전한 답변 / active: 조금 더 적극적으로 대화를 이어가는 답변
// emoji_text: 문장 + 이모티콘 조합 / emoji_only: 표준 유니코드 이모티콘만으로 구성된 답변
export type ReplyType = "natural" | "active" | "emoji_text" | "emoji_only";

export interface AIReplyItem {
  type: ReplyType;
  text: string;
  /** text가 한국어가 아닐 때의 한국어 번역. 한국어 답변이면 null. */
  translationKo: string | null;
}

// 실제로 반영된 관계/목적/대화 분위기 요약. 사용자에게 그대로 노출하지 않는 내부 참고 정보.
export interface AIReplyContext {
  relationship: string;
  goal: string;
  tone: string;
}

export interface AIReplyOkResult {
  status: "ok";
  language: string;
  confidence: "low" | "medium" | "high";
  context: AIReplyContext;
  replies: AIReplyItem[];
  /** 현재 대화 분위기에 어울리는 표준 유니코드 이모티콘 몇 개(이모티콘만 보내기 영역용) */
  quickEmojis: string[];
}

// 이미지를 정확히 읽을 수 없는 등, 답변을 억지로 만들지 않고 사용자에게 안내만 하는 경우
export interface AIReplyUnreadableResult {
  status: "unreadable";
  message: string;
}

export type AIReplyResult = AIReplyOkResult | AIReplyUnreadableResult;

// 이미지 넣기(STEP 3)에서 서버로 보내는, 클라이언트에서 리사이즈된 이미지
export interface ResizedImagePayload {
  mediaType: "image/jpeg" | "image/png" | "image/webp";
  data: string;
}

// 답변 하나만 다듬는 요청(STEP 4)의 결과
export interface RefineResponse {
  text: string;
  translationKo: string | null;
}

// 긴 대화에서 추출한 말투 특징(STEP 5)
export interface StyleProfile {
  speechLevel: string;
  averageLength: string;
  emojiUsage: string;
  laughterStyle: string;
  directness: string;
}

// 긴 대화를 매번 전체로 보내지 않기 위한 핵심 맥락 요약(STEP 5).
// 장문 설명이 아닌 최소한의 정보만 담는다. 브라우저 세션 동안만 재사용하고 서버에 저장하지 않는다.
export interface ConversationContextData {
  relationshipSummary: string;
  userStyle: StyleProfile;
  otherPersonStyle: StyleProfile;
  importantHistory: string[];
  openLoops: string[];
  emotionalTrend: string;
  recentContext: string;
}
