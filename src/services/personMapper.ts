/**
 * personMapper.ts
 * 將「人員清單」工作表映射為 PersonRecord[]。
 */

import type { ParsedWorkbookSheet } from '@/types/excel'
import type { PersonRecord, MappingResult } from '@/types/analysis'
import type { ValidationIssue } from '@/types/validation'
import { PERSON_FIELD_MAPPING } from '@/config/workbookFieldMappings'
import { resolveColumnIndex, getCellString } from './fieldResolver'
import { normalizeNumber } from './numberNormalizer'

export function mapPersonRecords(
  sheet: ParsedWorkbookSheet
): MappingResult<PersonRecord> {
  const issues: ValidationIssue[] = []
  const records: PersonRecord[] = []
  let skippedRows = 0

  const headers = sheet.headers

  const colEmpId      = resolveColumnIndex(headers, PERSON_FIELD_MAPPING.employeeId)
  const colEmpName    = resolveColumnIndex(headers, PERSON_FIELD_MAPPING.employeeName)
  const colDept       = resolveColumnIndex(headers, PERSON_FIELD_MAPPING.department)
  const colCapacity   = resolveColumnIndex(headers, PERSON_FIELD_MAPPING.monthlyCapacityHours)
  const colHourlyCost = resolveColumnIndex(headers, PERSON_FIELD_MAPPING.hourlyCost)

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]

    const empId   = colEmpId   >= 0 ? getCellString(row, colEmpId)   : ''
    const empName = colEmpName >= 0 ? getCellString(row, colEmpName) : ''
    const employeeKey = empId || empName

    if (!employeeKey) {
      skippedRows++
      continue
    }

    const dept = colDept >= 0 ? getCellString(row, colDept) : ''

    let monthlyCapacityHours: number | null | undefined = undefined
    if (colCapacity >= 0) {
      const rawCap = row[colCapacity]
      const capResult = normalizeNumber(rawCap, PERSON_FIELD_MAPPING.monthlyCapacityHours.canonicalField, i)
      monthlyCapacityHours = capResult.valid ? (capResult.value as number) : null
    } else {
      monthlyCapacityHours = null
    }

    let hourlyCost: number | null | undefined = undefined
    if (colHourlyCost >= 0) {
      const rawCost = row[colHourlyCost]
      const costResult = normalizeNumber(rawCost, PERSON_FIELD_MAPPING.hourlyCost.canonicalField, i)
      hourlyCost = costResult.valid ? (costResult.value as number) : null
    } else {
      hourlyCost = null
    }

    records.push({
      employeeKey,
      employeeName: empName || undefined,
      department: dept || undefined,
      active: true,
      monthlyCapacityHours,
      hourlyCost,
    })
  }

  return { records, issues, skippedRows }
}
