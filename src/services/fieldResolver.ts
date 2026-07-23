/**
 * fieldResolver.ts
 * 根據 FieldAliasConfig 從工作表標題列中找出欄位索引。
 *
 * 唯一允許的比對方式：normalizeHeaderName() 後完整字串相符。
 * 禁止模糊相似度比對、禁止 includes() 自動猜欄位。
 */

import { normalizeHeaderName } from './headerNormalizer'
import type { FieldAliasConfig } from '@/config/workbookFieldMappings'

/**
 * 在 headers 中尋找符合 fieldConfig 任一別名的欄位索引。
 *
 * @param headers     - 已正規化的標題列（由 parseSheet 提供）
 * @param fieldConfig - 欄位映射設定
 * @returns 欄位索引（0-indexed），若未找到則為 -1
 */
export function resolveColumnIndex(
  headers: string[],
  fieldConfig: FieldAliasConfig
): number {
  const normalizedAliases = fieldConfig.aliases.map((a) => normalizeHeaderName(a))
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeaderName(headers[i])
    if (normalizedAliases.includes(h)) {
      return i
    }
  }
  return -1
}

/**
 * 從單列資料中取出指定索引的字串值（去除首尾空白）。
 * 若索引為 -1 或值為 undefined/null，回傳空字串。
 */
export function getCellString(row: unknown[], colIndex: number): string {
  if (colIndex < 0 || colIndex >= row.length) return ''
  const val = row[colIndex]
  if (val === null || val === undefined) return ''
  return String(val).trim()
}
