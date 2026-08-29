import { z } from "zod";

// AI 구조화 출력(output_config.format)에 사용하는 스키마.
// src/lib/types.ts 의 AIReplyResult / AIReplyItem 과 구조를 반드시 맞춘다.
export const REPLY_TYPES = ["best", "active", "gentle"] as const;

export const ReplyItemSchema = z.object({
  type: z
    .enum(REPLY_TYPES)
    .describe(
      "답변 전략 구분. best: 현재 상황에서 가장 자연스럽고 안전한 기본 답변, " +
        "active: 관계와 사용자 목적을 조금 더 적극적으로 반영해 관계를 발전시키는 답변, " +
        "gentle: 상대방에게 부담을 최소화하면서 목적을 달성하려는 답변.",
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
  reason: z
    .string()
    .min(1)
    .describe(
      "이 답변의 전략을 설명하는 한 줄 문구(한 문장 이내). 예: '가장 자연스러운 답변', " +
        "'조금 더 적극적인 답변', '부담을 줄인 답변'. 상대방의 심리를 진단하거나 단정하는 " +
        "표현(예: '상대방은 화가 났습니다')은 절대 쓰지 않는다.",
    ),
});

const ReplyContextSchema = z.object({
  relationship: z
    .string()
    .min(1)
    .describe("실제로 답변에 반영한 관계. 사용자가 지정했으면 그 값, 아니면 대화에서 추정한 관계."),
  goal: z
    .string()
    .min(1)
    .describe("실제로 답변에 반영한 목적. 사용자가 지정했으면 그 값, 아니면 상황에 맞게 판단한 목적."),
  tone: z
    .string()
    .min(1)
    .describe("현재 대화의 분위기/온도를 간단히 요약한 문구 (예: '훈훈함', '약간 서먹함', '갈등 상황')."),
});

const ReplyOkSchema = z.object({
  status: z.literal("ok"),
  language: z
    .string()
    .min(1)
    .describe(
      "입력 대화에서 감지된 주 언어를 한국어 명칭으로 표기 (예: 한국어, 영어, 일본어, 중국어, 베트남어 등)",
    ),
  confidence: z
    .enum(["low", "medium", "high"])
    .describe("대화 흐름, 상대방의 감정과 의도 파악에 대한 확신도"),
  context: ReplyContextSchema,
  replies: z
    .array(ReplyItemSchema)
    .length(3)
    .describe(
      "서로 전략이 뚜렷하게 다른 답변 3개. best, active, gentle 타입을 각각 정확히 하나씩 포함한다.",
    ),
});

// 스크린샷 글자를 알아보기 어렵거나 마지막 메시지를 확인할 수 없는 등,
// 신뢰할 수 있는 답변을 만들 수 없을 때 억지로 답변을 만들지 않고 이 형태로 응답한다.
const ReplyUnreadableSchema = z.object({
  status: z.literal("unreadable"),
  message: z
    .string()
    .min(1)
    .describe(
      "사용자에게 그대로 보여줄 짧고 정중한 안내 문구. 예: '대화 내용을 정확히 읽기 어렵습니다. 더 선명한 스크린샷을 올려주세요.'",
    ),
});

export const ReplyResponseSchema = z.discriminatedUnion("status", [
  ReplyOkSchema,
  ReplyUnreadableSchema,
]);

export type ReplyResponse = z.infer<typeof ReplyResponseSchema>;

// 답변 하나를 다듬는 전용 응답 스키마(STEP 4의 "더 짧게/더 친근하게/더 정중하게").
// src/lib/types.ts 의 RefineResponse 와 구조를 반드시 맞춘다.
export const RefineResponseSchema = z.object({
  text: z
    .string()
    .min(1)
    .describe("조정 요청을 반영해 다시 작성한 답변 문장. 원래 답변과 같은 언어로 작성한다."),
  translationKo: z
    .string()
    .nullable()
    .describe("text가 한국어가 아닐 때의 한국어 뜻. text가 한국어면 null."),
});
