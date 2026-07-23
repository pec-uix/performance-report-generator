export const REQUIRED_WORK_SHEETS = [
  '工時分析(自助)',
  '專案清單',
  '維運清單',
  '人員清單',
  '收入工時彙總',
] as const

export type RequiredWorkSheet = (typeof REQUIRED_WORK_SHEETS)[number]

export const PROJECT_CONTENT_SHEET = '專案內容' as const
export const PROJECT_CONTENT_ALTERNATIVE_SHEET = '專案內容第一期' as const

/** 圖片展示欄位的識別關鍵詞 */
export const IMAGE_FIELD_KEYWORDS = ['圖片展示'] as const

/** 項次欄位的可能名稱 */
export const ITEM_NO_COLUMN_NAMES = ['項次', '序號', '項目'] as const
