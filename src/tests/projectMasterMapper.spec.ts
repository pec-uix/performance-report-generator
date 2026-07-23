/**
 * projectMasterMapper.spec.ts
 * 測試專案主檔映射、模組鍵集合，以及維運組合鍵建立。
 */

import { describe, it, expect } from 'vitest'
import { mapProjectMasterRecords, buildProjectModuleKeySet } from '@/services/projectMasterMapper'
import { mapMaintenanceRecords, buildMaintenanceModuleKeySet } from '@/services/maintenanceMapper'
import type { ParsedWorkbookSheet } from '@/types/excel'

function makeSheet(headers: string[], rows: unknown[][]): ParsedWorkbookSheet {
  return {
    originalName: '測試工作表',
    normalizedName: '測試工作表',
    headers,
    rowCount: rows.length,
    rows,
  }
}

// ─── 專案清單映射 ─────────────────────────────────────────────────────────────

describe('mapProjectMasterRecords', () => {
  it('[New-8] 任務名稱欄正確帶入 projectName', () => {
    const sheet = makeSheet(
      ['模組編號', '任務名稱', '模組'],
      [['20220506', '測試任務一', '20220506(測試任務一)']]
    )
    const result = mapProjectMasterRecords(sheet)
    expect(result.records).toHaveLength(1)
    const rec = result.records[0]
    expect(rec.projectName).toBe('測試任務一')
    expect(rec.projectModuleKey).toBe('20220506(測試任務一)')
    // projectKey 應優先使用 projectModuleKey
    expect(rec.projectKey).toBe('20220506(測試任務一)')
  })

  it('模組欄為主鍵；模組編號作為備用', () => {
    const sheet = makeSheet(
      ['模組編號', '任務名稱'],
      [['20220506', '備用測試']]
    )
    const result = mapProjectMasterRecords(sheet)
    expect(result.records).toHaveLength(1)
    // 無「模組」欄 → projectModuleKey 為空 → 使用 projectCode（模組編號）
    expect(result.records[0].projectKey).toBe('20220506')
    expect(result.records[0].projectModuleKey).toBeUndefined()
  })

  it('buildProjectModuleKeySet 只包含有 projectModuleKey 的記錄', () => {
    const sheet = makeSheet(
      ['模組'],
      [['20220506(專案A)'], ['20220507(專案B)'], ['']]
    )
    const result = mapProjectMasterRecords(sheet)
    const keySet = buildProjectModuleKeySet(result.records)
    expect(keySet.has('20220506(專案A)')).toBe(true)
    expect(keySet.has('20220507(專案B)')).toBe(true)
    expect(keySet.size).toBe(2)
  })

  it('三欄均空白時略過並計入 skippedRows', () => {
    const sheet = makeSheet(
      ['模組編號', '任務名稱', '模組'],
      [['', '', ''], ['20220506', '正常', '20220506(正常)']]
    )
    const result = mapProjectMasterRecords(sheet)
    expect(result.records).toHaveLength(1)
    expect(result.skippedRows).toBe(1)
  })

  it('保留 PM、專案成員、收入與年度收入，年度收入 0 不視為空白', () => {
    const sheet = makeSheet(
      ['模組編號', '任務名稱', '模組', 'PM', '專案成員', '收入', '年度收入'],
      [
        ['20220506', 'UNI', '20220506(UNI)', '謝佳螢 / 謝政健', '政健、秉育、瑞齊', '1544000', '1044000'],
        ['202304119', '維運', '202304119(維運)', 'PM2', '成員A／成員B', '0', '0'],
      ]
    )
    const result = mapProjectMasterRecords(sheet)
    expect(result.records[0]).toMatchObject({
      pm: '謝佳螢 / 謝政健',
      members: ['政健', '秉育', '瑞齊'],
      projectRevenue: 1544000,
      annualRevenue: 1044000,
    })
    expect(result.records[1]).toMatchObject({
      members: ['成員A', '成員B'],
      projectRevenue: 0,
      annualRevenue: 0,
    })
  })
})

// ─── 維運清單映射（[New-5]：維運鍵由 CODE(NAME) 組合） ───────────────────────

describe('mapMaintenanceRecords + buildMaintenanceModuleKeySet', () => {
  it('[New-5] 維運鍵由 trim(編號(模組維護)) + trim(維運項目) 組合', () => {
    const sheet = makeSheet(
      ['編號(模組維護)', '維運項目'],
      [
        ['20220512', 'Nrm新零售導入及優化'],
        [' 20220513 ', ' 財務系統維護 '],
      ]
    )
    const result = mapMaintenanceRecords(sheet)
    expect(result.records).toHaveLength(2)
    expect(result.records[0].maintenanceModuleKey).toBe('20220512(Nrm新零售導入及優化)')
    // 帶有前後空格的值應被 trim
    expect(result.records[1].maintenanceModuleKey).toBe('20220513(財務系統維護)')
  })

  it('buildMaintenanceModuleKeySet 回傳正確集合', () => {
    const sheet = makeSheet(
      ['編號(模組維護)', '維運項目'],
      [['20220512', 'Nrm新零售導入及優化']]
    )
    const result = mapMaintenanceRecords(sheet)
    const keySet = buildMaintenanceModuleKeySet(result.records)
    expect(keySet.has('20220512(Nrm新零售導入及優化)')).toBe(true)
    expect(keySet.size).toBe(1)
  })

  it('僅有代碼無名稱時 maintenanceModuleKey 為空，以代碼作為 maintenanceKey', () => {
    const sheet = makeSheet(
      ['編號(模組維護)', '維運項目'],
      [['20220512', '']]
    )
    const result = mapMaintenanceRecords(sheet)
    expect(result.records[0].maintenanceModuleKey).toBeUndefined()
    expect(result.records[0].maintenanceKey).toBe('20220512')
  })
})
