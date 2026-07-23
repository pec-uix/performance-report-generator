/**
 * projectMasterMapper.ts
 * 將「專案清單」工作表映射為 ProjectMasterRecord[]。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { ProjectMasterRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { PROJECT_MASTER_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'
import { normalizeNumber } from './numberNormalizer'

function splitPeople(value: string): string[] {
  return value
    .split(/[、,，/／\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function mapProjectMasterRecords(
  sheet: ParsedWorkbookSheet
): MappingResult<ProjectMasterRecord> {
  const issues: ValidationIssue[] = []
  const records: ProjectMasterRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colItemNo           = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.itemNo)
  const colProjectCode      = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectCode)
  const colProjectName      = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectName)
  const colProjectModuleKey = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectModuleKey)
  const colPm               = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.pm)
  const colMembers          = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.members)
  const colProjectRevenue   = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.projectRevenue)
  const colAnnualRevenue    = resolveColumnIndex(headers, PROJECT_MASTER_FIELD_MAPPING.annualRevenue)

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    const projectCode      = colProjectCode      >= 0 ? getCellString(row, colProjectCode)      : ''
    const projectName      = colProjectName      >= 0 ? getCellString(row, colProjectName)      : ''
    const itemNo           = colItemNo           >= 0 ? getCellString(row, colItemNo)           : ''
    const projectModuleKey = colProjectModuleKey >= 0 ? getCellString(row, colProjectModuleKey) : ''
    const pm               = colPm               >= 0 ? getCellString(row, colPm)               : ''
    const membersRaw       = colMembers          >= 0 ? getCellString(row, colMembers)          : ''
    const projectRevenueResult = colProjectRevenue >= 0
      ? normalizeNumber(row[colProjectRevenue], PROJECT_MASTER_FIELD_MAPPING.projectRevenue.canonicalField, i)
      : null
    const annualRevenueResult = colAnnualRevenue >= 0
      ? normalizeNumber(row[colAnnualRevenue], PROJECT_MASTER_FIELD_MAPPING.annualRevenue.canonicalField, i)
      : null

    // 主鍵優先：模組欄完整值（CODE(NAME)），其次代碼，最後名稱
    const projectKey = projectModuleKey || projectCode || projectName

    if (!projectKey) {
      skippedRows++
      continue
    }

    records.push({
      projectKey,
      projectName: projectName || undefined,
      itemNo: itemNo || undefined,
      projectModuleKey: projectModuleKey || undefined,
      pm: pm || undefined,
      members: membersRaw ? splitPeople(membersRaw) : undefined,
      projectRevenue: projectRevenueResult
        ? (projectRevenueResult.valid ? (projectRevenueResult.value as number) : null)
        : undefined,
      annualRevenue: annualRevenueResult
        ? (annualRevenueResult.valid ? (annualRevenueResult.value as number) : null)
        : undefined,
    })
  }

  return { records, issues, skippedRows }
}

/**
 * 從 ProjectMasterRecord[] 建立以「模組」欄值為鍵的集合（供 workRecordMapper 精確分類）。
 */
export function buildProjectModuleKeySet(records: ProjectMasterRecord[]): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.projectModuleKey) set.add(r.projectModuleKey)
  }
  return set
}

/**
 * 從 ProjectMasterRecord[] 建立鍵值集合（向後相容）。
 */
export function buildProjectKeySet(records: ProjectMasterRecord[]): Set<string> {
  return new Set(records.map((r) => r.projectKey))
}
