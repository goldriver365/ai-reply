import { z } from "zod";

// AI 구조화 출력(output_config.format)에 사용하는 스키마.
// src/lib/types.ts 의 AIReplyResult / AIReplyItem 과 구조를 반드시 맞춘다.
// STEP 8: 답변 유형을 고정된 enum이 아니라 상황에 맞는 자유 라벨로 바꿨다(배열 순서 = 추천 우선순위).
export const REPLY_SITUATIONS = [
  "general",
  "schedule",
  "decline",
  "work",
  "conflict",
  "apology",
  "comfort",
  "casual",
] as const;

export const ReplyItemSchema = z.object({
  label: z
    .string()
    .min(1)
    .max(12)
    .describe(
      "이 답변의 역할을 짧게 설명하는 유형명(12자 이내). 고정된 목록이 아니라 상황에 맞게 정한다. " +
        "예: '추천', '시간 제안', '부드러운 거절', '짧게', '공감', '사과', '확인'.",
    ),
  text: z
    .string()
    .min(1)
    .describe(
      "실제로 그대로 보낼 수 있는 완성된 답변. 대화에서 감지한 언어와 동일한 언어로 작성한다.",
    ),
  translationKo: z
    .string()
    .nullable()
    .describe("text가 한국어가 아닌 문장일 때의 한국어 뜻. text가 한국어면 null."),
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
  situation: z
    .enum(REPLY_SITUATIONS)
    .describe(
      "판단한 대화 상황. general/schedule/decline/work/conflict/apology/comfort/casual 중 하나.",
    ),
  lastMessageFrom: z
    .enum(["other", "me", "unclear"])
    .describe(
      "답변을 만들기 전에 확인한, 마지막 관련 메시지를 누가 보냈는지. 상대방이면 other, " +
        "사용자 본인이면 me, 판단이 애매하면 unclear(단 화자 확신이 너무 낮아 아예 답변을 만들 " +
        "수 없는 정도면 status를 needsSpeakerCheck로 응답한다).",
    ),
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
    .length(4)
    .describe(
      "상황에 맞게 역할이 달라지는 답변 4개. 배열 순서가 곧 추천 우선순위이며 index 0이 가장 " +
        "추천하는 답변이다. 단어만 바꾼 사실상 같은 답변 4개는 금지한다.",
    ),
  quickReactions: z
    .array(z.string().min(1))
    .describe(
      "현재 대화 분위기에 어울리는 짧은 리액션 4~6개. 표준 유니코드 이모티콘(일반 스마트폰 " +
        "키보드로 입력 가능한 것만) 또는 'ㅋㅋ'/'ㅎㅎ'/'ㅇㅋ' 같은 한국어 채팅 표현. 이미지 " +
        "스티커나 특정 플랫폼 전용 이모티콘은 금지. 부적절한 상황이면 빈 배열로 둔다. 연애 " +
        "관계로 명확히 판단되지 않으면 ❤️/😘/🥰 같은 연애 뉘앙스가 강한 항목은 넣지 않는다.",
    ),
  showQuickReactions: z
    .boolean()
    .describe(
      "짧은 리액션만으로 답하는 것이 지금 상황에 적절하면 true. 사과·심한 갈등·업무 지시·중요한 " +
        "일정 확인·금전 문제처럼 부적절한 상황이면 false.",
    ),
  parsedConversationSummary: z
    .string()
    .describe(
      "입력이 스크린샷(이미지)일 때만: 나중에 '다시 추천'을 누르면 이미지를 다시 Vision으로 " +
        "분석하지 않고 이 텍스트만으로 답변을 다시 만들 수 있도록, 실제로 오간 대화를 " +
        "'상대방: .../나: ...' 형식으로 간결하게 재구성한 것(800자 이내, 대화에 없는 내용 추가 금지). " +
        "입력이 텍스트 대화였다면 빈 문자열로 둔다.",
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

// 화자(나/상대방) 확신도가 너무 낮을 때(주로 스크린샷) 억지로 추정하지 않고 아주 짧게
// 되묻는 전용 응답(STEP 11). lastMessagePreview는 사용자 자신의 대화 내용이므로 그대로
// 되돌려줘도 안전하며, 어떤 메시지를 두고 묻는 것인지 사용자가 알아볼 수 있게 한다.
const ReplyNeedsSpeakerCheckSchema = z.object({
  status: z.literal("needsSpeakerCheck"),
  lastMessagePreview: z
    .string()
    .min(1)
    .max(80)
    .describe("화자가 불확실한 마지막 메시지를 짧게 그대로 인용한 것(80자 이내)."),
});

export const ReplyResponseSchema = z.discriminatedUnion("status", [
  ReplyOkSchema,
  ReplyUnreadableSchema,
  ReplyNeedsSpeakerCheckSchema,
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

// 긴 대화의 "과거" 부분에서 핵심 맥락만 추출하는 요약 전용 스키마(STEP 5).
// src/lib/types.ts 의 ConversationContextData / StyleProfile 과 구조를 반드시 맞춘다.
// 장문 설명이 아닌 최소한의 정보만 담도록 각 필드를 짧게 요구한다.
export const StyleProfileSchema = z.object({
  speechLevel: z.string().min(1).describe("존댓말/반말 등 격식 수준을 짧게 (예: '반말', '존댓말')"),
  averageLength: z.string().min(1).describe("평소 메시지 길이 경향을 짧게 (예: '짧은 편', '보통')"),
  emojiUsage: z.string().min(1).describe("이모티콘/이모지 사용 정도를 짧게"),
  laughterStyle: z.string().min(1).describe("ㅋㅋ/ㅎㅎ 등 웃음 표현 사용 정도를 짧게"),
  directness: z.string().min(1).describe("직접적/간접적 표현 성향을 짧게"),
});

// 사용자가 opt-in으로 등록하는 "내 말투"(STEP 10)의 스키마. 대화 내용이 아니라 스타일 카테고리만
// 담으며, "내 말투 기억" 분석 응답의 형식이자, 클라이언트가 이후 요청에 되돌려주는 값의 검증 형식이다.
export const UserStyleProfileSchema = StyleProfileSchema.extend({
  confidence: z
    .enum(["low", "medium", "high"])
    .describe(
      "이 스타일 추정에 대한 확신도. 예시 문장이 충분하고 신호가 뚜렷하면 high, 예시가 1~2개뿐이거나 " +
        "너무 짧으면 low, 그 중간이면 medium.",
    ),
});

export const ConversationContextSchema = z.object({
  relationshipSummary: z
    .string()
    .min(1)
    .describe("두 사람의 관계를 한두 문장으로 짧게 요약. 대화에 실제로 나타난 근거만 사용한다."),
  userStyle: StyleProfileSchema.describe("사용자('나')의 평소 말투"),
  otherPersonStyle: StyleProfileSchema.describe("상대방의 평소 말투"),
  importantHistory: z
    .array(z.string().min(1))
    .describe(
      "현재 대화 이해에 직접 영향을 줄 가능성이 높은 과거 사건만 최대 6개. 대화에 실제로 없는 " +
        "내용을 만들어내지 않는다. 확실하지 않은 정보(예: '아마 다음 주였던 것 같다')는 확정된 " +
        "사실처럼 적지 않는다.",
    ),
  openLoops: z
    .array(z.string().min(1))
    .describe("아직 해결되지 않은 질문·약속·갈등·요청을 최대 5개."),
  emotionalTrend: z
    .string()
    .min(1)
    .describe(
      "대화 흐름에서 관찰되는 감정 분위기의 변화를 한 문장으로. 확정적인 심리 진단 표현은 쓰지 않는다.",
    ),
  recentContext: z.string().min(1).describe("가장 최근 상황을 한두 문장으로."),
});
