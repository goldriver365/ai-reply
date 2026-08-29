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

export interface AIReplyResult {
  language: string;
  analysisConfidence: "low" | "medium" | "high";
  replies: AIReplyItem[];
}
