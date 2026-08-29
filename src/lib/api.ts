import type { AIReplyResult, ReplyStyle } from "./types";

export interface GenerateRepliesInput {
  conversation: string;
  style: ReplyStyle;
  inputMode: "paste" | "write";
}

export type GenerateRepliesResult =
  | { ok: true; result: AIReplyResult }
  | { ok: false; message: string };

const FAILURE_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";

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
