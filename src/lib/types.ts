export type InputMode = "paste" | "file" | "write";

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

// AI가 생성하는 답변 3개의 전략 구분
export type ReplyType = "best" | "active" | "gentle";

export interface AIReplyItem {
  type: ReplyType;
  text: string;
  /** text가 한국어가 아닐 때의 한국어 번역. 한국어 답변이면 null. */
  translationKo: string | null;
  /** 한 줄을 넘지 않는 짧은 답변 전략 설명(심리 진단 아님). 예: "가장 자연스러운 답변" */
  reason: string;
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
