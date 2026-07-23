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

    // 維運模組鍵：trim(編號(模組維護)) + "(" + trim(維運項目) + ")"
    const maintenanceModuleKey = code && name ? `${code.trim()}(${name.trim()})` : ''
    const maintenanceKey = maintenanceModuleKey || code || name

    if (!maintenanceKey) {
      skippedRows++
      continue
    }

    records.push({
      maintenanceKey,
      maintenanceName: name || undefined,
      maintenanceModuleKey: maintenanceModuleKey || undefined,
    })
  }

  return { records, issues, skippedRows }
}

/**
 * 從 MaintenanceMasterRecord[] 建立以「編號(維運項目)」為鍵的集合（供 workRecordMapper 精確分類）。
 */
export function buildMaintenanceModuleKeySet(records: MaintenanceMasterRecord[]): Set<string> {
  const set = new Set<string>()
  for (const r of records) {
    if (r.maintenanceModuleKey) set.add(r.maintenanceModuleKey)
  }
  return set
}

/**
 * 從 MaintenanceMasterRecord[] 建立鍵值集合（向後相容）。
 */
export function buildMaintenanceKeySet(records: MaintenanceMasterRecord[]): Set<string> {
  return new Set(records.map((r) => r.maintenanceKey))
}
