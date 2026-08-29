import { zodResponseFormat } from "openai/helpers/zod";
import type OpenAI from "openai";
import { ConversationContextSchema } from "./replySchema";
import { SUMMARIZE_SYSTEM_PROMPT, buildSummarizePrompt } from "./prompt";
import type { ConversationContextData } from "./types";

// 요약 전용 저비용 모델. 답변 생성 메인 호출과 별도로 짧고 값싸게 돈다.
const MODEL = "gpt-4o-mini";

/**
 * 매우 긴 대화의 "오래된" 부분만 별도로 요약해 핵심 맥락(ConversationContextData)을 추출한다.
 * 답변 생성용 메인 호출과는 별개의, 짧고 저렴한 AI 요청 1회다.
 * 실패하면 예외를 던진다 — 호출부에서 최근 대화만으로 계속 진행할 수 있도록 잡아서 처리한다.
 */
export async function summarizeOlderConversation(
  client: OpenAI,
  olderConversation: string,
): Promise<ConversationContextData> {
  const response = await client.chat.completions.parse(
    {
      model: MODEL,
      max_completion_tokens: 1024,
      response_format: zodResponseFormat(ConversationContextSchema, "conversation_context"),
      messages: [
        {
          role: "system",
          // 프롬프트는 요청마다 동일한 문자열로 유지해 OpenAI의 자동(암묵적) 캐싱 혜택을 받는다.
          // prompt_cache_breakpoint(명시적 캐시 경계)는 gpt-5.6 이상 전용 파라미터라
          // gpt-4o-mini에서는 요청이 400으로 거부되므로 쓰지 않는다.
          content: SUMMARIZE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: buildSummarizePrompt({ olderConversation }),
        },
      ],
    },
    // 답변 생성용 메인 호출과 별개로 도는 작은 요청이므로 짧게 잡는다. maxRetries는 일시적
    // 네트워크/5xx 오류에 대한 SDK 자체 재시도 횟수(최대 1회로 제한).
    { timeout: 20_000, maxRetries: 1 },
  );

  const parsed = response.choices[0]?.message.parsed;
  if (!parsed) {
    throw new Error("대화 맥락을 요약하지 못했습니다.");
  }
  return parsed;
}
