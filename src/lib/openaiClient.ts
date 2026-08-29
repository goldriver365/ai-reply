import OpenAI from "openai";

// 이 파일은 API 라우트(서버)에서만 import 해야 한다. 클라이언트 컴포넌트에서 가져오지 않는다.

// 서버에서만 생성되는 싱글턴 클라이언트. API 키는 여기서만 읽는다.
let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY 환경변수가 설정되지 않았습니다.");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}
