// 답변 카드, 이모티콘 등 여러 곳에서 재사용하는 클립보드 복사 유틸리티.
export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 클립보드 API를 사용할 수 없는 환경을 위한 대체 방법
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }
}
