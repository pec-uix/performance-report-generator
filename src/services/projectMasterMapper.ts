/**
 * projectMasterMapper.ts
 * 將「專案清單」工作表映射為 ProjectMasterRecord[]。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { ProjectMasterRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { PROJECT_MASTER_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'

export function mapProjectMasterRecords(
  sheet: ParsedWorkbookSheet
): MappingResult<ProjectMasterRecord> {
  const issues: ValidationIssue[] = []
  const records: ProjectMasterRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colItemNo      = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.itemNo)
  const colProjectCode = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectCode)
  const colProjectName = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectName)

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    const projectCode = colProjectCode >= 0 ? getCellString(row, colProjectCode) : ''
    const projectName = colProjectName >= 0 ? getCellString(row, colProjectName) : ''
    const itemNo      = colItemNo      >= 0 ? getCellString(row, colItemNo)      : ''

    // 優先使用代碼，其次使用名稱作為鍵值
    const projectKey = projectCode || projectName

    if (!projectKey) {
      skippedRows++
      continue
    }

    records.push({
      projectKey,
      projectName: projectName || undefined,
      itemNo: itemNo || undefined,
    })
  }

  return { records, issues, skippedRows }
}

/**
 * 從 ProjectMasterRecord[] 建立鍵值集合（供 workRecordMapper 分類使用）。
 */
export function buildProjectKeySet(records: ProjectMasterRecord[]): Set<string> {
  return new Set(records.map((r) => r.projectKey))
}
