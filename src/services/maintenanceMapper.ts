/**
 * maintenanceMapper.ts
 * 將「維運清單」工作表映射為 MaintenanceMasterRecord[]。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { MaintenanceMasterRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { MAINTENANCE_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'

export function mapMaintenanceRecords(
  sheet: ParsedWorkbookSheet
): MappingResult<MaintenanceMasterRecord> {
  const issues: ValidationIssue[] = []
  const records: MaintenanceMasterRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colCode = resolveColumnIndex(headers, MAINTENANCE_FIELD_MAPPING.maintenanceCode)
  const colName = resolveColumnIndex(headers, MAINTENANCE_FIELD_MAPPING.maintenanceName)

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    const code = colCode >= 0 ? getCellString(row, colCode) : ''
    const name = colName >= 0 ? getCellString(row, colName) : ''

    const maintenanceKey = code || name

    if (!maintenanceKey) {
      skippedRows++
      continue
    }

    records.push({
      maintenanceKey,
      maintenanceName: name || undefined,
    })
  }

  return { records, issues, skippedRows }
}

/**
 * 從 MaintenanceMasterRecord[] 建立鍵值集合（供 workRecordMapper 分類使用）。
 */
export function buildMaintenanceKeySet(records: MaintenanceMasterRecord[]): Set<string> {
  return new Set(records.map((r) => r.maintenanceKey))
}
