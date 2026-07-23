/**
 * workRecordMapper.ts
 * 將「工時分析(自助)」工作表映射為 NormalizedWorkRecord[]。
 *
 * 分類邏輯：以工時表「模組」欄的值直接與
 *   - 專案清單「模組」欄（projectModuleKeySet）
 *   - 維運清單組合鍵 CODE(NAME)（maintenanceModuleKeySet）
 * 進行精確比對。無法比對者歸入「other」，不產生警告（行政、請假等共用模組為正常情形）。
 *
 * 員工識別邏輯：優先使用姓名查 nameToEmployeeKeyMap 取得員工編號；
 * 找不到者以姓名為備用鍵並產生警告；同名多鍵者產生錯誤並略過。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { NormalizedWorkRecord, MappingResult, PersonRecord } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { WORK_HOURS_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'
import { normalizeDate } from './dateNormalizer'
import { normalizeNumber } from './numberNormalizer'

/**
 * 哨兵值：代表同一姓名對應到多個員工編號（有歧義）。
 * 使用 null-byte 前後綴確保不會與真實員工編號衝突。
 */
export const AMBIGUOUS_KEY = '\x00AMBIGUOUS\x00' as const

/**
 * 建立「姓名 → 員工編號」對應表。
 * 若同一姓名對應多個不同員工編號，該條目的值設為 AMBIGUOUS_KEY。
 */
export function buildNameToEmployeeKeyMap(personRecords: PersonRecord[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const p of personRecords) {
    if (!p.employeeName) continue
    const name = p.employeeName.trim()
    if (!name) continue
    const existing = map.get(name)
    if (existing === AMBIGUOUS_KEY) {
      continue
    }
    if (existing !== undefined && existing !== p.employeeKey) {
      map.set(name, AMBIGUOUS_KEY)
    } else {
      map.set(name, p.employeeKey)
    }
  }
  return map
}

/**
 * 將工時分析工作表映射為標準化工時記錄。
 *
 * @param sheet                    - 已解析的工作表
 * @param projectModuleKeySet      - 專案清單「模組」欄值的集合（CODE(NAME)）
 * @param maintenanceModuleKeySet  - 維運清單組合鍵的集合（CODE(NAME)）
 * @param nameToEmployeeKeyMap     - 姓名 → 員工編號映射（由 buildNameToEmployeeKeyMap 建立）
 */
export function mapWorkRecords(
  sheet: ParsedWorkbookSheet,
  projectModuleKeySet: ReadonlySet<string>,
  maintenanceModuleKeySet: ReadonlySet<string>,
  nameToEmployeeKeyMap: ReadonlyMap<string, string>
): MappingResult<NormalizedWorkRecord> {
  const issues: ValidationIssue[] = []
  const records: NormalizedWorkRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colWorkDate     = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.workDate)
  const colEmployeeId   = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.employeeId)
  const colEmployeeName = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.employeeName)
  const colHours        = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.hours)
  const colModuleKey    = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.moduleKey)
  const colOrganization = resolveColumnIndex(headers, WORK_HOURS_FIELD_MAPPING.organization)

  // 若必要欄位缺失則提早返回
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

  // 無員工編號欄且無姓名查找表時，工時表以姓名為鍵，提示可能同名風險
  if (colEmployeeId < 0 && nameToEmployeeKeyMap.size === 0) {
    issues.push({
      code: 'NO_EMPLOYEE_ID_AVAILABLE',
      severity: 'warning',
      source: 'work-record',
      message: '未偵測到員工編號，暫以姓名作為人員鍵，可能存在同名風險。',
      sheet: sheet.originalName,
    })
  }

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    // ── 日期 ────────────────────────────────────────────────────
    const rawDate = colWorkDate < row.length ? row[colWorkDate] : ''
    const dateResult = normalizeDate(rawDate, WORK_HOURS_FIELD_MAPPING.workDate.canonicalField, i)
    if (!dateResult.valid) {
      if (dateResult.issue) issues.push(dateResult.issue)
      skippedRows++
      continue
    }

    // ── 工時 ────────────────────────────────────────────────────
    const rawHours = colHours < row.length ? row[colHours] : ''
    const hoursResult = normalizeNumber(rawHours, WORK_HOURS_FIELD_MAPPING.hours.canonicalField, i)
    if (!hoursResult.valid) {
      if (hoursResult.issue) issues.push(hoursResult.issue)
      skippedRows++
      continue
    }

    // ── 員工識別 ─────────────────────────────────────────────────
    const empName = colEmployeeName >= 0 ? getCellString(row, colEmployeeName) : ''
    let employeeKey = ''

    if (empName && nameToEmployeeKeyMap.size > 0) {
      const mapped = nameToEmployeeKeyMap.get(empName)
      if (mapped === AMBIGUOUS_KEY) {
        issues.push({
          code: 'AMBIGUOUS_EMPLOYEE_NAME',
          severity: 'error',
          source: 'work-record',
          message: `第 ${i + 2} 列姓名「${empName}」對應到多個不同員工編號，無法唯一識別，該列已略過。`,
          row: i + 2,
          sheet: sheet.originalName,
        })
        skippedRows++
        continue
      } else if (mapped !== undefined) {
        employeeKey = mapped
      } else {
        // 姓名在人員清單中找不到 → 以姓名為備用鍵
        issues.push({
          code: 'EMPLOYEE_NAME_NOT_FOUND',
          severity: 'warning',
          source: 'work-record',
          message: `第 ${i + 2} 列姓名「${empName}」在人員清單中查無資料，已以姓名作為員工識別鍵。`,
          row: i + 2,
          sheet: sheet.originalName,
        })
        employeeKey = empName
      }
    } else {
      // 無姓名查找表 → 退回舊行為（直接用工時表的 ID 或姓名）
      const empId = colEmployeeId >= 0 ? getCellString(row, colEmployeeId) : ''
      employeeKey = empId || empName
    }

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

    // ── 分類（以「模組」欄精確比對專案/維運集合）────────────────
    const moduleKeyValue = colModuleKey >= 0 ? getCellString(row, colModuleKey) : ''
    const organization = colOrganization >= 0 ? getCellString(row, colOrganization) : ''

    const isProject     = moduleKeyValue !== '' && projectModuleKeySet.has(moduleKeyValue)
    const isMaintenance = moduleKeyValue !== '' && maintenanceModuleKeySet.has(moduleKeyValue)

    if (isProject && isMaintenance) {
      issues.push({
        code: 'AMBIGUOUS_WORK_ITEM_CATEGORY',
        severity: 'error',
        source: 'work-record',
        message: `第 ${i + 2} 列模組「${moduleKeyValue}」同時出現在專案清單與維運清單，無法唯一分類，該列已略過。`,
        row: i + 2,
        sheet: sheet.originalName,
      })
      skippedRows++
      continue
    }

    let workCategory: NormalizedWorkRecord['workCategory'] = 'other'
    let finalProjectKey: string | undefined
    let finalMaintKey: string | undefined

    if (isProject) {
      workCategory = 'project'
      finalProjectKey = moduleKeyValue
    } else if (isMaintenance) {
      workCategory = 'maintenance'
      finalMaintKey = moduleKeyValue
    }
    // 否則為 other（含空白模組與共用模組，不產生警告）

    records.push({
      sourceRow: i + 2,
      workDate: dateResult.value as string,
      employeeKey,
      employeeName: empName || undefined,
      moduleKey: moduleKeyValue || undefined,
      moduleName: moduleKeyValue || undefined,
      organization: organization || undefined,
      workCategory,
      projectKey: finalProjectKey,
      maintenanceKey: finalMaintKey,
      hours: hoursResult.value as number,
    })
  }

  return { records, issues, skippedRows }
}

