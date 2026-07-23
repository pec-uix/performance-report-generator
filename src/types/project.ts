import type { ValidationIssue } from './validation'

export type ProjectItemType = 'main' | 'child' | 'invalid'

export interface ImageRef {
  column: string
  filenames: string[]
}

export type LegacyContentSourceType = 'project' | 'maintenance'
export type ProjectItemSourceType = LegacyContentSourceType | 'unresolved'

export interface LegacyResolvedIdentity {
  sourceType: LegacyContentSourceType
  stableItemId: string
  moduleKey: string
  matchedName: string
  sourceRow: number
}

export interface LegacySlideContentRow {
  projectName: string
  pm?: string
  sectionTitle?: string
  content?: string
  imageFilename?: string
  chartSheetName?: string
  sourceRow: number
}

export interface ProjectItem {
  rowIndex: number
  /** 真實 Excel 1-based row number。若未提供，舊流程以 rowIndex 推算。 */
  sourceRow?: number
  rawItemNo: string
  normalizedItemNo: string
  itemType: ProjectItemType
  parentItemNo?: string
  sourceType?: ProjectItemSourceType
  projectCode?: string
  stableItemId?: string
  moduleKey?: string
  matchedName?: string
  matchStatus?: 'exact' | 'case-normalized' | 'code-fallback' | 'unmatched'
  displayName?: string
  legacySectionTitle?: string
  legacyContent?: LegacySlideContentRow
  data: Record<string, unknown>
  imageRefs: ImageRef[]
}

export interface ProjectContentResult {
  sheetFound: boolean
  alternativeSheetFound: boolean
  legacyMode?: boolean
  totalRows: number
  mainCount: number
  childCount: number
  invalidCount: number
  duplicateCount: number
  orphanChildCount: number
  items: ProjectItem[]
  detectedHeaders: string[]
  issues: ValidationIssue[]
}
