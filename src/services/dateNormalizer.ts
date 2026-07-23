/**
 * dateNormalizer.ts
 * 將各種格式的日期值標準化為 YYYY-MM-DD 字串。
 *
 * 設計原則：
 * - 禁用 new Date(string) 解析，避免瀏覽器時區差異造成跨日問題。
 * - Excel 日期序列數使用 UTC 算術直接轉換（不經 JS Date 時區轉換）。
 * - 所有輸出字串格式均為 YYYY-MM-DD。
 */

import type { ValidationIssue } from '@/types/validation'

export interface NormalizedDateResult {
  value: string | null
  valid: boolean
  issue?: ValidationIssue
}

/** Excel 序列數起始點至 Unix epoch 的天數差 */
const EXCEL_EPOCH_OFFSET = 25569

/** 驗證年月日數值是否合理 */
function isValidYearMonthDay(y: number, m: number, d: number): boolean {
  if (y < 1900 || y > 2200) return false
  if (m < 1 || m > 12) return false
  if (d < 1 || d > 31) return false
  // 簡易月份天數驗證
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  return d <= daysInMonth
}

/** 格式化為 YYYY-MM-DD */
function toISODateString(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** 從 Excel 序列數轉換（UTC，避免時區問題） */
function fromExcelSerial(serial: number): { y: number; m: number; d: number } | null {
  // 序列 < 1 無效；25569 偏移值已內含 Excel 1900 閏年 bug，不需額外校正
  if (serial < 1) return null
  const msFromEpoch = (serial - EXCEL_EPOCH_OFFSET) * 86400 * 1000
  // 使用 UTC 方法避免時區問題
  const tempDate = new Date(msFromEpoch)
  return {
    y: tempDate.getUTCFullYear(),
    m: tempDate.getUTCMonth() + 1,
    d: tempDate.getUTCDate(),
  }
}

/** 嘗試解析常見的日期字串格式 */
function parseStringDate(raw: string): { y: number; m: number; d: number } | null {
  const s = raw.trim()
  if (!s) return null

  // 1. YYYY-MM-DD 或 YYYY-MM-DD HH:mm:ss
  const fullMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (fullMatch) {
    return { y: parseInt(fullMatch[1], 10), m: parseInt(fullMatch[2], 10), d: parseInt(fullMatch[3], 10) }
  }

  // 2. YYYY/M/D 或 YYYY/MM/DD
  const slashMatch = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(s)
  if (slashMatch) {
    return { y: parseInt(slashMatch[1], 10), m: parseInt(slashMatch[2], 10), d: parseInt(slashMatch[3], 10) }
  }

  // 3. YYYY.M.D 或 YYYY.MM.DD
  const dotMatch = /^(\d{4})\.(\d{1,2})\.(\d{1,2})/.exec(s)
  if (dotMatch) {
    return { y: parseInt(dotMatch[1], 10), m: parseInt(dotMatch[2], 10), d: parseInt(dotMatch[3], 10) }
  }

  // 4. M/D/YYYY 格式（如 1/1/2026 → 2026-01-01）
  const mdyyyyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (mdyyyyMatch) {
    return { y: parseInt(mdyyyyMatch[3], 10), m: parseInt(mdyyyyMatch[1], 10), d: parseInt(mdyyyyMatch[2], 10) }
  }

  // 5. M/D/YY 格式（如 1/1/26 → 2026-01-01；yy<50 視為 2000+yy）
  const mdyyMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(s)
  if (mdyyMatch) {
    const yy = parseInt(mdyyMatch[3], 10)
    return { y: yy < 50 ? 2000 + yy : 1900 + yy, m: parseInt(mdyyMatch[1], 10), d: parseInt(mdyyMatch[2], 10) }
  }

  // 6. 純數字字串（可能是 Excel 序列數以文字型態儲存）
  if (/^\d+$/.test(s)) {
    const serial = parseInt(s, 10)
    // 合理的 Excel 序列數範圍（2000-01-01 = 36526 ～ 2100-12-31 = 73050）
    if (serial >= 36526 && serial <= 73050) {
      return fromExcelSerial(serial)
    }
  }

  return null
}

/**
 * 將原始值標準化為 YYYY-MM-DD。
 *
 * @param raw       - 原始儲存格值（可為字串、數字、Date、null 等）
 * @param fieldName - 欄位名稱（用於錯誤訊息）
 * @param rowIndex  - 0-indexed 資料列號（用於錯誤訊息，顯示時 +2）
 */
export function normalizeDate(
  raw: unknown,
  fieldName: string,
  rowIndex: number
): NormalizedDateResult {
  const displayRow = rowIndex + 2

  const makeIssue = (message: string): ValidationIssue => ({
    code: 'INVALID_DATE',
    severity: 'warning',
    source: 'work-record',
    message,
    column: fieldName,
    row: displayRow,
  })

  // 空值
  if (raw === null || raw === undefined || raw === '') {
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」日期欄位為空。`),
    }
  }

  let parsed: { y: number; m: number; d: number } | null = null

  // 數字型別（Excel 序列數）
  if (typeof raw === 'number') {
    if (!isFinite(raw) || raw !== Math.floor(raw)) {
      return {
        value: null,
        valid: false,
        issue: makeIssue(`第 ${displayRow} 列「${fieldName}」日期序列數無效（${raw}）。`),
      }
    }
    parsed = fromExcelSerial(raw)
  } else if (typeof raw === 'string') {
    parsed = parseStringDate(raw)
  } else {
    // 其他型別
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」日期格式無法辨識（型別：${typeof raw}）。`),
    }
  }

  if (!parsed) {
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」日期格式無法解析（原始值：${String(raw)}）。`),
    }
  }

  if (!isValidYearMonthDay(parsed.y, parsed.m, parsed.d)) {
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」日期值超出合理範圍（${parsed.y}-${parsed.m}-${parsed.d}）。`),
    }
  }

  return {
    value: toISODateString(parsed.y, parsed.m, parsed.d),
    valid: true,
  }
}
