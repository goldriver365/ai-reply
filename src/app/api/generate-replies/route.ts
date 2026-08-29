import { NextResponse } from "next/server";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import Anthropic from "@anthropic-ai/sdk";
import { getAnthropicClient } from "@/lib/anthropicClient";
import {
  ConversationContextSchema,
  ReplyResponseSchema,
  UserStyleProfileSchema,
} from "@/lib/replySchema";
import {
  REPLY_SYSTEM_PROMPT,
  buildFileInstructionText,
  buildUserPrompt,
  type ConversationInput,
} from "@/lib/prompt";
import { REPLY_STYLES } from "@/lib/replyStyles";
import { DEFAULT_GOAL, DEFAULT_RELATIONSHIP, GOALS, RELATIONSHIPS } from "@/lib/relationshipGoal";
import { DEFAULT_SPEECH_LEVEL, SPEECH_LEVELS } from "@/lib/speechLevel";
import {
  getConversationLengthTier,
  splitRecentAndOlder,
} from "@/lib/conversationLength";
import { summarizeOlderConversation } from "@/lib/summarizeConversation";
import type {
  AIReplyResult,
  ConversationContextData,
  Goal,
  Relationship,
  ReplyStyle,
  SpeechLevel,
  UserStyleProfile,
} from "@/lib/types";

export const runtime = "nodejs";

// 매우 긴 입력에 대한 절대 안전장치(대략적인 토큰 상한 역할). 이보다 길면 뒤쪽(최근) 내용만 남긴다.
const MAX_CONVERSATION_LENGTH_ABSOLUTE = 60_000;
const MAX_NOTE_LENGTH = 500;

// 여러 장을 하나의 요청에 담되, 비용이 과도해지지 않도록 장수를 제한한다.
const MAX_IMAGES = 6;
// 클라이언트에서 리사이즈된 이미지라도 비정상적으로 큰 페이로드는 거부한다(base64 문자 수 기준, 대략 6MB 디코딩).
const MAX_IMAGE_BASE64_LENGTH = 8_000_000;

// 다시 추천 시 참고할 이전 답변 개수/길이 상한(비용 최소화 목적). 답변이 4개이므로 4개까지 담는다.
const MAX_PREVIOUS_REPLIES = 4;
const MAX_PREVIOUS_REPLY_LENGTH = 300;

const GENERIC_ERROR_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";
const LONG_CONVERSATION_NOTICE =
  "전체 대화 분석에 일부 제한이 있어 최근 대화를 중심으로 답변했습니다.";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number];

function isReplyStyle(value: unknown): value is ReplyStyle {
  return typeof value === "string" && (REPLY_STYLES as readonly string[]).includes(value);
}

function isRelationship(value: unknown): value is Relationship {
  return typeof value === "string" && (RELATIONSHIPS as readonly string[]).includes(value);
}

function isGoal(value: unknown): value is Goal {
  return typeof value === "string" && (GOALS as readonly string[]).includes(value);
}

function isSpeechLevel(value: unknown): value is SpeechLevel {
  return typeof value === "string" && (SPEECH_LEVELS as readonly string[]).includes(value);
}

function parsePreviousReplies(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const texts = value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .slice(0, MAX_PREVIOUS_REPLIES)
    .map((text) => text.trim().slice(0, MAX_PREVIOUS_REPLY_LENGTH));
  return texts.length > 0 ? texts : undefined;
}

// 클라이언트가 이전 응답에서 캐시해 되돌려준 대화 맥락. 모양이 정확히 맞을 때만 재사용하고,
// 그렇지 않으면 무시하고(undefined) 새로 요약한다 — 잘못된 값으로 답변 품질이 깨지지 않도록.
function parseConversationContext(value: unknown): ConversationContextData | undefined {
  const result = ConversationContextSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

// 클라이언트(localStorage)가 되돌려준 "내 말투"(STEP 10). 모양이 정확히 맞을 때만 신뢰하고,
// 그렇지 않으면 무시한다(undefined) — 잘못된 값으로 답변 품질이 깨지지 않도록.
function parseMyStyle(value: unknown): UserStyleProfile | undefined {
  const result = UserStyleProfileSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

function isAllowedImageType(value: unknown): value is AllowedImageType {
  return typeof value === "string" && (ALLOWED_IMAGE_TYPES as readonly string[]).includes(value);
}

interface ValidatedImage {
  mediaType: AllowedImageType;
  data: string;
}

type ParseImagesResult =
  | { ok: true; images: ValidatedImage[] }
  | { ok: false; reason: "empty" | "invalid" | "too_large" };

// 오류 원인을 구분해 사용자에게 정확한 안내를 줄 수 있게 한다(섹션 20: 잘못된 파일/파일 크기
// 초과를 구분해서 알려준다).
function parseImages(value: unknown): ParseImagesResult {
  if (!Array.isArray(value) || value.length === 0) return { ok: false, reason: "empty" };

  const result: ValidatedImage[] = [];
  for (const item of value.slice(0, MAX_IMAGES)) {
    if (typeof item !== "object" || item === null) return { ok: false, reason: "invalid" };
    const { mediaType, data } = item as { mediaType?: unknown; data?: unknown };
    if (!isAllowedImageType(mediaType)) return { ok: false, reason: "invalid" };
    if (typeof data !== "string" || data.length === 0) return { ok: false, reason: "invalid" };
    if (data.length > MAX_IMAGE_BASE64_LENGTH) return { ok: false, reason: "too_large" };
    result.push({ mediaType, data });
  }
  return { ok: true, images: result };
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const {
    conversation,
    style,
    inputMode,
    images,
    note,
    relationship,
    goal,
    speechLevel,
    previousReplies,
    conversationContext,
    myStyle,
  } = (body ?? {}) as {
    conversation?: unknown;
    style?: unknown;
    inputMode?: unknown;
    images?: unknown;
    note?: unknown;
    relationship?: unknown;
    goal?: unknown;
    speechLevel?: unknown;
    previousReplies?: unknown;
    conversationContext?: unknown;
    myStyle?: unknown;
  };

  const resolvedStyle: ReplyStyle = isReplyStyle(style) ? style : "자연스럽게";
  const resolvedRelationship: Relationship = isRelationship(relationship)
    ? relationship
    : DEFAULT_RELATIONSHIP;
  const resolvedGoal: Goal = isGoal(goal) ? goal : DEFAULT_GOAL;
  const resolvedSpeechLevel: SpeechLevel = isSpeechLevel(speechLevel)
    ? speechLevel
    : DEFAULT_SPEECH_LEVEL;
  const resolvedPreviousReplies = parsePreviousReplies(previousReplies);
  const isFileMode = inputMode === "file";

  // 확신도가 낮은 "내 말투"는 억지로 개인화하는 데 쓰지 않고 자연스러운 기본 말투로 진행한다.
  const parsedMyStyle = parseMyStyle(myStyle);
  const resolvedMyStyle: UserStyleProfile | undefined =
    parsedMyStyle && parsedMyStyle.confidence !== "low" ? parsedMyStyle : undefined;

  let userContent: Anthropic.MessageParam["content"];
  // 이번 요청에서 실제로 사용한(또는 새로 만든) 대화 맥락. 응답에 실어 보내면
  // 클라이언트가 "다시 추천" 등에서 재사용해 재요약 호출을 건너뛸 수 있다.
  let resultConversationContext: ConversationContextData | undefined;
  let notice: string | undefined;

  if (isFileMode) {
    const parsedImages = parseImages(images);
    if (!parsedImages.ok) {
      // 빈 입력(이미지 없음)은 API를 호출하지 않는다. 그 외에는 원인을 구분해 안내한다.
      const message =
        parsedImages.reason === "empty"
          ? "분석할 이미지가 없습니다."
          : parsedImages.reason === "too_large"
            ? "이미지 용량이 너무 큽니다. 더 작은 이미지로 다시 시도해주세요."
            : "지원하지 않는 이미지 형식입니다. JPG·PNG·WEBP 파일만 첨부해주세요.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const validatedImages = parsedImages.images;

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
        relationship: resolvedRelationship,
        goal: resolvedGoal,
        speechLevel: resolvedSpeechLevel,
        note: resolvedNote,
        previousReplies: resolvedPreviousReplies,
        myStyle: resolvedMyStyle,
      }),
    });
    userContent = content;
  } else {
    // 빈 대화는 API를 호출하지 않는다.
    if (typeof conversation !== "string" || conversation.trim().length === 0) {
      return NextResponse.json({ error: "대화 내용이 비어 있습니다." }, { status: 400 });
    }

    const resolvedMode: "paste" | "write" = inputMode === "write" ? "write" : "paste";
    const trimmed = conversation.trim();
    // 절대 안전장치: 그래도 지나치게 길면 앞부분(오래된 내용)을 버리고 뒤쪽(최근)을 남긴다.
    const cappedConversation =
      trimmed.length > MAX_CONVERSATION_LENGTH_ABSOLUTE
        ? trimmed.slice(-MAX_CONVERSATION_LENGTH_ABSOLUTE)
        : trimmed;

    if (getConversationLengthTier(cappedConversation) === "short") {
      // 짧은 대화: 기존 방식 그대로 전체를 한 번에 분석한다(추가 호출 없음).
      const conversationInput: ConversationInput = { kind: "full", conversation: cappedConversation };
      userContent = buildUserPrompt({
        conversationInput,
        style: resolvedStyle,
        inputMode: resolvedMode,
        relationship: resolvedRelationship,
        goal: resolvedGoal,
        speechLevel: resolvedSpeechLevel,
        previousReplies: resolvedPreviousReplies,
        myStyle: resolvedMyStyle,
      });
    } else {
      // 긴 대화: 최근 대화는 원문 그대로, 그 이전은 핵심 맥락으로 압축해서 사용한다.
      const { recent, older } = splitRecentAndOlder(cappedConversation);
      const incomingContext = parseConversationContext(conversationContext);

      let contextToUse = incomingContext;
      if (!contextToUse) {
        try {
          contextToUse = await summarizeOlderConversation(getAnthropicClient(), older);
        } catch (error) {
          console.error(
            "conversation summarize failed",
            error instanceof Error ? error.message : "unknown error",
          );
        }
      }

      let conversationInput: ConversationInput;
      if (contextToUse) {
        conversationInput = { kind: "recentWithContext", recentConversation: recent, context: contextToUse };
        resultConversationContext = contextToUse;
      } else {
        // 요약이 실패해도 앱이 멈추지 않도록 최근 대화만으로 계속 진행한다.
        conversationInput = { kind: "full", conversation: recent };
        notice = LONG_CONVERSATION_NOTICE;
      }

      userContent = buildUserPrompt({
        conversationInput,
        style: resolvedStyle,
        inputMode: resolvedMode,
        relationship: resolvedRelationship,
        goal: resolvedGoal,
        speechLevel: resolvedSpeechLevel,
        previousReplies: resolvedPreviousReplies,
        myStyle: resolvedMyStyle,
      });

      // 개발 중 확인용 디버그 정보. 대화 내용 자체는 절대 출력하지 않는다.
      if (process.env.NODE_ENV !== "production") {
        console.debug("generate-replies long conversation", {
          originalConversationLength: cappedConversation.length,
          recentLength: recent.length,
          olderLength: older.length,
          reusedCachedContext: Boolean(incomingContext),
        });
      }
    }
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
    return NextResponse.json({
      result,
      ...(resultConversationContext ? { conversationContext: resultConversationContext } : {}),
      ...(notice ? { notice } : {}),
    });
  } catch (error) {
    // 대화 원문은 절대 로그에 남기지 않는다. 오류 종류/상태 코드 등 메타데이터만 남긴다.
    if (error instanceof Anthropic.APIError) {
      console.error("generate-replies Anthropic API error", {
        status: error.status,
        name: error.name,
      });
    } else {
      console.error("generate-replies failed", {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : String(error),
      });
    }
    return NextResponse.json({ error: GENERIC_ERROR_MESSAGE }, { status: 502 });
  }
}
