/**
 * textPaginationService.ts
 * Phase 5 文字清理、行數估算、截斷與分頁工具。
 * 純函式，不操作 DOM，不呼叫網路，不寫 console。
 */

import { PRES_TEXT_LAYOUT } from '@/config/presentationTheme'

// ── 文字清理 ──────────────────────────────────────────────────────────────

/**
 * 清理文字：移除 HTML/script、正規化空白、保留換行。
 * 不把內部網址轉成外部請求。
 */
export function sanitizeText(raw: string): string {
  if (!raw) return ''
  return (
    raw
      // 移除 script 標籤及其內容
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      // 移除 style 標籤及其內容
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // 移除所有其他 HTML 標籤
      .replace(/<[^>]+>/g, '')
      // 還原常見 HTML entities
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      // 正規化換行
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // 行內多餘空白合併
      .replace(/[^\S\n]+/g, ' ')
      // 每行 trim
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
  )
}

// ── 行數估算 ──────────────────────────────────────────────────────────────

/**
 * 估算文字渲染行數。
 * 依自然換行分段後，每段按 charsPerLine 估算自動換行次數。
 *
 * @param text        輸入文字
 * @param charsPerLine  每行約幾個字元（預設使用主題設定）
 */
export function estimateTextLines(
  text: string,
  charsPerLine: number = PRES_TEXT_LAYOUT.charsPerLineZh
): number {
  if (!text) return 0
  if (charsPerLine <= 0) return text.length
  const naturalLines = text.split('\n')
  let total = 0
  for (const line of naturalLines) {
    total += line.length === 0 ? 1 : Math.ceil(line.length / charsPerLine)
  }
  return total
}

// ── 安全截斷 ──────────────────────────────────────────────────────────────

/**
 * 安全截斷文字至不超過 maxLines 行。
 * 若需截斷，在末尾加入截斷標記（PRES_TEXT_LAYOUT.truncateSuffix）。
 * 截斷後不得讓文字超出預估行數。
 *
 * @param text        輸入文字
 * @param maxLines    最大行數
 * @param charsPerLine  每行字元數（預設主題設定）
 */
export function truncateTextSafely(
  text: string,
  maxLines: number,
  charsPerLine: number = PRES_TEXT_LAYOUT.charsPerLineZh
): string {
  if (!text) return ''
  if (estimateTextLines(text, charsPerLine) <= maxLines) return text

  const suffix = PRES_TEXT_LAYOUT.truncateSuffix
  const lines = text.split('\n')
  const result: string[] = []
  let usedLines = 0

  for (const line of lines) {
    const lineWraps = line.length === 0 ? 1 : Math.ceil(line.length / charsPerLine)
    if (usedLines + lineWraps > maxLines) {
      const remainingLines = maxLines - usedLines
      if (remainingLines > 0) {
        const maxChars = remainingLines * charsPerLine - suffix.length
        if (maxChars > 0) {
          result.push(line.slice(0, Math.max(0, maxChars)) + suffix)
        } else {
          result.push(suffix)
        }
      }
      break
    }
    result.push(line)
    usedLines += lineWraps
  }

  return result.join('\n')
}

// ── 文字分頁 ──────────────────────────────────────────────────────────────

/**
 * 將文字分成多頁區塊，每頁不超過 maxLinesPerPage 行。
 * 至少回傳一個區塊（即使文字為空）。
 * 不丟失任何行（不截斷，只分頁）。
 *
 * @param text            輸入文字
 * @param maxLinesPerPage  每頁最大行數（預設主題設定）
 * @param charsPerLine    每行字元數（預設主題設定）
 */
export function paginateTextBlocks(
  text: string,
  maxLinesPerPage: number = PRES_TEXT_LAYOUT.maxLinesPerTextSlide,
  charsPerLine: number = PRES_TEXT_LAYOUT.charsPerLineZh
): string[] {
  if (!text) return ['']
  if (estimateTextLines(text, charsPerLine) <= maxLinesPerPage) return [text]

  const naturalLines = text.split('\n')
  const pages: string[] = []
  let currentPageLines: string[] = []
  let usedLines = 0

  for (const line of naturalLines) {
    const lineWraps = line.length === 0 ? 1 : Math.ceil(line.length / charsPerLine)

    if (usedLines + lineWraps > maxLinesPerPage && currentPageLines.length > 0) {
      pages.push(currentPageLines.join('\n'))
      currentPageLines = []
      usedLines = 0
    }

    currentPageLines.push(line)
    usedLines += lineWraps
  }

  if (currentPageLines.length > 0) {
    pages.push(currentPageLines.join('\n'))
  }

  return pages.length > 0 ? pages : ['']
}
