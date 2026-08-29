import type {
  AIReplyResult,
  Goal,
  RefineAdjustment,
  RefineResponse,
  Relationship,
  ReplyStyle,
  ResizedImagePayload,
} from "./types";

export type GenerateRepliesInput = {
  style: ReplyStyle;
  relationship: Relationship;
  goal: Goal;
  /** 다시 추천 시, 같은 문장이 반복되지 않도록 참고용으로 전달하는 직전 답변들 */
  previousReplies?: string[];
} & (
  | { inputMode: "paste" | "write"; conversation: string }
  | { inputMode: "file"; images: ResizedImagePayload[]; note?: string }
);

export type GenerateRepliesResult =
  | { ok: true; result: AIReplyResult }
  | { ok: false; message: string };

const FAILURE_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";
const REFINE_FAILURE_MESSAGE = "답변을 조정하지 못했습니다. 다시 시도해주세요.";

export async function generateReplies(
  input: GenerateRepliesInput,
): Promise<GenerateRepliesResult> {
  try {
    const res = await fetch("/api/generate-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => null)) as
      | { result: AIReplyResult }
      | { error: string }
      | null;

    if (!res.ok || !data || !("result" in data)) {
      return { ok: false, message: FAILURE_MESSAGE };
    }

    return { ok: true, result: data.result };
  } catch {
    return { ok: false, message: FAILURE_MESSAGE };
  }
}

export interface RefineReplyInput {
  text: string;
  adjustment: RefineAdjustment;
  language: string;
  relationship: string;
  goal: string;
  tone: string;
}

export type RefineReplyResult =
  | { ok: true; result: RefineResponse }
  | { ok: false; message: string };

// 답변 하나만 다듬는 요청. 전체 대화를 다시 보내지 않고 원래 답변과 짧은 맥락만 전송한다.
export async function refineReply(input: RefineReplyInput): Promise<RefineReplyResult> {
  try {
    const res = await fetch("/api/refine-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => null)) as
      | { result: RefineResponse }
      | { error: string }
      | null;

    if (!res.ok || !data || !("result" in data)) {
      return { ok: false, message: REFINE_FAILURE_MESSAGE };
    }

    return { ok: true, result: data.result };
  } catch {
    return { ok: false, message: REFINE_FAILURE_MESSAGE };
  }
}
