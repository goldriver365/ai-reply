"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ChipSelect from "@/components/ChipSelect";
import ImageUploader, { MAX_IMAGES, type ImageUploaderHandle } from "@/components/ImageUploader";
import LabeledSelect from "@/components/LabeledSelect";
import QuickEmojis from "@/components/QuickEmojis";
import ReplyResultCard from "@/components/ReplyResultCard";
import StyleSelector from "@/components/StyleSelector";
import { analyzeMyStyle, generateReplies, refineReply } from "@/lib/api";
import { resizeImageFile } from "@/lib/imageResize";
import {
  DEFAULT_GOAL,
  DEFAULT_RELATIONSHIP,
  GOALS,
  PRIMARY_RELATIONSHIPS,
  RELATIONSHIPS,
} from "@/lib/relationshipGoal";
import { REPLY_STYLES } from "@/lib/replyStyles";
import { DEFAULT_SPEECH_LEVEL, SPEECH_LEVELS } from "@/lib/speechLevel";
import { clearUserStyleProfile, loadUserStyleProfile, saveUserStyleProfile } from "@/lib/userStyle";
import type {
  AIReplyResult,
  ConversationContextData,
  Goal,
  RefineAdjustment,
  Relationship,
  ReplyStyle,
  SpeechLevel,
  UploadedImage,
  UserStyleProfile,
} from "@/lib/types";

// "내 말투 기억"에는 최소 2개, 최대 5개의 예시 메시지를 받는다(STEP 10).
const MIN_MY_STYLE_SAMPLES = 2;
const MAX_MY_STYLE_SAMPLES = 5;

let imageIdCounter = 0;

interface DisplayReply {
  label: string;
  text: string;
  translation?: string | null;
  emojiOnly: boolean;
}

// 문자/숫자가 전혀 없으면(이모티콘·기호만) 이모티콘 전용 답변으로 간주해 크게 표시하고
// "더 짧게/더 정중하게" 같은 조정 버튼을 숨긴다. 답변 유형이 더 이상 고정되어 있지 않으므로
// 내용을 보고 판단한다.
function looksEmojiOnly(text: string): boolean {
  return !/[\p{L}\p{N}]/u.test(text);
}

// 붙여넣기와 직접 입력을 하나의 입력창으로 합친 대신, 내용 형태로 서버 힌트를 자동 판단한다.
// "상대방:"/"나:" 형식이면 직접 입력에 가깝게, 그 외에는 그대로 붙여넣은 대화로 간주한다.
function detectInputMode(text: string): "paste" | "write" {
  return /(^|\n)\s*(상대방|나)\s*[:：]/.test(text) ? "write" : "paste";
}

// 파일명+크기+lastModified로 만드는 간단한 지문(STEP 12). 같은 사진의 실수 중복 업로드를
// 막는 용도와, "다시 추천" 시 스크린샷이 그대로인지 확인하는 용도(둘 다) 로 쓴다.
function fileFingerprint(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

// 현재 이미지 세트 + 추가 설명(note)이 이전 Vision 분석과 같은지 확인하기 위한 지문.
// 하나라도 바뀌면 값이 달라져 캐시가 자동으로 무효화된다(STEP 12 섹션 11).
function computeImagesFingerprint(images: UploadedImage[], note: string): string {
  return images.map((image) => fileFingerprint(image.file)).join("|") + "::" + note.trim();
}

function AttachIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.2" />
    </svg>
  );
}

export default function Home() {
  const [conversationText, setConversationText] = useState("");
  const [images, setImages] = useState<UploadedImage[]>([]);
  const imageUploaderRef = useRef<ImageUploaderHandle>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [style, setStyle] = useState<ReplyStyle>(REPLY_STYLES[0]);
  const [relationship, setRelationship] = useState<Relationship>(DEFAULT_RELATIONSHIP);
  const [goal, setGoal] = useState<Goal>(DEFAULT_GOAL);
  const [speechLevel, setSpeechLevel] = useState<SpeechLevel>(DEFAULT_SPEECH_LEVEL);

  const [aiResult, setAiResult] = useState<AIReplyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refiningIndex, setRefiningIndex] = useState<number | null>(null);
  // 다듬기 직후 "수정됨" 표시(잠깐)와 "되돌리기"(한 단계) 기능을 위한 상태.
  // 복잡한 버전 히스토리는 만들지 않고, 가장 최근 다듬기 1건만 기억한다.
  const [justRefinedIndex, setJustRefinedIndex] = useState<number | null>(null);
  const [lastRefine, setLastRefine] = useState<{
    index: number;
    previousText: string;
    previousTranslationKo: string | null;
  } | null>(null);
  const justRefinedTimeoutRef = useRef<number | null>(null);
  const isRequestInFlight = useRef(false);
  // 오래된 요청의 결과가 그 사이 시작된 새 요청의 결과를 덮어쓰지 않도록 하는 방어적 가드
  // (STEP 11 섹션 25). 버튼 비활성화로 이미 동시 요청 자체를 막고 있지만, 한 번 더 확인한다.
  const generateRequestIdRef = useRef(0);
  const refineRequestIdRef = useRef(0);
  const myStyleRequestIdRef = useRef(0);
  // 요청이 오래 걸릴 때만 버튼 문구를 바꿔 안내한다(STEP 12). 애니메이션은 추가하지 않는다.
  const [isSlowRequest, setIsSlowRequest] = useState(false);
  const slowRequestTimeoutRef = useRef<number | null>(null);
  // 같은 스크린샷 세트로 "다시 추천"할 때 Vision을 다시 호출하지 않도록, 직전 분석에서 AI가
  // 돌려준 텍스트 요약(parsedConversationSummary)을 지문과 함께 세션 동안만 기억한다(STEP 12).
  // 이미지나 추가 설명이 바뀌면 지문이 달라져 자동으로 무효화된다.
  const imagesAnalysisCacheRef = useRef<{ fingerprint: string; summary: string } | null>(null);
  // 같은 사진이 실수로 여러 번 선택됐을 때 잠깐 보여주는 안내(STEP 12).
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const imageNoticeTimeoutRef = useRef<number | null>(null);

  // "내 말투"(STEP 10): 사용자가 opt-in으로 등록한 경우에만 존재하며, 이 기기(localStorage)에만
  // 저장된다. SSR 중에는 localStorage가 없으므로 마운트 후 useEffect에서 불러온다.
  const [myStyleProfile, setMyStyleProfile] = useState<UserStyleProfile | null>(null);
  const [showMyStylePanel, setShowMyStylePanel] = useState(false);
  const [myStyleSamples, setMyStyleSamples] = useState("");
  const [myStyleBusy, setMyStyleBusy] = useState(false);
  const [myStyleError, setMyStyleError] = useState<string | null>(null);
  const [myStyleNotice, setMyStyleNotice] = useState<string | null>(null);
  const myStyleNoticeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // localStorage는 브라우저에만 있어 서버 렌더링 시점에는 읽을 수 없다. 마운트 후 한 번만
    // 이 외부 저장소와 동기화한다(하이드레이션 불일치를 피하기 위한 의도적인 지연 로드).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMyStyleProfile(loadUserStyleProfile());
  }, []);
  // 긴 대화에서 서버가 만든 핵심 맥락을 브라우저 세션 동안만 재사용한다(서버 저장 없음).
  // 같은 대화 텍스트일 때만 재사용하고, 대화가 바뀌면 자동으로 무시된다.
  const conversationContextCacheRef = useRef<{
    conversation: string;
    context: ConversationContextData;
  } | null>(null);

  const hasImages = images.length > 0;
  const hasInput = useMemo(
    () => conversationText.trim().length > 0 || hasImages,
    [conversationText, hasImages],
  );

  const handleAddImages = (files: FileList | File[]) => {
    // files는 input의 실시간 FileList라서, 호출자가 뒤이어 input.value를 초기화하면
    // 비워질 수 있다. setImages 콜백 밖에서 즉시 배열로 변환해 값을 고정한다.
    const selectedFiles = Array.from(files);

    // 같은 사진이 실수로 여러 번 선택된 경우, AI에 중복으로 보내지 않도록 미리 걸러낸다
    // (STEP 12 섹션 6). 파일명+크기+lastModified로 만든 간단한 지문으로 비교한다.
    const existingFingerprints = new Set(images.map((image) => fileFingerprint(image.file)));
    const deduped: File[] = [];
    let duplicateCount = 0;
    for (const file of selectedFiles) {
      const fp = fileFingerprint(file);
      if (existingFingerprints.has(fp)) {
        duplicateCount++;
        continue;
      }
      existingFingerprints.add(fp);
      deduped.push(file);
    }

    if (duplicateCount > 0) {
      if (imageNoticeTimeoutRef.current !== null) window.clearTimeout(imageNoticeTimeoutRef.current);
      setImageNotice(`중복된 사진 ${duplicateCount}장은 제외했어요.`);
      imageNoticeTimeoutRef.current = window.setTimeout(() => {
        setImageNotice(null);
        imageNoticeTimeoutRef.current = null;
      }, 2500);
    }

    setImages((prev) => {
      const remaining = MAX_IMAGES - prev.length;
      if (remaining <= 0) return prev;
      const added: UploadedImage[] = deduped.slice(0, remaining).map((file) => ({
        id: `img-${Date.now()}-${imageIdCounter++}`,
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return [...prev, ...added];
    });
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => {
      const target = prev.find((image) => image.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((image) => image.id !== id);
    });
  };

  const handleMoveImage = (id: string, direction: "left" | "right") => {
    setImages((prev) => {
      const index = prev.findIndex((image) => image.id === id);
      const targetIndex = direction === "left" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  };

  // 스크린샷을 파일로 저장했다가 다시 선택하지 않아도, 캡처한 화면을 클립보드에서
  // Ctrl+V(또는 우클릭 붙여넣기)로 바로 넣을 수 있게 한다. 클립보드에 이미지가 없으면
  // (평소처럼 대화 텍스트를 붙여넣는 경우) 아무 것도 하지 않고 기본 붙여넣기 동작을 그대로 둔다.
  const handlePasteConversation = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (const item of items) {
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length === 0) return;

    // 이미지 데이터가 텍스트로 붙여넣어지지 않도록 막고, 대신 스크린샷 첨부로 추가한다.
    // 썸네일은 상대방 대화 입력창 안에 바로 나타난다(별도 업로드 창이 없다).
    event.preventDefault();
    handleAddImages(imageFiles);
  };

  // 어떤 AI 요청이든 하나만 동시에 진행되도록 막는다(답변 추천/다시 추천/답변 조정이 서로 겹쳐
  // 결과가 뒤섞이지 않도록).
  const isBusy = isLoading || refiningIndex !== null;

  // "수정됨" 표시 타이머와 "되돌리기" 대상을 함께 초기화한다.
  const clearRefineIndicators = () => {
    if (justRefinedTimeoutRef.current !== null) {
      window.clearTimeout(justRefinedTimeoutRef.current);
      justRefinedTimeoutRef.current = null;
    }
    setJustRefinedIndex(null);
    setLastRefine(null);
  };

  // 실제 AI 호출. 중복 클릭으로 여러 번 호출되지 않도록 막는다.
  // speakerHint는 "needsSpeakerCheck" 응답 후 사용자가 [상대방]/[나]를 직접 골랐을 때만 전달된다.
  const runAiGenerate = async (speakerHint?: "other" | "me") => {
    if (isRequestInFlight.current || refiningIndex !== null) return;

    // 새로 답변 4개를 통째로 만드므로, 이전 다듬기의 "되돌리기"/"수정됨" 표시는 더 이상 의미가 없다.
    clearRefineIndicators();

    const requestId = ++generateRequestIdRef.current;
    const isStale = () => requestId !== generateRequestIdRef.current;

    // 다시 추천 시 같은 문장이 반복되지 않도록 직전 답변을 함께 전달한다(대화 재분석은 하지 않음).
    // 단, 화자 확인 질문에 답하는 요청이라면 직전 결과는 질문 자체였으므로 참고하지 않는다.
    const previousReplies =
      !speakerHint && aiResult && aiResult.status === "ok"
        ? aiResult.replies.map((r) => r.text)
        : undefined;

    // 이미지·추가 설명이 직전 Vision 분석과 같다면(지문 일치) 캐시된 요약을 재사용해
    // 스크린샷을 다시 분석하지 않는다(STEP 12 섹션 10~11). 하나라도 바뀌면 지문이 달라져
    // 자동으로 무효화되고 새로 분석한다.
    const imagesFingerprint = hasImages ? computeImagesFingerprint(images, conversationText) : null;
    const cachedSummary =
      imagesFingerprint && imagesAnalysisCacheRef.current?.fingerprint === imagesFingerprint
        ? imagesAnalysisCacheRef.current.summary
        : null;

    const startLoading = () => {
      isRequestInFlight.current = true;
      setIsLoading(true);
      setErrorMessage(null);
      setNotice(null);
      // 요청이 오래 걸리는 경우에만 안내 문구를 바꾼다(짧게 끝나면 아무것도 보이지 않는다).
      slowRequestTimeoutRef.current = window.setTimeout(() => setIsSlowRequest(true), 8000);
    };
    const endLoading = () => {
      isRequestInFlight.current = false;
      setIsLoading(false);
      if (slowRequestTimeoutRef.current !== null) {
        window.clearTimeout(slowRequestTimeoutRef.current);
        slowRequestTimeoutRef.current = null;
      }
      setIsSlowRequest(false);
    };

    if (hasImages && !cachedSummary) {
      // 처음 분석하거나, 사진/설명이 바뀌어 이전 분석을 재사용할 수 없는 경우: Vision 분석 1회.
      startLoading();

      let resizedImages;
      try {
        resizedImages = await Promise.all(images.map((image) => resizeImageFile(image.file)));
      } catch {
        endLoading();
        if (isStale()) return;
        setAiResult(null);
        setErrorMessage("이미지를 처리하지 못했습니다. 다시 시도해주세요.");
        return;
      }

      const response = await generateReplies({
        inputMode: "file",
        style,
        relationship,
        goal,
        speechLevel,
        previousReplies,
        images: resizedImages,
        note: conversationText.trim().length > 0 ? conversationText.trim() : undefined,
        myStyle: myStyleProfile ?? undefined,
        speakerHint,
      });

      endLoading();
      if (isStale()) return; // 그 사이 새 요청이 시작됐다면 이 결과는 버린다.

      if (response.ok) {
        setAiResult(response.result);
        // 다음 "다시 추천"에서 같은 사진이면 Vision을 다시 호출하지 않도록 요약을 기억해둔다.
        if (
          response.result.status === "ok" &&
          response.result.parsedConversationSummary &&
          imagesFingerprint
        ) {
          imagesAnalysisCacheRef.current = {
            fingerprint: imagesFingerprint,
            summary: response.result.parsedConversationSummary,
          };
        }
      } else {
        setAiResult(null);
        setErrorMessage(response.message);
      }
      return;
    }

    // 텍스트 경로: 직접 입력/붙여넣은 대화, 또는 변경되지 않은 스크린샷의 캐시된 요약("다시 추천").
    const conversation = cachedSummary ?? conversationText;
    if (conversation.trim().length === 0) return;

    // 같은 대화라면 이전에 캐시해둔 핵심 맥락을 재사용해 긴 대화를 다시 요약하지 않는다.
    // (캐시된 스크린샷 요약을 쓰는 경우는 별개의 캐시이므로 여기서는 재사용하지 않는다.)
    const cachedContext =
      !cachedSummary && conversationContextCacheRef.current?.conversation === conversation
        ? conversationContextCacheRef.current.context
        : undefined;

    startLoading();

    const response = await generateReplies({
      inputMode: cachedSummary ? "paste" : detectInputMode(conversation),
      style,
      relationship,
      goal,
      speechLevel,
      previousReplies,
      conversation,
      conversationContext: cachedContext,
      myStyle: myStyleProfile ?? undefined,
      speakerHint,
    });

    endLoading();
    if (isStale()) return; // 그 사이 새 요청이 시작됐다면 이 결과는 버린다.

    if (response.ok) {
      setAiResult(response.result);
      setNotice(response.notice ?? null);
      if (!cachedSummary) {
        conversationContextCacheRef.current = response.conversationContext
          ? { conversation, context: response.conversationContext }
          : null;
      }
    } else {
      setAiResult(null);
      setErrorMessage(response.message);
    }
  };

  const handleRecommend = () => void runAiGenerate();
  const handleRetry = () => void runAiGenerate();
  // "마지막 메시지는 누구의 말인가요?" 질문에 사용자가 직접 답한다(STEP 11).
  const handleSpeakerAnswer = (answer: "other" | "me") => void runAiGenerate(answer);

  // 답변 카드 하나만 다듬는다. 전체 대화를 다시 분석하지 않고, 선택된 답변 + 관계/말투/목적/분위기
  // 같은 최소한의 맥락만으로 작은 AI 호출 1회를 보낸다. 다른 답변 3개는 건드리지 않는다.
  const handleRefine = async (
    index: number,
    adjustment: RefineAdjustment,
    customInstruction?: string,
  ) => {
    if (!aiResult || aiResult.status !== "ok") return;
    if (isRequestInFlight.current || refiningIndex !== null) return;
    const target = aiResult.replies[index];
    if (!target) return;

    const requestId = ++refineRequestIdRef.current;

    setRefiningIndex(index);
    setErrorMessage(null);
    // 새로 다듬기를 시작하면 이전 되돌리기 기록은 의미가 없어진다(한 단계 되돌리기만 지원).
    clearRefineIndicators();

    const previousText = target.text;
    const previousTranslationKo = target.translationKo;

    const response = await refineReply({
      text: target.text,
      adjustment,
      customInstruction,
      language: aiResult.language,
      relationship: aiResult.context.relationship,
      goal: aiResult.context.goal,
      tone: aiResult.context.tone,
      speechLevel,
      myStyle: adjustment === "myStyle" ? (myStyleProfile ?? undefined) : undefined,
    });

    setRefiningIndex(null);
    if (requestId !== refineRequestIdRef.current) return; // 그 사이 새 요청이 시작됐다면 버린다.

    if (response.ok) {
      setAiResult((prev) => {
        if (!prev || prev.status !== "ok") return prev;
        return {
          ...prev,
          replies: prev.replies.map((r, i) =>
            i === index
              ? { ...r, text: response.result.text, translationKo: response.result.translationKo }
              : r,
          ),
        };
      });
      setLastRefine({ index, previousText, previousTranslationKo });
      setJustRefinedIndex(index);
      justRefinedTimeoutRef.current = window.setTimeout(() => {
        setJustRefinedIndex(null);
        justRefinedTimeoutRef.current = null;
      }, 1500);
    } else {
      // 실패해도 기존 답변은 그대로 유지한다(삭제하지 않음).
      setErrorMessage(response.message);
    }
  };

  // 다듬기 직후에만 나타나는 한 단계 되돌리기. 복잡한 버전 히스토리는 두지 않는다.
  const handleUndo = (index: number) => {
    if (!lastRefine || lastRefine.index !== index) return;
    const { previousText, previousTranslationKo } = lastRefine;
    setAiResult((prev) => {
      if (!prev || prev.status !== "ok") return prev;
      return {
        ...prev,
        replies: prev.replies.map((r, i) =>
          i === index ? { ...r, text: previousText, translationKo: previousTranslationKo } : r,
        ),
      };
    });
    clearRefineIndicators();
  };

  // "내 말투" 등록/삭제 확인 문구를 잠깐 보여주고 지운다(성가신 배지가 계속 남지 않도록).
  const showMyStyleNotice = (text: string) => {
    if (myStyleNoticeTimeoutRef.current !== null) {
      window.clearTimeout(myStyleNoticeTimeoutRef.current);
    }
    setMyStyleNotice(text);
    myStyleNoticeTimeoutRef.current = window.setTimeout(() => {
      setMyStyleNotice(null);
      myStyleNoticeTimeoutRef.current = null;
    }, 2500);
  };

  // "내 말투 기억"(STEP 10). 예시 메시지에서 스타일만 뽑아내는 작은 AI 호출 1회.
  // 예시 원문은 응답 처리 후 화면에도, 이 기기 저장소에도 남기지 않는다(스타일 값만 저장).
  const handleRegisterMyStyle = async () => {
    if (myStyleBusy) return;
    const samples = myStyleSamples
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .slice(0, MAX_MY_STYLE_SAMPLES);

    if (samples.length < MIN_MY_STYLE_SAMPLES) {
      setMyStyleError(`메시지를 ${MIN_MY_STYLE_SAMPLES}개 이상 입력해주세요.`);
      return;
    }

    const requestId = ++myStyleRequestIdRef.current;
    setMyStyleBusy(true);
    setMyStyleError(null);

    const response = await analyzeMyStyle(samples);

    setMyStyleBusy(false);
    if (requestId !== myStyleRequestIdRef.current) return; // 그 사이 새 요청이 시작됐다면 버린다.

    if (response.ok) {
      saveUserStyleProfile(response.profile);
      setMyStyleProfile(response.profile);
      setMyStyleSamples(""); // 예시 원문은 화면에도 계속 보관하지 않는다.
      setShowMyStylePanel(false);
      showMyStyleNotice("내 말투를 기억했어요.");
    } else {
      setMyStyleError(response.message);
    }
  };

  // 기기에 저장된 말투 프로필을 즉시 제거한다. 별도 계정이 없으므로 복잡한 절차는 두지 않는다.
  const handleDeleteMyStyle = () => {
    clearUserStyleProfile();
    setMyStyleProfile(null);
    setShowMyStylePanel(false);
    setMyStyleSamples("");
    setMyStyleError(null);
    showMyStyleNotice("내 말투를 삭제했어요.");
  };

  const displayReplies: DisplayReply[] | null = useMemo(() => {
    if (!aiResult || aiResult.status !== "ok") return null;
    // 배열 순서 자체가 AI가 정한 추천 우선순위이므로 그대로 사용한다(index 0 = 가장 추천하는 답변).
    return aiResult.replies.map((reply) => ({
      label: reply.label,
      text: reply.text,
      translation: reply.translationKo,
      emojiOnly: looksEmojiOnly(reply.text),
    }));
  }, [aiResult]);

  const quickReactions =
    aiResult && aiResult.status === "ok" && aiResult.showQuickReactions ? aiResult.quickReactions : [];

  const unreadableMessage =
    aiResult && aiResult.status === "unreadable" ? aiResult.message : null;

  // 화자(나/상대방) 확신이 낮을 때만 짧게 되묻는다(STEP 11). lastMessagePreview는 사용자 본인의
  // 대화 내용이라 그대로 보여줘도 안전하며, 어떤 메시지를 두고 묻는 것인지 알아볼 수 있게 한다.
  const speakerCheckPreview =
    aiResult && aiResult.status === "needsSpeakerCheck" ? aiResult.lastMessagePreview : null;

  return (
    <div className="min-h-full flex-1 bg-stone-50">
      <main className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 pb-16 pt-6">
        <header className="flex items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="말해줄게 - 말순이"
            className="h-20 w-20 rounded-xl object-contain"
          />
        </header>

        <p className="text-center text-xs text-slate-500">상황에 맞는 답변을 추천해드려요.</p>

        <section className="space-y-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-700">상대방 대화</h2>
            <p className="text-xs text-slate-500">
              상대방이 보낸 대화를 붙여넣거나 입력하세요 (스크린샷을 캡처했다면 여기에 그대로 붙여넣어도 돼요)
            </p>
          </div>

          {/* 별도 업로드 상자 없이, 선택하거나 붙여넣은 스크린샷이 이 입력창 안에 바로 보이도록
              썸네일 줄과 텍스트 입력을 하나의 테두리 안에 함께 둔다. */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-emerald-400">
            <div className={hasImages ? "border-b border-slate-100" : undefined}>
              <ImageUploader
                ref={imageUploaderRef}
                images={images}
                onAdd={handleAddImages}
                onRemove={handleRemoveImage}
                onMove={handleMoveImage}
                disabled={images.length >= MAX_IMAGES}
              />
            </div>
            <textarea
              value={conversationText}
              onChange={(event) => setConversationText(event.target.value)}
              onPaste={handlePasteConversation}
              aria-label="상대방 대화 입력"
              placeholder={
                hasImages
                  ? "추가 설명 (선택)\n예: 최근 조금 어색해졌어요 / 제가 먼저 만나자고 하고 싶어요"
                  : "상대방: 오늘 뭐해요?\n나: 아직 특별한 일정은 없어요.\n상대방: 그러면 저녁에 볼래요?"
              }
              className="h-64 w-full resize-none bg-transparent p-4 text-sm leading-relaxed text-slate-900 outline-none"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => imageUploaderRef.current?.open()}
              disabled={images.length >= MAX_IMAGES}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <AttachIcon />
              사진 첨부
            </button>
            <span className="text-[11px] text-slate-400">대화 내용은 저장하지 않습니다.</span>
          </div>

          {imageNotice && <p className="text-[11px] text-slate-400">{imageNotice}</p>}
        </section>

        <section className="space-y-3">
          <ChipSelect
            label="관계"
            value={relationship}
            primaryOptions={PRIMARY_RELATIONSHIPS}
            allOptions={RELATIONSHIPS}
            onChange={setRelationship}
          />
          <ChipSelect
            label="말투"
            value={speechLevel}
            primaryOptions={SPEECH_LEVELS}
            allOptions={SPEECH_LEVELS}
            onChange={setSpeechLevel}
          />
        </section>

        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced((prev) => !prev)}
            className="text-xs font-medium text-slate-400 hover:text-slate-600"
          >
            {showAdvanced ? "답변 설정 접기" : "답변 설정 더보기"}
          </button>
          {showAdvanced && (
            <div className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-3">
              <LabeledSelect label="내가 원하는 방향" value={goal} options={GOALS} onChange={setGoal} />
              <div className="space-y-1">
                <span className="text-xs font-medium text-slate-500">답변 스타일</span>
                <StyleSelector value={style} onChange={setStyle} />
              </div>

              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-500">내 말투</span>
                  {myStyleProfile ? (
                    <button
                      type="button"
                      onClick={handleDeleteMyStyle}
                      className="text-xs font-medium text-slate-400 hover:text-red-500"
                    >
                      내 말투 삭제
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMyStylePanel((prev) => !prev);
                        setMyStyleError(null);
                      }}
                      className="text-xs font-medium text-emerald-600 hover:underline"
                    >
                      {showMyStylePanel ? "닫기" : "내 말투 기억"}
                    </button>
                  )}
                </div>

                {myStyleProfile && (
                  <p className="text-[11px] text-slate-400">
                    저장된 내 말투를 답변에 참고해요. (자동, 이 기기에만 저장됨)
                  </p>
                )}

                {!myStyleProfile && showMyStylePanel && (
                  <div className="space-y-2 rounded-lg bg-stone-50 p-2">
                    <p className="text-[11px] text-slate-500">
                      평소 내가 보낸 메시지 {MIN_MY_STYLE_SAMPLES}~{MAX_MY_STYLE_SAMPLES}개를 한 줄씩
                      붙여넣어 주세요.
                    </p>
                    <textarea
                      value={myStyleSamples}
                      onChange={(event) => setMyStyleSamples(event.target.value)}
                      aria-label="평소 내가 보낸 메시지 예시 입력"
                      placeholder={
                        "ㅋㅋ 그건 좀 웃기다\n나 오늘은 조금 늦을 것 같아\n응 괜찮아 천천히 와"
                      }
                      className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-xs leading-relaxed text-slate-900 outline-none focus:border-emerald-400"
                    />
                    <p className="text-[10px] text-slate-400">
                      문장 내용이 아닌 말투 특징만 기억합니다.
                    </p>
                    {myStyleError && <p className="text-[11px] text-red-500">{myStyleError}</p>}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void handleRegisterMyStyle()}
                        disabled={myStyleBusy}
                        className="h-8 flex-1 rounded-lg bg-emerald-600 text-xs font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
                      >
                        {myStyleBusy ? "기억하는 중..." : "말투 기억하기"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowMyStylePanel(false);
                          setMyStyleSamples("");
                          setMyStyleError(null);
                        }}
                        disabled={myStyleBusy}
                        className="h-8 shrink-0 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {myStyleNotice && <p className="text-[11px] text-emerald-600">{myStyleNotice}</p>}
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!hasInput || isBusy}
          onClick={handleRecommend}
          className="h-14 w-full rounded-xl bg-emerald-600 text-base font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {isLoading
            ? isSlowRequest
              ? "답변 생성 시간이 조금 길어지고 있어요..."
              : "답변을 만들고 있어요..."
            : "답변 추천"}
        </button>

        {errorMessage && <p className="text-center text-sm text-red-600">{errorMessage}</p>}
        {unreadableMessage && (
          <p className="text-center text-sm text-amber-600">{unreadableMessage}</p>
        )}
        {notice && <p className="text-center text-xs text-slate-400">{notice}</p>}

        {speakerCheckPreview && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
            <p className="text-sm font-medium text-amber-700">마지막 메시지는 누구의 말인가요?</p>
            <p className="text-xs text-amber-600">“{speakerCheckPreview}”</p>
            <div className="flex justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleSpeakerAnswer("other")}
                disabled={isBusy}
                className="h-9 flex-1 max-w-32 rounded-lg bg-amber-600 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                상대방
              </button>
              <button
                type="button"
                onClick={() => handleSpeakerAnswer("me")}
                disabled={isBusy}
                className="h-9 flex-1 max-w-32 rounded-lg border border-amber-300 bg-white text-sm font-medium text-amber-700 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                나
              </button>
            </div>
          </div>
        )}

        {displayReplies && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-700">추천 답변</h2>
            <div className="space-y-3">
              {displayReplies.map((reply, i) => (
                <ReplyResultCard
                  key={i}
                  index={i}
                  text={reply.text}
                  translation={reply.translation}
                  emojiOnly={reply.emojiOnly}
                  typeLabel={reply.label}
                  onRefine={
                    reply.emojiOnly
                      ? undefined
                      : (adjustment, customInstruction) =>
                          void handleRefine(i, adjustment, customInstruction)
                  }
                  isRefining={refiningIndex === i}
                  refineDisabled={isBusy}
                  justRefined={justRefinedIndex === i}
                  onUndo={lastRefine?.index === i ? () => handleUndo(i) : undefined}
                  hasMyStyle={!!myStyleProfile}
                />
              ))}
            </div>

            <QuickEmojis emojis={quickReactions} />

            <button
              type="button"
              onClick={handleRetry}
              disabled={isBusy}
              className="h-12 w-full rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              다시 추천
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
