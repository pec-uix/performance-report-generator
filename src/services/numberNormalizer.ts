/**
 * numberNormalizer.ts
 * 將各種格式的數字值標準化為 JavaScript number。
 * 主要用途：解析工時欄位。
 *
 * 拒絕規則：
 * - 空值
 * - NaN / Infinity
 * - 負數
 * - 含文字單位（如「小時」「h」）
 * - 純文字（如 N/A、-）
 */

import type { ValidationIssue } from '@/types/validation'

export interface NormalizedNumberResult {
  value: number | null
  valid: boolean
  issue?: ValidationIssue
}

/**
 * 將原始值標準化為有限非負數。
 *
 * @param raw       - 原始儲存格值
 * @param fieldName - 欄位名稱（用於錯誤訊息）
 * @param rowIndex  - 0-indexed 資料列號
 */
export function normalizeNumber(
  raw: unknown,
  fieldName: string,
  rowIndex: number
): NormalizedNumberResult {
  const displayRow = rowIndex + 2

  const makeIssue = (message: string): ValidationIssue => ({
    code: 'INVALID_NUMBER',
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
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」數值欄位為空。`),
    }
  }

  let numericValue: number

  if (typeof raw === 'number') {
    numericValue = raw
  } else if (typeof raw === 'string') {
    const s = raw.trim()
    if (!s) {
      return {
        value: null,
        valid: false,
        issue: makeIssue(`第 ${displayRow} 列「${fieldName}」數值欄位為空。`),
      }
    }

    // 去除千分位逗號後嘗試解析
    const cleaned = s.replace(/,/g, '')

    // 若去除千分位後仍含有非數字字元（小數點和負號除外），則拒絕
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) {
      return {
        value: null,
        valid: false,
        issue: makeIssue(
          `第 ${displayRow} 列「${fieldName}」無法解析為數字（原始值：「${s}」）。`
        ),
      }
    }

    numericValue = parseFloat(cleaned)
  } else {
    return {
      value: null,
      valid: false,
      issue: makeIssue(
        `第 ${displayRow} 列「${fieldName}」數值型別無法辨識（型別：${typeof raw}）。`
      ),
    }
  }

  if (!isFinite(numericValue) || isNaN(numericValue)) {
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」數值為無效的浮點數（${numericValue}）。`),
    }
  }

  if (numericValue < 0) {
    return {
      value: null,
      valid: false,
      issue: makeIssue(`第 ${displayRow} 列「${fieldName}」工時不可為負數（${numericValue}）。`),
    }
  }

  return { value: numericValue, valid: true }
}
