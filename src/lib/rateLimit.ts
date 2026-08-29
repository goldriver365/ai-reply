// 아주 가벼운 메모리 기반 요청 제한(STEP 13). 회원가입/로그인 없이 배포하는 MVP 단계에서
// AI endpoint가 무제한으로 남용되는 것을 막기 위한 최소한의 장치다.
// Redis 같은 별도 인프라 없이 서버리스 인스턴스 하나의 메모리 안에서만 동작하므로 완벽한
// 분산 rate limit은 아니지만, 새 인프라를 추가하지 않으면서 비용 없이 명백한 남용(같은 IP의
// 짧은 시간 대량 연속 호출)은 줄여준다.

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

// 버킷이 메모리에 무한히 쌓이지 않도록 가끔 만료된 항목을 정리한다.
let lastCleanupAt = 0;
function cleanupExpired(now: number) {
  if (now - lastCleanupAt < 60_000) return;
  lastCleanupAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * key(보통 IP+라우트 이름)가 windowMs 시간 동안 limit번을 초과해 호출했으면 false를 반환한다.
 * 대화 내용이나 사용자 식별 정보는 담지 않는다 — 오직 카운트와 만료 시각만 메모리에 둔다.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  cleanupExpired(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}

// 요청자를 구분하기 위한 최소한의 키. 리버스 프록시가 붙이는 표준 헤더만 사용하고,
// 그 외 어떤 개인정보도 포함하지 않는다.
export function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export const RATE_LIMIT_MESSAGE = "요청이 너무 빠릅니다. 잠시 후 다시 시도해 주세요.";
