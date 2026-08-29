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

// AI가 생성하는 답변 3개의 전략 구분
export type ReplyType = "best" | "active" | "gentle";

export interface AIReplyItem {
  type: ReplyType;
  text: string;
  /** text가 한국어가 아닐 때의 한국어 번역. 한국어 답변이면 null. */
  translationKo: string | null;
}

export interface AIReplyOkResult {
  status: "ok";
  language: string;
  analysisConfidence: "low" | "medium" | "high";
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
