import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import { ReplyResponseSchema } from "@/lib/replySchema";
import { REPLY_SYSTEM_PROMPT, buildFileInstructionText, buildUserPrompt } from "@/lib/prompt";
import { REPLY_STYLES } from "@/lib/replyStyles";
import type { AIReplyResult, ReplyStyle } from "@/lib/types";

export const runtime = "nodejs";

// 과도하게 긴 대화를 그대로 보내지 않기 위한 문자 수 상한(대략적인 토큰 상한 역할).
const MAX_CONVERSATION_LENGTH = 8000;
const MAX_NOTE_LENGTH = 500;

// 여러 장을 하나의 요청에 담되, 비용이 과도해지지 않도록 장수를 제한한다.
const MAX_IMAGES = 6;
// 클라이언트에서 리사이즈된 이미지라도 비정상적으로 큰 페이로드는 거부한다(base64 문자 수 기준, 대략 6MB 디코딩).
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;

const GENERIC_ERROR_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isReplyStyle(value: unknown): value is ReplyStyle {
  return typeof value === "string" && (REPLY_STYLES as readonly string[]).includes(value);
}

function isAllowedImageType(value: unknown): value is AllowedImageType {
  return typeof value === "string" && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

interface ValidatedImage {
  mediaType: AllowedImageType;
  data: string;
}

function parseImages(value: unknown): ValidatedImage[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const result: ValidatedImage[] = [];
  for (const item of value.slice(0, MAX_IMAGES)) {
    if (typeof item !== "object" || item === null) return null;
    const { mediaType, data } = item as { mediaType?: unknown; data?: unknown };
    if (!isAllowedImageType(mediaType)) return null;
    if (typeof data !== "string" || data.length === 0 || data.length > MAX_IMAGE_BASE64_LENGTH) {
      return null;
    }
    result.push({ mediaType, data });
  }
  return result;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const { conversation, style, inputMode, images, note } = (body ?? {}) as {
    conversation?: unknown;
    style?: unknown;
    inputMode?: unknown;
    images?: unknown;
    note?: unknown;
  };

  const resolvedStyle: ReplyStyle = isReplyStyle(style) ? style : "자연스럽게";
  const isFileMode = inputMode === "file";

  let userContent: Anthropic.MessageParam["content"];

  if (isFileMode) {
    const validatedImages = parseImages(images);
    // 빈 입력(이미지 없음)은 API를 호출하지 않는다.
    if (!validatedImages) {
      return NextResponse.json({ error: "분석할 이미지가 없습니다." }, { status: 400 });
    }

    const resolvedNote =
      typeof note === "string" && note.trim().length > 0
        ? note.trim().slice(0, MAX_NOTE_LENGTH)
        : undefined;

    const content: Anthropic.MessageParam["content"] = [];
    validatedImages.forEach((image, index) => {
      content.push({ type: "text", text: `[스크린샷 ${index + 1}]` });
      content.push({
        type: "image",
        source: { type: "base64", media_type: image.mediaType, data: image.data },
      });
    });
    content.push({
      type: "text",
      text: buildFileInstructionText({
        style: resolvedStyle,
        imageCount: validatedImages.length,
        note: resolvedNote,
      }),
    });
    userContent = content;
  } else {
    // 빈 대화는 API를 호출하지 않는다.
    if (typeof conversation !== "string" || conversation.trim().length === 0) {
      return NextResponse.json({ error: "대화 내용이 비어 있습니다." }, { status: 400 });
    }

    const trimmedConversation = conversation.trim().slice(0, MAX_CONVERSATION_LENGTH);
    const resolvedMode: "paste" | "write" = inputMode === "write" ? "write" : "paste";

    userContent = buildUserPrompt({
      conversation: trimmedConversation,
      style: resolvedStyle,
      inputMode: resolvedMode,
    });
  }

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
      messages: [{ role: "user", content: userContent }],
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
