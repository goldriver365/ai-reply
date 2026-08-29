import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { ReplyResponseSchema } from "@/lib/replySchema";
import { REPLY_SYSTEM_PROMPT, buildUserPrompt } from "@/lib/prompt";
import { REPLY_STYLES } from "@/lib/mockReplies";
import type { AIReplyResult, ReplyStyle } from "@/lib/types";

export const runtime = "nodejs";

// 과도하게 긴 대화를 그대로 보내지 않기 위한 문자 수 상한(대략적인 토큰 상한 역할).
const MAX_CONVERSATION_LENGTH = 8000;

const GENERIC_ERROR_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";

function isReplyStyle(value: unknown): value is ReplyStyle {
  return typeof value === "string" && (REPLY_STYLES as readonly string[]).includes(value);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { conversation, style, inputMode } = (body ?? {}) as {
    conversation?: unknown;
    style?: unknown;
    inputMode?: unknown;
  };

  // 빈 대화는 API를 호출하지 않는다.
  if (typeof conversation !== "string" || conversation.trim().length === 0) {
    return NextResponse.json({ error: "대화 내용이 비어 있습니다." }, { status: 400 });
  }

  const trimmedConversation = conversation.trim().slice(0, MAX_CONVERSATION_LENGTH);
  const resolvedStyle: ReplyStyle = isReplyStyle(style) ? style : "자연스럽게";
  const resolvedMode: "paste" | "write" = inputMode === "write" ? "write" : "paste";

  try {
    const client = getAnthropicClient();

    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      output_config: {
        effort: "medium",
        format: zodOutputFormat(ReplyResponseSchema),
      },
      system: [
        {
          type: "text",
          text: REPLY_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildUserPrompt({
            conversation: trimmedConversation,
            style: resolvedStyle,
            inputMode: resolvedMode,
          }),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    const result: AIReplyResult = parsed;
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("generate-replies Anthropic API error", error.status, error.message);
    } else {
      console.error("generate-replies failed", error);
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}
