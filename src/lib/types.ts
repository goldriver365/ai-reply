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

// 답변 카드의 미세 조정 요청(STEP 9에서 옵션 확장: 부드럽게/자연스럽게/질문 없이/이모지 조정/직접 지시 추가)
export type RefineAdjustment =
  | "shorter"
  | "softer"
  | "friendlier"
  | "polite"
  | "natural"
  | "noQuestion"
  | "emojiAdd"
  | "emojiRemove"
  | "custom"
  | "myStyle";

// 말투 지정. "자동"이면 AI가 대화에서 관찰한 사용자의 평소 말투를 따른다.
export type SpeechLevel = "자동" | "반말" | "존댓말";

// 대화 상황 분류(STEP 8). 답변 4개의 역할은 고정 유형이 아니라 이 situation에 따라 달라진다.
export type ReplySituation =
  | "general"
  | "schedule"
  | "decline"
  | "work"
  | "conflict"
  | "apology"
  | "comfort"
  | "casual";

// AI가 생성하는 답변 1개(STEP 8). 배열 안에서의 순서가 곧 추천 우선순위이며,
// label은 상황에 맞게 AI가 자유롭게 정하는 짧은 유형명이다(고정된 목록이 아님).
export interface AIReplyItem {
  label: string;
  text: string;
  /** text가 한국어가 아닐 때의 한국어 번역. 한국어 답변이면 null. */
  translationKo: string | null;
}

// 실제로 반영된 관계/목적/대화 분위기/상황 요약. 사용자에게 그대로 노출하지 않는 내부 참고 정보.
export interface AIReplyContext {
  relationship: string;
  goal: string;
  tone: string;
  situation: ReplySituation;
  /**
   * 마지막 관련 메시지를 누가 보냈는지(STEP 11, 내부 참고용). "me"면 상대방의 새 메시지가
   * 없는 상태일 수 있으므로, 서버가 이 값을 보고 notice로 짧게 안내한다(화면에 직접 노출 X).
   */
  lastMessageFrom: "other" | "me" | "unclear";
}

export interface AIReplyOkResult {
  status: "ok";
  language: string;
  confidence: "low" | "medium" | "high";
  context: AIReplyContext;
  /** 상황에 맞게 역할이 달라지는 답변 4개. index 0이 가장 추천하는 답변이다. */
  replies: AIReplyItem[];
  /** 현재 대화 분위기에 어울리는 짧은 리액션(이모티콘 또는 "ㅋㅋ" 등). 이모티콘만 보내기 영역용 */
  quickReactions: string[];
  /** 짧은 리액션만으로 답하는 것이 지금 상황에 적절한지. false면 이모티콘만 보내기 영역을 숨긴다. */
  showQuickReactions: boolean;
}

// 이미지를 정확히 읽을 수 없는 등, 답변을 억지로 만들지 않고 사용자에게 안내만 하는 경우
export interface AIReplyUnreadableResult {
  status: "unreadable";
  message: string;
}

// 화자(나/상대방) 판단 확신도가 낮을 때(주로 스크린샷), 억지로 추정하지 않고 아주 짧게
// 되묻는 경우(STEP 11). lastMessagePreview는 사용자 본인의 대화 내용이라 그대로 되보여줘도
// 안전하며, 어떤 메시지를 묻는 것인지 알아볼 수 있게 한다.
export interface AIReplyNeedsSpeakerCheckResult {
  status: "needsSpeakerCheck";
  lastMessagePreview: string;
}

export type AIReplyResult =
  | AIReplyOkResult
  | AIReplyUnreadableResult
  | AIReplyNeedsSpeakerCheckResult;

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

// 사용자가 "내 말투 기억"으로 opt-in 등록한 평소 말투(STEP 10).
// 대화 "내용"이 아니라 문체 스타일만 담으며, 이 기기(localStorage)에만 저장하고 서버에는 저장하지 않는다.
export interface UserStyleProfile extends StyleProfile {
  /** 이 스타일 추정에 대한 확신도. 화면에는 숫자로 노출하지 않는다. */
  confidence: "low" | "medium" | "high";
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
