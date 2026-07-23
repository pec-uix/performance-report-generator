/**
 * headerNormalizer.ts
 * 欄位名稱正規化。只容許空白、全半形空白、換行差異正規化，
 * 不使用模糊字串相似度。
 */

/**
 * 正規化欄位名稱：
 * 1. 全形空白 → 半形空白
 * 2. 換行/Tab → 空白
 * 3. 連續空白合併為一個
 * 4. trim
 */
export function normalizeHeaderName(name: string): string {
  return name
    .replace(/\u3000/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 向右填補兩層表頭的第一層群組名稱。
 * Excel 合併儲存格在 xlsx 解析後，後續儲存格會為空白，
 * 需將群組名稱向右延伸至下一個非空格為止。
 */
export function fillMergedGroupNames(groupRow: string[]): string[] {
  const filled = [...groupRow]
  let lastNonEmpty = ''
  for (let i = 0; i < filled.length; i++) {
    const cell = normalizeHeaderName(filled[i] ?? '')
    if (cell !== '') {
      lastNonEmpty = cell
      filled[i] = cell
    } else {
      filled[i] = lastNonEmpty
    }
  }
  return filled
}

/**
 * 組合兩層表頭為唯一欄位鍵。
 * - 若群組名稱為空或與欄位名稱相同，直接使用欄位名稱
 * - 否則格式為「群組_欄位」
 * - 重複鍵加入穩定序號（_2、_3 …）
 */
export function buildTwoLayerHeaders(
  groupRow: string[],
  fieldRow: string[]
): { key: string; originalGroup: string; originalField: string }[] {
  const filledGroups = fillMergedGroupNames(groupRow.map((c) => String(c)))
  const maxLen = Math.max(groupRow.length, fieldRow.length)
  const result: { key: string; originalGroup: string; originalField: string }[] = []
  const keyCount: Record<string, number> = {}

  for (let i = 0; i < maxLen; i++) {
    const group = filledGroups[i] ?? ''
    const field = normalizeHeaderName(String(fieldRow[i] ?? ''))
    const originalGroup = String(groupRow[i] ?? '')
    const originalField = String(fieldRow[i] ?? '')

    let baseKey: string
    if (group === '' || group === field) {
      baseKey = field !== '' ? field : `col_${i}`
    } else if (field === '') {
      baseKey = group !== '' ? group : `col_${i}`
    } else {
      baseKey = `${group}_${field}`
    }

    // 處理重複鍵：第一次出現 key=baseKey，第二次起 key=baseKey_2, baseKey_3 …
    if (keyCount[baseKey] === undefined) {
      keyCount[baseKey] = 1
      result.push({ key: baseKey, originalGroup, originalField })
    } else {
      keyCount[baseKey]++
      result.push({ key: `${baseKey}_${keyCount[baseKey]}`, originalGroup, originalField })
    }
  }

  return result
}
