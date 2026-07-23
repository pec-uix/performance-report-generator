import type { ValidationIssue } from './validation'

export type ProjectItemType = 'main' | 'child' | 'invalid'

export interface ImageRef {
  column: string
  filenames: string[]
}

export interface ProjectItem {
  rowIndex: number
  rawItemNo: string
  normalizedItemNo: string
  itemType: ProjectItemType
  parentItemNo?: string
  data: Record<string, unknown>
  imageRefs: ImageRef[]
}

export interface ProjectContentResult {
  sheetFound: boolean
  alternativeSheetFound: boolean
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
