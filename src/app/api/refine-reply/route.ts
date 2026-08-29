import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { RefineResponseSchema } from "@/lib/replySchema";
import { REFINE_SYSTEM_PROMPT, buildRefinePrompt } from "@/lib/prompt";
import type { RefineAdjustment } from "@/lib/types";

export const runtime = "nodejs";

// 답변 하나만 다듬는 요청이므로 각 필드 길이를 짧게 제한한다(비용 최소화).
const MAX_TEXT_LENGTH = 500;
const MAX_CONTEXT_FIELD_LENGTH = 100;

const GENERIC_ERROR_MESSAGE = "답변을 조정하지 못했습니다. 다시 시도해주세요.";
const ADJUSTMENTS: readonly RefineAdjustment[] = ["shorter", "friendlier", "polite"];

function isAdjustment(value: unknown): value is RefineAdjustment {
  return typeof value === "string" && (ADJUSTMENTS as readonly string[]).includes(value);
}

function toContextField(value: unknown, fallback: string): string {
  if (typeof value !== "string" || value.trim().length === 0) return fallback;
  return value.trim().slice(0, MAX_CONTEXT_FIELD_LENGTH);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { text, adjustment, language, relationship, goal, tone } = (body ?? {}) as {
    text?: unknown;
    adjustment?: unknown;
    language?: unknown;
    relationship?: unknown;
    goal?: unknown;
    tone?: unknown;
  };

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "조정할 답변이 없습니다." }, { status: 400 });
  }
  if (!isAdjustment(adjustment)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const client = getAnthropicClient();

    const response = await client.messages.parse({
      model: "claude-sonnet-5",
      max_tokens: 512,
      output_config: {
        effort: "low",
        format: zodOutputFormat(RefineResponseSchema),
      },
      system: [
        {
          type: "text",
          text: REFINE_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [
        {
          role: "user",
          content: buildRefinePrompt({
            text: text.trim().slice(0, MAX_TEXT_LENGTH),
            adjustment,
            language: toContextField(language, "알 수 없음"),
            relationship: toContextField(relationship, "자동 판단"),
            goal: toContextField(goal, "자동 추천"),
            tone: toContextField(tone, "알 수 없음"),
          }),
        },
      ],
    });

    const parsed = response.parsed_output;
    if (!parsed) {
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    return NextResponse.json({ result: parsed });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      console.error("refine-reply Anthropic API error", error.status, error.message);
    } else {
      console.error("refine-reply failed", error);
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}
