/**
 * workRecordMapper.ts
 * 將「工時分析(自助)」工作表映射為 NormalizedWorkRecord[]。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { NormalizedWorkRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { WORK_HOURS_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'
import { normalizeDate } from './dateNormalizer'
import { normalizeNumber } from './numberNormalizer'

/**
 * 將工時分析工作表映射為標準化工時記錄。
 *
 * @param sheet              - 已解析的工作表
 * @param projectKeySet      - 有效的專案鍵值集合（用於分類）
 * @param maintenanceKeySet  - 有效的維運鍵值集合（用於分類）
 */
export function mapWorkRecords(
  sheet: ParsedWorkbookSheet,
  projectKeySet: Set<string>,
  maintenanceKeySet: Set<string>
): MappingResult<NormalizedWorkRecord> {
  const issues: ValidationIssue[] = []
  const records: NormalizedWorkRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  // 解析各欄位索引
  const colWorkDate     = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.workDate)
  const colEmployeeId   = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.employeeId)
  const colEmployeeName = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.employeeName)
  const colHours        = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.hours)
  const colProjectCode  = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.projectCode)
  const colProjectName  = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.projectName)
  const colMaintCode    = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.maintenanceCode)
  const colMaintName    = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.maintenanceName)

  // 若必要欄位均缺失則提早返回
  if (colWorkDate < 0) {
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      source: 'work-record',
      message: `工時分析工作表找不到日期欄位（已嘗試別名：${WORK_HOURS_FIELD_MAPPING.workDate.aliases.join('、')}）。`,
      sheet: sheet.originalName,
    })
    return { records: [], issues, skippedRows: sheet.rows.length }
  }

  if (colHours < 0) {
    issues.push({
      code: 'MISSING_REQUIRED_FIELD',
      severity: 'error',
      source: 'work-record',
      message: `工時分析工作表找不到工時欄位（已嘗試別名：${WORK_HOURS_FIELD_MAPPING.hours.aliases.join('、')}）。`,
      sheet: sheet.originalName,
    })
    return { records: [], issues, skippedRows: sheet.rows.length }
  }

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    // 日期
    const rawDate = colWorkDate < row.length ? row[colWorkDate] : ''
    const dateResult = normalizeDate(rawDate, WORK_HOURS_FIELD_MAPPING.workDate.canonicalField, i)
    if (!dateResult.valid) {
      if (dateResult.issue) issues.push(dateResult.issue)
      skippedRows++
      continue
    }

    // 工時
    const rawHours = colHours < row.length ? row[colHours] : ''
    const hoursResult = normalizeNumber(rawHours, WORK_HOURS_FIELD_MAPPING.hours.canonicalField, i)
    if (!hoursResult.valid) {
      if (hoursResult.issue) issues.push(hoursResult.issue)
      skippedRows++
      continue
    }

    // 員工識別鍵（優先使用 ID，其次使用姓名）
    const empId   = colEmployeeId >= 0 ? getCellString(row, colEmployeeId) : ''
    const empName = colEmployeeName >= 0 ? getCellString(row, colEmployeeName) : ''
    const employeeKey = empId || empName

    if (!employeeKey) {
      issues.push({
        code: 'MISSING_EMPLOYEE_KEY',
        severity: 'warning',
        source: 'work-record',
        message: `第 ${i + 2} 列找不到員工識別欄位（員工編號或姓名均空白），該列已略過。`,
        row: i + 2,
        sheet: sheet.originalName,
      })
      skippedRows++
      continue
    }

    // 專案 / 維運識別
    const projectCode = colProjectCode >= 0 ? getCellString(row, colProjectCode) : ''
    const projectName = colProjectName >= 0 ? getCellString(row, colProjectName) : ''
    const maintCode   = colMaintCode   >= 0 ? getCellString(row, colMaintCode)   : ''
    const maintName   = colMaintName   >= 0 ? getCellString(row, colMaintName)   : ''

    // 分類邏輯：優先使用代碼與主檔比對，代碼不存在時嘗試名稱
    const resolvedProjectKey  = projectCode  || projectName
    const resolvedMaintKey    = maintCode    || maintName

    let workCategory: NormalizedWorkRecord['workCategory'] = 'other'
    let finalProjectKey: string | undefined
    let finalMaintKey: string | undefined

    if (resolvedProjectKey && projectKeySet.has(resolvedProjectKey)) {
      workCategory = 'project'
      finalProjectKey = resolvedProjectKey
    } else if (resolvedMaintKey && maintenanceKeySet.has(resolvedMaintKey)) {
      workCategory = 'maintenance'
      finalMaintKey = resolvedMaintKey
    } else if (resolvedProjectKey || resolvedMaintKey) {
      // 有填寫但主檔中找不到 → 歸入 other，產生警告
      workCategory = 'other'
      issues.push({
        code: 'UNMATCHED_WORK_ITEM',
        severity: 'warning',
        source: 'work-record',
        message: `第 ${i + 2} 列的工作項目「${resolvedProjectKey || resolvedMaintKey}」在專案清單與維運清單中均查無資料，已歸類為「其他」。`,
        row: i + 2,
        sheet: sheet.originalName,
      })
    }

    records.push({
      sourceRow: i + 2,
      workDate: dateResult.value as string,
      employeeKey,
      employeeName: empName || undefined,
      workCategory,
      projectKey: finalProjectKey,
      projectName: projectName || undefined,
      maintenanceKey: finalMaintKey,
      maintenanceName: maintName || undefined,
      hours: hoursResult.value as number,
    })
  }

  return { records, issues, skippedRows }
}
