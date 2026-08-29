import type { Goal, Relationship } from "./types";

export const RELATIONSHIPS: Relationship[] = [
  "자동 판단",
  "처음 대화하는 사람",
  "지인",
  "친구",
  "가까운 친구",
  "직장 동료",
  "상사",
  "고객",
  "가족",
  "연인",
  "호감 있는 사람",
  "썸 관계",
  "헤어진 연인",
  "관계가 어색해진 사람",
  "갈등 중인 사람",
  "기타",
];

export const GOALS: Goal[] = [
  "자동 추천",
  "자연스럽게 대화하기",
  "대화를 계속 이어가기",
  "친해지고 싶음",
  "관계를 좋게 만들기",
  "호감을 자연스럽게 표현",
  "상대방의 관심 확인",
  "약속 잡기",
  "사과하기",
  "오해 풀기",
  "상대방을 위로하기",
  "내 입장을 설명하기",
  "부드럽게 거절하기",
  "거리 두기",
  "대화 마무리하기",
  "업무적으로 답하기",
];

export const DEFAULT_RELATIONSHIP: Relationship = RELATIONSHIPS[0];
export const DEFAULT_GOAL: Goal = GOALS[0];
