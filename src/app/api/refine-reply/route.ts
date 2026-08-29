import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { RefineResponseSchema, UserStyleProfileSchema } from "@/lib/replySchema";
import { REFINE_SYSTEM_PROMPT, buildRefinePrompt } from "@/lib/prompt";
import type { RefineAdjustment, RefineResponse } from "@/lib/types";

export const runtime = "nodejs";

// 답변 하나만 다듬는 요청이므로 각 필드 길이를 짧게 제한한다(비용 최소화).
const MAX_TEXT_LENGTH = 500;
const MAX_CONTEXT_FIELD_LENGTH = 100;
// "직접 입력" 지시문은 짧은 한 마디 정도만 받는다(예: "조금 더 차갑게").
const MAX_CUSTOM_INSTRUCTION_LENGTH = 60;
// AI 응답이 구조화 JSON 형식에 맞지 않는 드문 경우에 대비한 안전한 재시도. 무한 재시도는 하지 않는다.
const MAX_PARSE_ATTEMPTS = 2;

const GENERIC_ERROR_MESSAGE = "답변을 조정하지 못했습니다. 다시 시도해주세요.";
const ADJUSTMENTS: readonly RefineAdjustment[] = [
  "shorter",
  "softer",
  "friendlier",
  "polite",
  "natural",
  "noQuestion",
  "emojiAdd",
  "emojiRemove",
  "custom",
  "myStyle",
];

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

  const {
    text,
    adjustment,
    customInstruction,
    language,
    relationship,
    goal,
    tone,
    speechLevel,
    myStyle,
  } = (body ?? {}) as {
    text?: unknown;
    adjustment?: unknown;
    customInstruction?: unknown;
    language?: unknown;
    relationship?: unknown;
    goal?: unknown;
    tone?: unknown;
    speechLevel?: unknown;
    myStyle?: unknown;
  };

  if (typeof text !== "string" || text.trim().length === 0) {
    return NextResponse.json({ error: "조정할 답변이 없습니다." }, { status: 400 });
  }
  if (!isAdjustment(adjustment)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  if (
    adjustment === "custom" &&
    (typeof customInstruction !== "string" || customInstruction.trim().length === 0)
  ) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }
  const parsedMyStyle = UserStyleProfileSchema.safeParse(myStyle);
  if (adjustment === "myStyle" && !parsedMyStyle.success) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  try {
    const client = getAnthropicClient();
    const promptContent = buildRefinePrompt({
      text: text.trim().slice(0, MAX_TEXT_LENGTH),
      adjustment,
      customInstruction:
        adjustment === "custom" && typeof customInstruction === "string"
          ? customInstruction.trim().slice(0, MAX_CUSTOM_INSTRUCTION_LENGTH)
          : undefined,
      language: toContextField(language, "알 수 없음"),
      relationship: toContextField(relationship, "자동 판단"),
      goal: toContextField(goal, "자동 추천"),
      tone: toContextField(tone, "알 수 없음"),
      speechLevel: toContextField(speechLevel, "자동"),
      myStyle: adjustment === "myStyle" && parsedMyStyle.success ? parsedMyStyle.data : undefined,
    });

    // AI 응답이 구조화 JSON 형식에 맞지 않는 드문 경우, 무한 재시도가 아니라 1회만 안전하게
    // 다시 시도한다(섹션 23). 그래도 실패하면 일반적인 오류 메시지로 처리한다.
    let parsed: RefineResponse | null = null;
    for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS && !parsed; attempt++) {
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
        messages: [{ role: "user", content: promptContent }],
      });
      parsed = response.parsed_output ?? null;
    }

    if (!parsed) {
      return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
    }

    return NextResponse.json({ result: parsed });
  } catch (error) {
    // 답변 원문은 로그에 남기지 않는다. 오류 종류/상태 코드 등 메타데이터만 남긴다.
    if (error instanceof Anthropic.APIError) {
      console.error("refine-reply Anthropic API error", { status: error.status, name: error.name });
    } else {
      console.error("refine-reply failed", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}
