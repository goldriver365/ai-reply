import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { UserStyleProfileSchema } from "@/lib/replySchema";
import { MY_STYLE_SYSTEM_PROMPT, buildMyStylePrompt } from "@/lib/prompt";
import type { UserStyleProfile } from "@/lib/types";

export const runtime = "nodejs";

// "내 말투 기억"(STEP 10)은 사용자가 붙여넣은 예시 메시지 2~5개로 스타일만 뽑아내는 저비용 호출 1회다.
const MIN_SAMPLES = 2;
const MAX_SAMPLES = 5;
const MAX_SAMPLE_LENGTH = 200;
// AI 응답이 구조화 JSON 형식에 맞지 않는 드문 경우에 대비한 안전한 재시도. 무한 재시도는 하지 않는다.
const MAX_PARSE_ATTEMPTS = 2;

const GENERIC_ERROR_MESSAGE = "말투를 기억하지 못했습니다. 다시 시도해주세요.";

function parseSamples(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const samples = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, MAX_SAMPLES)
    .map((s) => s.trim().slice(0, MAX_SAMPLE_LENGTH));
  return samples.length >= MIN_SAMPLES ? samples : null;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { samples } = (body ?? {}) as { samples?: unknown };
  const parsedSamples = parseSamples(samples);
  if (!parsedSamples) {
    return NextResponse.json(
      { error: "말투를 파악하려면 메시지를 2개 이상 입력해주세요." },
      { status: 400 },
    );
  }

  try {
    const client = getAnthropicClient();
    const promptContent = buildMyStylePrompt(parsedSamples);

    // AI 응답이 구조화 JSON 형식에 맞지 않는 드문 경우, 무한 재시도가 아니라 1회만 안전하게
    // 다시 시도한다(섹션 23). 그래도 실패하면 일반적인 오류 메시지로 처리한다.
    let parsed: UserStyleProfile | null = null;
    for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS && !parsed; attempt++) {
      const response = await client.messages.parse({
        model: "claude-sonnet-5",
        max_tokens: 300,
        output_config: {
          effort: "low",
          format: zodOutputFormat(UserStyleProfileSchema),
        },
        system: [
          {
            type: "text",
            text: MY_STYLE_SYSTEM_PROMPT,
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

    // 예시 원문(parsedSamples)은 응답에도, 로그에도 담지 않는다 — 결과(스타일 카테고리)만 반환한다.
    return NextResponse.json({ result: parsed });
  } catch (error) {
    // 예시 메시지 원문은 절대 로그에 남기지 않는다. 오류 종류/상태 코드 등 메타데이터만 남긴다.
    if (error instanceof Anthropic.APIError) {
      console.error("analyze-my-style Anthropic API error", { status: error.status, name: error.name });
    } else {
      console.error("analyze-my-style failed", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}
