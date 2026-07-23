import type { ValidationIssue } from './validation'

export interface ParsedWorkbookSheet {
  originalName: string
  normalizedName: string
  headers: string[]
  rowCount: number
  rows: unknown[][]
}

export interface WorkbookValidationResult {
  valid: boolean
  fileType: 'work-hours' | 'project-content'
  detectedSheets: string[]
  missingSheets: string[]
  parsedSheets: Record<string, ParsedWorkbookSheet>
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
  info: ValidationIssue[]
}
