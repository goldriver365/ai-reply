import { ReplyResponseSchema, RefineResponseSchema, UserStyleProfileSchema } from "./replySchema";
import type {
  AIReplyResult,
  ConversationContextData,
  Goal,
  RefineAdjustment,
  RefineResponse,
  Relationship,
  ReplyStyle,
  ResizedImagePayload,
  SpeechLevel,
  UserStyleProfile,
} from "./types";

export type GenerateRepliesInput = {
  style: ReplyStyle;
  relationship: Relationship;
  goal: Goal;
  speechLevel: SpeechLevel;
  /** 다시 추천 시, 같은 문장이 반복되지 않도록 참고용으로 전달하는 직전 답변들 */
  previousReplies?: string[];
  /**
   * 이전 응답에서 받아 캐시해둔 대화 맥락 요약. 지금 보내는 대화와 같은 대화일 때만 전달하면
   * 서버가 과거 부분을 다시 요약하지 않고 재사용해 AI 호출을 줄인다(긴 대화 "다시 추천" 등).
   */
  conversationContext?: ConversationContextData;
  /** 사용자가 opt-in으로 등록해 이 기기에 저장해둔 "내 말투"(STEP 10). 없으면 전달하지 않는다. */
  myStyle?: UserStyleProfile;
  /** "needsSpeakerCheck" 응답 후 사용자가 [상대방]/[나] 중 직접 선택한 답(STEP 11) */
  speakerHint?: "other" | "me";
} & (
  | { inputMode: "paste" | "write"; conversation: string }
  | { inputMode: "file"; images: ResizedImagePayload[]; note?: string }
);

export type GenerateRepliesResult =
  | {
      ok: true;
      result: AIReplyResult;
      /** 서버가 이번 요청에서 사용/생성한 대화 맥락. 다음 요청에 그대로 되돌려주면 재사용된다. */
      conversationContext?: ConversationContextData;
      /** 정상 처리되었지만 참고할 안내가 있을 때만(예: 매우 긴 대화 처리 제한). */
      notice?: string;
    }
  | { ok: false; message: string };

const FAILURE_MESSAGE = "답변을 만들지 못했습니다. 다시 시도해주세요.";
const REFINE_FAILURE_MESSAGE = "답변을 조정하지 못했습니다. 다시 시도해주세요.";

export async function generateReplies(
  input: GenerateRepliesInput,
): Promise<GenerateRepliesResult> {
  try {
    const res = await fetch("/api/generate-replies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => null)) as
      | { result: unknown; conversationContext?: ConversationContextData; notice?: string }
      | { error: string }
      | null;

    if (!res.ok || !data || !("result" in data)) {
      return { ok: false, message: FAILURE_MESSAGE };
    }

    // 서버가 이미 구조화 출력으로 형식을 보장하지만, 잘못된 값을 그대로 화면에 렌더링하지
    // 않도록 클라이언트에서도 한 번 더 검증한다(STEP 11 섹션 22: replies 길이, 필수 필드 등).
    const validated = ReplyResponseSchema.safeParse(data.result);
    if (!validated.success) {
      return { ok: false, message: FAILURE_MESSAGE };
    }

    return {
      ok: true,
      result: validated.data as AIReplyResult,
      conversationContext: data.conversationContext,
      notice: data.notice,
    };
  } catch {
    return { ok: false, message: FAILURE_MESSAGE };
  }
}

export interface RefineReplyInput {
  text: string;
  adjustment: RefineAdjustment;
  /** adjustment가 "custom"일 때만 사용하는 짧은 직접 지시문 */
  customInstruction?: string;
  language: string;
  relationship: string;
  goal: string;
  tone: string;
  speechLevel: SpeechLevel;
  /** adjustment가 "myStyle"일 때만 사용하는, 이 기기에 저장된 "내 말투" */
  myStyle?: UserStyleProfile;
}

export type RefineReplyResult =
  | { ok: true; result: RefineResponse }
  | { ok: false; message: string };

// 답변 하나만 다듬는 요청. 전체 대화를 다시 보내지 않고 원래 답변과 짧은 맥락만 전송한다.
export async function refineReply(input: RefineReplyInput): Promise<RefineReplyResult> {
  try {
    const res = await fetch("/api/refine-reply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const data = (await res.json().catch(() => null)) as
      | { result: unknown }
      | { error: string }
      | null;

    if (!res.ok || !data || !("result" in data)) {
      return { ok: false, message: REFINE_FAILURE_MESSAGE };
    }

    const validated = RefineResponseSchema.safeParse(data.result);
    if (!validated.success) {
      return { ok: false, message: REFINE_FAILURE_MESSAGE };
    }

    return { ok: true, result: validated.data as RefineResponse };
  } catch {
    return { ok: false, message: REFINE_FAILURE_MESSAGE };
  }
}

export type AnalyzeMyStyleResult =
  | { ok: true; profile: UserStyleProfile }
  | { ok: false; message: string };

const MY_STYLE_FAILURE_MESSAGE = "말투를 기억하지 못했습니다. 다시 시도해주세요.";

// "내 말투 기억"(STEP 10). 사용자가 opt-in으로 붙여넣은 예시 메시지 2~5개를 서버로 한 번만 보내
// 스타일만 추출한다. 결과를 이 기기에 저장하는 것은 호출한 쪽(page.tsx)의 책임이다.
export async function analyzeMyStyle(samples: string[]): Promise<AnalyzeMyStyleResult> {
  try {
    const res = await fetch("/api/analyze-my-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ samples }),
    });

    const data = (await res.json().catch(() => null)) as
      | { result: unknown }
      | { error: string }
      | null;

    if (!res.ok || !data || !("result" in data)) {
      return { ok: false, message: MY_STYLE_FAILURE_MESSAGE };
    }

    const validated = UserStyleProfileSchema.safeParse(data.result);
    if (!validated.success) {
      return { ok: false, message: MY_STYLE_FAILURE_MESSAGE };
    }

    return { ok: true, profile: validated.data as UserStyleProfile };
  } catch {
    return { ok: false, message: MY_STYLE_FAILURE_MESSAGE };
  }
}
