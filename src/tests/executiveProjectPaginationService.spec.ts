import { describe, expect, it } from 'vitest'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { ProjectContentResult, ProjectItem } from '@/types/project'
import { buildExecutiveProjectSlides } from '@/services/executiveProjectPaginationService'

function makeAnalysis(groups: Array<{ itemNo: string; quarterHours?: number }>): ReportAnalysisResult {
  const projectGroups = groups.map((group) => ({
    mainItemNo: group.itemNo,
    mainProject: {
      itemNo: group.itemNo,
      itemType: 'main' as const,
      projectKey: group.itemNo,
      projectName: `專案 ${group.itemNo}`,
      cumulativeHours: group.quarterHours ?? 100,
      quarterHours: group.quarterHours ?? 50,
      cumulativePeopleCount: 2,
      quarterPeopleCount: 1,
      revenue: 120000,
    },
    children: [],
    cumulativeHours: group.quarterHours ?? 100,
    quarterHours: group.quarterHours ?? 50,
    cumulativePeopleCount: 2,
    quarterPeopleCount: 1,
    revenue: 120000,
  }))

  return {
    quarter: 'S2',
    dateRanges: {
      cumulative: { start: '2025-12-01', end: '2026-07-31' },
      quarter: { start: '2026-04-01', end: '2026-07-31' },
    },
    cumulative: {
      workHours: { totalHours: 31533.5, projectHours: 1, maintenanceHours: 1, otherHours: 1, projectRatio: 0, maintenanceRatio: 0, otherRatio: 0, recordCount: 1 },
      workforce: { activePeopleCount: 1, totalHours: 1, averageHoursPerPerson: 1, projectPeopleCount: 1, maintenancePeopleCount: 0, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    quarterSummary: {
      workHours: { totalHours: 14579.5, projectHours: 1, maintenanceHours: 1, otherHours: 1, projectRatio: 0, maintenanceRatio: 0, otherRatio: 0, recordCount: 1 },
      workforce: { activePeopleCount: 1, totalHours: 1, averageHoursPerPerson: 1, projectPeopleCount: 1, maintenancePeopleCount: 0, otherPeopleCount: 0, people: [], personMonthsStatus: 'not-configured', personMonths: null },
    },
    projectGroups,
    cumulativeProjectRanking: projectGroups,
    quarterProjectRanking: projectGroups,
    revenue: { configured: true, cumulativeRevenue: 120000, quarterRevenue: 30000, revenuePerHour: null, inputOutputRatio: null, issues: [] },
    presentationAnalysis: {
      moduleWorkHoursCharts: [],
      moduleWorkforce: [],
      monthlyWorkTypes: [],
      workforceConfigured: false,
      monthlyRatioBasis: 'unconfirmed',
      monthlyPeriod: { start: '2025-12-01', end: '2026-07-31' },
      issues: [],
    },
    dataQuality: { invalidDateRows: 0, invalidHourRows: 0, unmatchedPeopleRows: 0, unmatchedProjectRows: 0, unmatchedMaintenanceRows: 0, unclassifiedRows: 0, unclassifiedHours: 0, projectMappingAvailable: false, projectMappingBlocked: false, unmappedProjectHours: 0, unmappedProjectRecords: 0 },
    issues: [],
    metadata: { calculatedAt: '2026-07-23T00:00:00.000Z', sourceRowCounts: {} },
  }
}

function item(itemNo: string, data: Record<string, unknown>, imageRefs: ProjectItem['imageRefs'] = []): ProjectItem {
  const isChild = itemNo.includes('-')
  return {
    rowIndex: 0,
    rawItemNo: itemNo,
    normalizedItemNo: itemNo,
    itemType: isChild ? 'child' : 'main',
    parentItemNo: isChild ? itemNo.split('-')[0] : undefined,
    data,
    imageRefs,
  }
}

function content(items: ProjectItem[]): ProjectContentResult {
  return {
    sheetFound: true,
    alternativeSheetFound: false,
    totalRows: items.length,
    mainCount: items.filter((i) => i.itemType === 'main').length,
    childCount: items.filter((i) => i.itemType === 'child').length,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items,
    detectedHeaders: [],
    issues: [],
  }
}

describe('executiveProjectPaginationService', () => {
  it('短內容項目只產生 1 頁，摘要、完成與預計同頁', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', {
        '已完成工作事項_描述': '已完成 A',
        '預計完成工作_描述': '預計 B',
      })])
    )

    expect(result.totalProjectSlides).toBeGreaterThanOrEqual(1)
    expect(result.slides[0]?.slideType).toBe('project-overview')
    expect(result.slides.flatMap((s) => s.sections).map((s) => s.title)).toEqual(['已完成工作事項', '預計完成工作'])
    expect(result.audit.lostContentCount).toBe(0)
  })

  it('收入說明與單張收入圖片合併於 overview', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', {
        '專案收入_描述': '年度收入補充',
      }, [{ column: '專案收入_圖片展示', filenames: ['income.png'] }])])
    )

    expect(result.totalProjectSlides).toBe(1)
    expect(result.slides[0]?.overview?.annualRevenue).toBe(120000)
    expect(result.slides[0]?.sections[0]?.title).toBe('專案收入')
    expect(result.slides[0]?.images.map((img) => img.filename)).toEqual(['income.png'])
  })

  it('短 URL 不建立獨立頁且 hyperlink audit 保留', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', {
        'UIX執行成果_文字/連結描述': 'Figma https://example.com/figma',
      })])
    )

    expect(result.totalProjectSlides).toBe(1)
    expect(result.slides[0]?.links).toHaveLength(1)
    expect(result.audit.inputLinkCount).toBe(1)
    expect(result.audit.outputLinkCount).toBe(1)
  })

  it('單張 UIX 與執行成果圖片可合併於 overview', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', {
        '已完成工作事項_描述': '短內容',
      }, [
        { column: 'UIX執行成果_圖片展示', filenames: ['uix.png'] },
        { column: '執行成果_圖片展示', filenames: ['result.png'] },
      ])])
    )

    expect(result.totalProjectSlides).toBe(1)
    expect(result.slides[0]?.images).toHaveLength(2)
  })

  it('兩張 EIP UIX 圖同頁，不拆成兩頁', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '16' }]),
      content([item('16', { 'UIX執行成果_文字/連結描述': 'EIP UIX' }, [{
        column: 'UIX執行成果_圖片展示',
        filenames: ['EIP_提前延後打卡設計圖.jpg', 'EIP_出差申請設計圖.jpg'],
      }])])
    )

    expect(result.totalProjectSlides).toBe(1)
    expect(result.slides[0]?.images.map((img) => img.filename)).toEqual([
      'EIP_提前延後打卡設計圖.jpg',
      'EIP_出差申請設計圖.jpg',
    ])
  })

  it('3～4 張圖片使用 gallery 並保留所有圖片', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', { '已完成工作事項_描述': '短內容' }, [{
        column: '執行成果_圖片展示',
        filenames: ['a.png', 'b.png', 'c.png', 'd.png'],
      }])])
    )

    expect(result.totalProjectSlides).toBe(2)
    expect(result.slides[1]?.slideType).toBe('project-gallery')
    expect(result.audit.inputImageCount).toBe(4)
    expect(result.audit.outputImageCount).toBe(4)
  })

  it('子項短內容與父項同頁，子項長內容只增加父項 detail', () => {
    const shortChild = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '3' }]),
      content([
        item('3', { '已完成工作事項_描述': '父項' }),
        item('3-1', { '已完成工作事項_描述': '子項短內容' }),
      ])
    )
    expect(shortChild.totalProjectSlides).toBeGreaterThanOrEqual(1)
    expect(shortChild.slides.flatMap((s) => s.sections).some((s) => s.title.includes('子項 3-1'))).toBe(true)

    const longText = '子項內容\n'.repeat(120)
    const longChild = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '3' }]),
      content([
        item('3', { '已完成工作事項_描述': '父項' }),
        item('3-1', { '已完成工作事項_描述': longText }),
      ])
    )
    expect(longChild.totalProjectSlides).toBeGreaterThan(1)
    expect(longChild.slides.every((slide) => slide.itemNo === '3')).toBe(true)
  })

  it('0 工時與未匹配項目原則 1 頁且狀態不同', () => {
    const zero = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '9', quarterHours: 0 }]),
      content([item('9', { '已完成工作事項_描述': '0 工時仍呈現' })])
    )
    expect(zero.totalProjectSlides).toBe(1)
    expect(zero.slides[0]?.overview?.workStatus).toBe('zero-hours')

    const unmatchedAnalysis = makeAnalysis([{ itemNo: '23', quarterHours: 0 }])
    unmatchedAnalysis.presentationScope = {
      items: [],
      mainItems: [{
        itemNo: '23',
        itemType: 'main',
        stableItemId: '202607001',
        projectName: '未匹配',
        sourceType: 'unresolved',
        sourceRow: 1,
        content: item('23', {}),
        matchStatus: 'unmatched',
      }],
      childItems: [],
      orderedMainItemIds: ['23'],
      allowedStableItemIds: new Set(['202607001']),
      issues: [],
    }
    const unmatched = buildExecutiveProjectSlides(
      unmatchedAnalysis,
      content([item('23', { '已完成工作事項_描述': '未匹配仍呈現' })])
    )
    expect(unmatched.totalProjectSlides).toBe(1)
    expect(unmatched.slides[0]?.overview?.workStatus).toBe('unmatched')
  })

  it('所有文字與圖片 audit 均不遺失', () => {
    const result = buildExecutiveProjectSlides(
      makeAnalysis([{ itemNo: '1' }]),
      content([item('1', {
        '已完成工作事項_描述': '完成',
        '預計完成工作_描述': '預計',
        'UIX執行成果_文字/連結描述': 'https://example.com',
      }, [{ column: '執行成果_圖片展示', filenames: ['a.png', 'b.png'] }])])
    )

    expect(result.audit.inputSectionCount).toBe(result.audit.outputSectionCount)
    expect(result.audit.inputImageCount).toBe(result.audit.outputImageCount)
    expect(result.audit.inputLinkCount).toBe(result.audit.outputLinkCount)
    expect(result.audit.lostContentCount).toBe(0)
  })
})
