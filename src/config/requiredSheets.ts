export const REQUIRED_WORK_SHEETS = [
  '工時分析(自助)',
  '專案清單',
  '維運清單',
  '人員清單',
] as const

export type RequiredWorkSheet = (typeof REQUIRED_WORK_SHEETS)[number]

export const OPTIONAL_WORK_SHEETS = [
  '收入工時彙總',
] as const

export type OptionalWorkSheet = (typeof OPTIONAL_WORK_SHEETS)[number]

export const PROJECT_CONTENT_SHEET = '專案內容' as const
export const PROJECT_CONTENT_ALTERNATIVE_SHEET = '專案內容第一期' as const
export const PROJECT_CONTENT_LEGACY_SLIDE_SHEET = '投影片內容' as const
export const PROJECT_CONTENT_SHEET_ALIASES = [
  PROJECT_CONTENT_SHEET,
  PROJECT_CONTENT_ALTERNATIVE_SHEET,
  PROJECT_CONTENT_LEGACY_SLIDE_SHEET,
] as const

/** 圖片展示欄位的識別關鍵詞 */
export const IMAGE_FIELD_KEYWORDS = ['圖片展示'] as const

/** 項次欄位的可能名稱 */
export const ITEM_NO_COLUMN_NAMES = ['項次', '序號', '項目'] as const

/** 専案對應表工作表名稱（選用工作表） */
export const PROJECT_MAPPING_SHEET = '専案對應表' as const

/** Phase 6C 核心分析圖使用的選用樞紐輸出工作表（exact sheet name） */
export const PIVOT_ANALYSIS_SHEETS = [
  '1.工時比例分析',
  '2.人力比例分析',
  '3.專案v.s.維運佔比分析',
] as const

/** 専案內容「専案名稱」欄位的可能標頭名稱（完整比對） */
export const PROJECT_CONTENT_NAME_FIELD_ALIASES = ['專案名稱', '専案名稱', '名稱', '案名', '項目名稱'] as const
