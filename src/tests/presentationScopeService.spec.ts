import { describe, expect, it } from 'vitest'
import type { NormalizedWorkRecord, ProjectMasterRecord } from '@/types/analysis'
import type { ProjectContentResult, ProjectItem } from '@/types/project'
import {
  buildPresentationScope,
  buildPresentationScopeModuleToItemNo,
} from '@/services/presentationScopeService'

function makeItem(
  itemNo: string,
  projectName: string,
  partial: Partial<ProjectItem> = {}
): ProjectItem {
  const itemType = itemNo.includes('-') ? 'child' : 'main'
  return {
    rowIndex: Number(itemNo.split('-')[0]) || 0,
    sourceRow: partial.sourceRow ?? 3,
    rawItemNo: itemNo,
    normalizedItemNo: itemNo,
    itemType,
    parentItemNo: itemType === 'child' ? itemNo.split('-')[0] : undefined,
    data: {
      專案名稱: projectName,
      ...(partial.data ?? {}),
    },
    imageRefs: partial.imageRefs ?? [],
    ...partial,
  }
}

function makeProjectContent(items: ProjectItem[]): ProjectContentResult {
  return {
    sheetFound: true,
    alternativeSheetFound: false,
    legacyMode: false,
    totalRows: items.length,
    mainCount: items.filter((item) => item.itemType === 'main').length,
    childCount: items.filter((item) => item.itemType === 'child').length,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items,
    detectedHeaders: ['項次', '專案名稱'],
    issues: [],
  }
}

function workRecord(moduleKey: string, hours = 1): NormalizedWorkRecord {
  return {
    sourceRow: 2,
    workDate: '2026-04-01',
    employeeKey: 'E001',
    moduleKey,
    moduleName: moduleKey,
    workCategory: 'project',
    projectKey: moduleKey,
    hours,
  }
}

describe('presentationScopeService', () => {
  it('依 S2 專案內容建立 24 個主項與 3 個子項的白名單', () => {
    const items = [
      makeItem('1', '202600001(主項1)'),
      makeItem('1-1', '202600101(子項1)'),
      makeItem('2', '202600002(主項2)'),
      makeItem('3', '202600003(主項3)'),
      makeItem('3-1', '202600301(子項3-1)'),
      makeItem('3-2', '202600302(子項3-2)'),
      ...Array.from({ length: 21 }, (_, i) => makeItem(String(i + 4), `202600${String(i + 4).padStart(3, '0')}(主項${i + 4})`)),
    ]
    const projectMasters: ProjectMasterRecord[] = items.map((item) => ({
      projectKey: String(item.data.專案名稱),
      projectModuleKey: String(item.data.專案名稱),
      projectName: String(item.data.專案名稱),
    }))
    const scope = buildPresentationScope({
      projectContent: makeProjectContent(items),
      projectMasters,
      maintenanceMasters: [],
      workRecords: projectMasters.map((record) => workRecord(record.projectModuleKey as string)),
    })

    expect(scope.items).toHaveLength(27)
    expect(scope.mainItems).toHaveLength(24)
    expect(scope.childItems).toHaveLength(3)
    expect(scope.orderedMainItemIds.slice(0, 3)).toEqual(['1', '2', '3'])
    expect(scope.childItems.map((item) => item.parentItemNo)).toEqual(['1', '3', '3'])
  })

  it('完整名稱 exact match 專案清單與維運清單，並保留 sourceType 與 stableItemId', () => {
    const content = makeProjectContent([
      makeItem('1', '202601001(專案A)'),
      makeItem('2', 'M001(維運A)'),
    ])
    const scope = buildPresentationScope({
      projectContent: content,
      projectMasters: [{
        projectKey: '202601001(專案A)',
        projectModuleKey: '202601001(專案A)',
        projectName: '專案A',
      }],
      maintenanceMasters: [{
        maintenanceKey: 'M001(維運A)',
        maintenanceModuleKey: 'M001(維運A)',
        maintenanceName: '維運A',
      }],
      workRecords: [workRecord('202601001(專案A)'), {
        ...workRecord('M001(維運A)'),
        workCategory: 'maintenance',
        projectKey: undefined,
        maintenanceKey: 'M001(維運A)',
      }],
    })

    expect(scope.items[0]).toMatchObject({
      sourceType: 'project',
      stableItemId: '202601001',
      moduleKey: '202601001(專案A)',
      matchStatus: 'exact',
    })
    expect(scope.items[1]).toMatchObject({
      sourceType: 'maintenance',
      stableItemId: 'M001',
      moduleKey: 'M001(維運A)',
      matchStatus: 'exact',
    })
  })

  it('只允許 ASCII 大小寫正規化 exact match，並產生 warning', () => {
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('4', '202601020(統一生機EC專案(EC Team))')]),
      projectMasters: [{
        projectKey: '202601020(統一生機EC專案(EC team))',
        projectModuleKey: '202601020(統一生機EC專案(EC team))',
        projectName: '統一生機EC專案',
      }],
      maintenanceMasters: [],
      workRecords: [workRecord('202601020(統一生機EC專案(EC team))')],
    })

    expect(scope.items[0]?.matchStatus).toBe('case-normalized')
    expect(scope.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_CASE_NORMALIZED_MATCH')).toBe(true)
  })

  it('名稱未 exact 命中時使用嚴格 project code fallback，不使用刪除專案文字規則', () => {
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('20', '202606001(AI視覺風險管理平台)')]),
      projectMasters: [{
        projectKey: '202606001(AI視覺風險管理平台專案)',
        projectModuleKey: '202606001(AI視覺風險管理平台專案)',
        projectName: 'AI視覺風險管理平台專案',
      }],
      maintenanceMasters: [],
      workRecords: [workRecord('202606001(AI視覺風險管理平台專案)')],
    })

    expect(scope.items[0]).toMatchObject({
      matchStatus: 'code-fallback',
      stableItemId: '202606001',
      moduleKey: '202606001(AI視覺風險管理平台專案)',
    })
    expect(scope.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_CODE_FALLBACK_MATCH')).toBe(true)
  })

  it('主檔 moduleKey 為空時，只在工時明細 project code 唯一命中時補入 moduleKey', () => {
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('21', '202605003(統正wifi APP打卡專案(行動前端開發課))')]),
      projectMasters: [{
        projectKey: '202605003',
        projectName: '統正wifi APP打卡專案(行動前端開發課)',
      }],
      maintenanceMasters: [],
      workRecords: [workRecord('202605003(統正wifi APP打卡專案(行動前端開發課))')],
    })

    expect(scope.items[0]).toMatchObject({
      matchStatus: 'code-fallback',
      stableItemId: '202605003',
      moduleKey: '202605003(統正wifi APP打卡專案(行動前端開發課))',
    })
  })

  it('moduleKey 0 筆或多筆命中時不猜測也不任選', () => {
    const noModule = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('21', '202605003(統正wifi APP打卡專案(行動前端開發課))')]),
      projectMasters: [{ projectKey: '202605003', projectName: '統正wifi APP打卡專案(行動前端開發課)' }],
      maintenanceMasters: [],
      workRecords: [],
    })
    expect(noModule.items[0]?.moduleKey).toBeUndefined()
    expect(noModule.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_MODULE_MISSING')).toBe(true)

    const multiModule = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('22', '202605002(統正wifi APP打卡專案(行動後端開發課))')]),
      projectMasters: [{ projectKey: '202605002', projectName: '統正wifi APP打卡專案(行動後端開發課)' }],
      maintenanceMasters: [],
      workRecords: [
        workRecord('202605002(統正wifi APP打卡專案(行動後端開發課))'),
        workRecord('202605002(另一個模組)'),
      ],
    })
    expect(multiModule.items[0]?.moduleKey).toBeUndefined()
    expect(multiModule.issues.some((issue) =>
      issue.code === 'PRESENTATION_SCOPE_MODULE_MISSING' && issue.severity === 'error'
    )).toBe(true)
  })

  it('主檔找不到時保留內容頁並標示 unmatched，不偽造成 0 工時', () => {
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('23', '202607001(統一企業特約廠商專案)')]),
      projectMasters: [],
      maintenanceMasters: [],
      workRecords: [],
    })

    expect(scope.items[0]).toMatchObject({
      stableItemId: '202607001',
      sourceType: 'unresolved',
      matchStatus: 'unmatched',
      moduleKey: undefined,
    })
    expect(scope.issues.some((issue) => issue.code === 'PRESENTATION_SCOPE_UNMATCHED_ITEM')).toBe(true)
  })

  it('moduleToItemNo 只包含白名單項目，不會把白名單外工時加回成果頁', () => {
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('1', '202601001(專案A)')]),
      projectMasters: [{
        projectKey: '202601001(專案A)',
        projectModuleKey: '202601001(專案A)',
        projectName: '專案A',
      }, {
        projectKey: '202601002(白名單外)',
        projectModuleKey: '202601002(白名單外)',
        projectName: '白名單外',
      }],
      maintenanceMasters: [],
      workRecords: [workRecord('202601001(專案A)'), workRecord('202601002(白名單外)')],
    })
    const mapping = buildPresentationScopeModuleToItemNo(scope)

    expect(mapping.get('202601001(專案A)')).toBe('1')
    expect(mapping.has('202601002(白名單外)')).toBe(false)
  })

  it('子項內容與圖片保留在白名單 content 中，不建立獨立 main', () => {
    const child = makeItem('3-1', '202601037(統流官網專案)', {
      data: { 專案名稱: '202601037(統流官網專案)', 已完成工作事項_描述: '子項完成事項' },
      imageRefs: [{ column: 'UIX執行成果_圖片展示', filenames: ['統流官網.png'] }],
    })
    const scope = buildPresentationScope({
      projectContent: makeProjectContent([makeItem('3', '202601030(統流主項)'), child]),
      projectMasters: [
        { projectKey: '202601030(統流主項)', projectModuleKey: '202601030(統流主項)', projectName: '統流主項' },
        { projectKey: '202601037(統流官網專案)', projectModuleKey: '202601037(統流官網專案)', projectName: '統流官網專案' },
      ],
      maintenanceMasters: [],
      workRecords: [workRecord('202601030(統流主項)'), workRecord('202601037(統流官網專案)')],
    })

    expect(scope.mainItems.map((item) => item.itemNo)).toEqual(['3'])
    expect(scope.childItems.map((item) => item.itemNo)).toEqual(['3-1'])
    expect(scope.childItems[0]?.content.data.已完成工作事項_描述).toBe('子項完成事項')
    expect(scope.childItems[0]?.content.imageRefs[0]?.filenames).toEqual(['統流官網.png'])
  })
})
