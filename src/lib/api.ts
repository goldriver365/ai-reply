import type { AIReplyResult, ReplyStyle, ResizedImagePayload } from "./types";

export type GenerateRepliesInput =
  | { inputMode: "paste" | "write"; style: ReplyStyle; conversation: string }
  | {
      inputMode: "file";
      style: ReplyStyle;
      images: ResizedImagePayload[];
      note?: string;
    };

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
