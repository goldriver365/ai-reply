import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { ConversationContextSchema } from "./replySchema";
import { SUMMARIZE_SYSTEM_PROMPT, buildSummarizePrompt } from "./prompt";
import type { ConversationContextData } from "./types";

/**
 * 매우 긴 대화의 "오래된" 부분만 별도로 요약해 핵심 맥락(ConversationContextData)을 추출한다.
 * 답변 생성용 메인 호출과는 별개의, 짧고 저렴한 AI 요청 1회다.
 * 실패하면 예외를 던진다 — 호출부에서 최근 대화만으로 계속 진행할 수 있도록 잡아서 처리한다.
 */
export async function summarizeOlderConversation(
  client: Anthropic,
  olderConversation: string,
): Promise<ConversationContextData> {
  const response = await client.messages.parse({
    model: "claude-sonnet-5",
    max_tokens: 1024,
    output_config: {
      effort: "low",
      format: zodOutputFormat(ConversationContextSchema),
    },
    system: [
      {
        type: "text",
        text: SUMMARIZE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: buildSummarizePrompt({ olderConversation }),
      },
    ],
  });

  const parsed = response.parsed_output;
  if (!parsed) {
    throw new Error("대화 맥락을 요약하지 못했습니다.");
  }
  return parsed;
}
