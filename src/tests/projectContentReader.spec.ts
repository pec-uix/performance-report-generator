import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import { readProjectContent } from '@/services/projectContentReader'
import { parseSheet } from '@/services/excelReader'
import type { ProjectContentReaderContext } from '@/services/projectContentReader'

function makeWorkbook(rows: unknown[][], sheetName = '專案內容'): XLSX.WorkBook {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), sheetName)
  return wb
}

const BASIC_ROWS = [
  ['', '已完成工作事項', ''],
  ['項次', '描述', '圖片展示'],
  ['1', '完成內容', '完成圖.PNG'],
]

function makeContext(
  projectRows: unknown[][] = [
    ['id', '模組編號', '任務名稱', 'PM', '收入', '年度收入', '虛擬收入', '起始日', '結束日', '經理核定', '狀態', '任務屬性', '任務狀態', '預計工時', '實際工時', '參與人數', '模組設定人數', '模組預計工時合計', '模組'],
    ['555', '20220506', '團購網&UNI團購網系統優化', '謝佳螢', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '20220506(團購網&UNI團購網系統優化)'],
  ],
  maintenanceRows: unknown[][] = [
    ['id', '編號(模組維護)', '維運項目', 'ＰＭ'],
    ['15988', '202304119', 'UNI團購網系統維運', '謝佳螢'],
  ],
  workModules = [
    '20220506(團購網&UNI團購網系統優化)',
    '202304119(UNI團購網系統維運)',
  ]
): ProjectContentReaderContext {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(projectRows), '專案清單')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(maintenanceRows), '維運清單')
  return {
    projectMasterSheet: parseSheet(wb, '專案清單'),
    maintenanceSheet: parseSheet(wb, '維運清單'),
    workModuleKeys: new Set(workModules),
  }
}

function makeLegacyWorkbook(rows: unknown[][]): XLSX.WorkBook {
  return makeWorkbook([
    ['專案名稱', 'PM', '段落標題', '內容（條列項目）\nAlt+Enter 換行', '圖片檔名', '圖表工作表'],
    ['必填', '同專案只填第一行', '可空白', '自動填入財務數據，可再補充文字', '填檔名如 img.png', '可空白'],
    ...rows,
  ], '投影片內容')
}

describe('projectContentReader', () => {
  it('解析四大成果區 exact key 與圖片欄位', () => {
    const wb = makeWorkbook([
      [
        '',
        '已完成工作事項',
        '',
        '預計完成工作',
        '',
        'UIX執行成果',
        '',
        '執行成果',
        '',
      ],
      [
        '項次',
        '描述',
        '圖片展示',
        '描述',
        '圖片展示',
        '文字/連結描述',
        '圖片展示',
        '文字/連結描述',
        '圖片展示',
      ],
      [
        '1',
        '完成內容',
        ' 完成圖.PNG, 子目錄/第二張.jpg ,, ',
        '預計內容',
        '計畫圖.jpeg',
        'UIX 內容 https://example.com/demo',
        '介面圖.png',
        '一般成果',
        '成果圖.png',
      ],
    ])

    const result = readProjectContent(wb)
    const item = result.items[0]

    expect(result.detectedHeaders).toEqual([
      '項次',
      '已完成工作事項_描述',
      '已完成工作事項_圖片展示',
      '預計完成工作_描述',
      '預計完成工作_圖片展示',
      'UIX執行成果_文字/連結描述',
      'UIX執行成果_圖片展示',
      '執行成果_文字/連結描述',
      '執行成果_圖片展示',
    ])
    expect(item?.data['已完成工作事項_描述']).toBe('完成內容')
    expect(item?.data['預計完成工作_描述']).toBe('預計內容')
    expect(item?.data['UIX執行成果_文字/連結描述']).toContain('https://example.com/demo')
    expect(item?.data['執行成果_文字/連結描述']).toBe('一般成果')
    expect(item?.imageRefs.find((r) => r.column === '已完成工作事項_圖片展示')?.filenames)
      .toEqual(['完成圖.PNG', '子目錄/第二張.jpg'])
    expect(item?.imageRefs.find((r) => r.column === '預計完成工作_圖片展示')?.filenames)
      .toEqual(['計畫圖.jpeg'])
    expect(item?.imageRefs.find((r) => r.column === 'UIX執行成果_圖片展示')?.filenames)
      .toEqual(['介面圖.png'])
    expect(item?.imageRefs.find((r) => r.column === '執行成果_圖片展示')?.filenames)
      .toEqual(['成果圖.png'])
  })

  it('「投影片內容」可作為專案內容工作表', () => {
    const wb = makeWorkbook(BASIC_ROWS, '投影片內容')
    const result = readProjectContent(wb)
    expect(result.sheetFound).toBe(true)
    expect(result.items).toHaveLength(1)
    expect(result.issues.some((issue) => issue.code === 'PROJECT_CONTENT_SHEET_ALIAS_USED')).toBe(true)
  })

  it('「專案內容」優先於「投影片內容」', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(BASIC_ROWS), '投影片內容')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['', '已完成工作事項'],
        ['項次', '描述'],
        ['9', '主要工作表內容'],
      ]),
      '專案內容'
    )

    const result = readProjectContent(wb)
    expect(result.items[0]?.normalizedItemNo).toBe('9')
    expect(result.items[0]?.data['已完成工作事項_描述']).toBe('主要工作表內容')
  })

  it('同時存在多個 alias 時產生 Warning', () => {
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(BASIC_ROWS), '專案內容第一期')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(BASIC_ROWS), '投影片內容')

    const result = readProjectContent(wb)
    expect(result.issues.some((issue) => issue.code === 'PROJECT_CONTENT_MULTIPLE_SHEETS_FOUND')).toBe(true)
  })

  it('不使用模糊 sheet name', () => {
    const wb = makeWorkbook(BASIC_ROWS, '投影片內容草稿')
    const result = readProjectContent(wb)
    expect(result.sheetFound).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'PC_MISSING_SHEET')).toBe(true)
  })

  it('投影片內容缺項次時進入 legacy mode 並 exact match 專案清單.任務名稱', () => {
    const result = readProjectContent(
      makeLegacyWorkbook([
        ['團購網&UNI團購網系統優化', '謝佳螢', '專案工時分析', '第一行\n第二行', '', ''],
      ]),
      makeContext()
    )

    expect(result.legacyMode).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'LEGACY_CONTENT_MODE_USED')).toBe(true)
    expect(result.issues.some((issue) => issue.code === 'PI_INVALID_ITEM_NO')).toBe(false)
    expect(result.items).toHaveLength(1)
    expect(result.items[0]?.normalizedItemNo).toBe('20220506')
    expect(result.items[0]?.stableItemId).toBe('20220506')
    expect(result.items[0]?.sourceType).toBe('project')
    expect(result.items[0]?.moduleKey).toBe('20220506(團購網&UNI團購網系統優化)')
    expect(result.items[0]?.displayName).toBe('團購網&UNI團購網系統優化')
    expect(result.items[0]?.itemType).toBe('main')
    expect(result.items[0]?.parentItemNo).toBeUndefined()
    expect(result.items[0]?.sourceRow).toBe(3)
    expect(result.items[0]?.legacyContent?.content).toBe('第一行\n第二行')
    expect(result.items[0]?.legacySectionTitle).toBe('專案工時分析')
    expect(result.items[0]?.imageRefs).toHaveLength(0)
  })

  it('legacy mode exact match 維運清單.維運項目並保留 sourceType = maintenance', () => {
    const result = readProjectContent(
      makeLegacyWorkbook([
        ['UNI團購網系統維運', '謝佳螢', '維運工時分析', '維運內容', '維運.png', ''],
      ]),
      makeContext()
    )

    expect(result.items[0]?.normalizedItemNo).toBe('202304119')
    expect(result.items[0]?.stableItemId).toBe('202304119')
    expect(result.items[0]?.sourceType).toBe('maintenance')
    expect(result.items[0]?.moduleKey).toBe('202304119(UNI團購網系統維運)')
    expect(result.items[0]?.imageRefs[0]?.filenames).toEqual(['維運.png'])
  })

  it('legacy mode 0 筆 match 時 error 且不使用 includes', () => {
    const result = readProjectContent(
      makeLegacyWorkbook([
        ['UNI', '謝佳螢', '專案工時分析', '不能用片段命中', '', ''],
      ]),
      makeContext()
    )

    expect(result.items).toHaveLength(0)
    expect(result.issues.some((issue) => issue.code === 'LEGACY_CONTENT_PROJECT_MATCH_NOT_FOUND')).toBe(true)
  })

  it('legacy mode 多筆 exact match 時 error 且不得任選', () => {
    const result = readProjectContent(
      makeLegacyWorkbook([
        ['重複名稱', 'PM', '專案工時分析', '內容', '', ''],
      ]),
      makeContext(
        [
          ['id', '模組編號', '任務名稱', '模組'],
          ['1', '20220001', '重複名稱', '20220001(重複名稱)'],
          ['2', '20220002', '重複名稱', '20220002(重複名稱)'],
        ],
        [
          ['id', '編號(模組維護)', '維運項目', 'ＰＭ'],
        ],
        ['20220001(重複名稱)', '20220002(重複名稱)']
      )
    )

    expect(result.items).toHaveLength(0)
    expect(result.issues.some((issue) => issue.code === 'LEGACY_CONTENT_PROJECT_MATCH_AMBIGUOUS')).toBe(true)
  })

  it('legacy mode stableItemId 或 moduleKey 缺失時 error，且不使用 row number 補值', () => {
    const missingId = readProjectContent(
      makeLegacyWorkbook([
        ['缺 ID', 'PM', '專案工時分析', '內容', '', ''],
      ]),
      makeContext([
        ['id', '模組編號', '任務名稱', '模組'],
        ['1', '', '缺 ID', '20220001(缺 ID)'],
      ])
    )
    expect(missingId.items).toHaveLength(0)
    expect(missingId.issues.some((issue) => issue.code === 'LEGACY_CONTENT_STABLE_ID_MISSING')).toBe(true)

    const missingModule = readProjectContent(
      makeLegacyWorkbook([
        ['缺模組', 'PM', '專案工時分析', '內容', '', ''],
      ]),
      makeContext([
        ['id', '模組編號', '任務名稱', '模組'],
        ['1', '20220001', '缺模組', ''],
      ])
    )
    expect(missingModule.items).toHaveLength(0)
    expect(missingModule.issues.some((issue) => issue.code === 'LEGACY_CONTENT_MODULE_MISSING')).toBe(true)
  })

  it('legacy mode moduleKey 未命中工時記錄時 warning，但內容保留', () => {
    const result = readProjectContent(
      makeLegacyWorkbook([
        ['團購網&UNI團購網系統優化', '謝佳螢', '專案工時分析', '內容', '', ''],
      ]),
      makeContext(undefined, undefined, [])
    )

    expect(result.items).toHaveLength(1)
    expect(result.issues.some((issue) => issue.code === 'LEGACY_CONTENT_WORK_HOURS_UNMATCHED')).toBe(true)
  })

  it('41 筆等價 legacy fixture 不再產生 PI_INVALID_ITEM_NO', () => {
    const projectRows = [['id', '模組編號', '任務名稱', '模組']]
    const maintenanceRows = [['id', '編號(模組維護)', '維運項目', 'ＰＭ']]
    const workModules: string[] = []
    const contentRows: unknown[][] = []

    for (let i = 1; i <= 14; i++) {
      const code = `20220${String(i).padStart(3, '0')}`
      const name = `專案${i}`
      const module = `${code}(${name})`
      projectRows.push([String(i), code, name, module])
      workModules.push(module)
      contentRows.push([name, 'PM', '專案工時分析', `內容${i}`, '', ''])
    }
    for (let i = 1; i <= 27; i++) {
      const code = `20230${String(i).padStart(3, '0')}`
      const name = `維運${i}`
      const module = `${code}(${name})`
      maintenanceRows.push([String(i), code, name, 'PM'])
      workModules.push(module)
      contentRows.push([name, 'PM', '維運工時分析', `內容${i}`, '', ''])
    }

    const result = readProjectContent(
      makeLegacyWorkbook(contentRows),
      makeContext(projectRows, maintenanceRows, workModules)
    )

    expect(result.totalRows).toBe(41)
    expect(result.items).toHaveLength(41)
    expect(result.mainCount).toBe(41)
    expect(result.childCount).toBe(0)
    expect(result.issues.some((issue) => issue.code === 'PI_INVALID_ITEM_NO')).toBe(false)
  })
})
