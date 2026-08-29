import { z } from "zod";

// AI 구조화 출력(output_config.format)에 사용하는 스키마.
// src/lib/types.ts 의 AIReplyResult / AIReplyItem 과 구조를 반드시 맞춘다.
export const REPLY_TYPES = ["best", "active", "gentle"] as const;

export const ReplyItemSchema = z.object({
  type: z
    .enum(REPLY_TYPES)
    .describe(
      "답변 전략 구분. best: 현재 상황에서 가장 자연스럽고 안전한 기본 답변, " +
        "active: 관계와 대화 흐름이 허용하는 범위에서 조금 더 적극적으로 이어가는 답변, " +
        "gentle: 상대방에게 부담을 최소화하며 부드럽게 대응하는 답변.",
    ),
  text: z
    .string()
    .min(1)
    .describe(
      "실제로 그대로 보낼 수 있는 완성된 답변 문장. 대화에서 감지한 언어와 동일한 언어로 작성한다.",
    ),
  translationKo: z
    .string()
    .nullable()
    .describe("text가 한국어가 아닐 때의 한국어 뜻. text가 한국어면 null."),
});

export const ReplyResponseSchema = z.object({
  language: z
    .string()
    .min(1)
    .describe(
      "입력 대화에서 감지된 주 언어를 한국어 명칭으로 표기 (예: 한국어, 영어, 일본어, 중국어, 베트남어 등)",
    ),
  analysisConfidence: z
    .enum(["low", "medium", "high"])
    .describe("대화 흐름, 상대방의 감정과 의도 파악에 대한 확신도"),
  replies: z
    .array(ReplyItemSchema)
    .length(3)
    .describe(
      "서로 전략이 뚜렷하게 다른 답변 3개. best, active, gentle 타입을 각각 정확히 하나씩 포함한다.",
    ),
});

export type ReplyResponse = z.infer<typeof ReplyResponseSchema>;
