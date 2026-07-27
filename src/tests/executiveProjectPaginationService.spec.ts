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
    frontendPeopleCount: 5,
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
    const contentItem = item('1', {
      '專案收入_描述': '年度收入補充',
      '專案收入_年度收入': 120000,
    }, [{ column: '專案收入_圖片展示', filenames: ['income.png'] }])
    const analysis = makeAnalysis([{ itemNo: '1' }])
    analysis.presentationScope = {
      items: [{
        itemNo: '1',
        itemType: 'main',
        stableItemId: '20220000',
        projectCode: '20220000',
        projectName: '20220000(測試専案)',
        sourceType: 'project',
        moduleKey: '20220000(測試専案)',
        sourceRow: 1,
        content: contentItem,
        matchStatus: 'exact',
      }],
      mainItems: [],
      childItems: [],
      orderedMainItemIds: ['1'],
      allowedStableItemIds: new Set(['20220000']),
      issues: [],
    }
    analysis.presentationScope.mainItems = analysis.presentationScope.items

    const result = buildExecutiveProjectSlides(analysis, content([contentItem]))

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

  it('主項與子項同頁保留各自財務明細，子項前端 0H 不被省略', () => {
    const analysis = makeAnalysis([{ itemNo: '1', quarterHours: 120 }])
    analysis.projectGroups[0]!.mainProject = {
      ...analysis.projectGroups[0]!.mainProject,
      itemNo: '1',
      projectKey: '20220506(團購網&UNI團購網系統優化)',
      projectName: '團購網&UNI團購網系統優化',
      quarterHours: 120,
      revenue: 1000000,
    }
    analysis.projectGroups[0]!.children = [{
      itemNo: '1-1',
      itemType: 'child',
      projectKey: '202304119(UNI團購網系統維運)',
      projectName: 'UNI團購網系統維運',
      cumulativeHours: 0,
      quarterHours: 0,
      cumulativePeopleCount: 0,
      quarterPeopleCount: 0,
      revenue: 300000,
    }]
    analysis.projectGroups[0]!.cumulativeHours = 120
    analysis.projectGroups[0]!.quarterHours = 120
    analysis.projectCostHoursByItemNo = {
      '1': {
        informationServiceHours: 10,
        frontendDevelopmentHours: 20,
        backendDevelopmentHours: 30,
      },
      '1-1': {
        informationServiceHours: 118,
        frontendDevelopmentHours: 0,
        backendDevelopmentHours: 175,
      },
    }
    analysis.projectCostCumulativeHoursByItemNo = {
      '1': {
        informationServiceHours: 25,
        frontendDevelopmentHours: 50,
        backendDevelopmentHours: 75,
      },
      '1-1': {
        informationServiceHours: 130,
        frontendDevelopmentHours: 0,
        backendDevelopmentHours: 200,
      },
    }
    const mainContent = item('1', {
      '專案名稱': '團購網&UNI團購網系統優化',
      '專案收入_年度收入': 1000000,
      '已完成工作事項_描述': '主項完成',
    })
    const childContent = item('1-1', {
      '專案名稱': 'UNI團購網系統維運',
      '專案收入_年度收入': 300000,
      '已完成工作事項_描述': '子項完成',
    })
    analysis.presentationScope = {
      items: [{
        itemNo: '1',
        itemType: 'main',
        stableItemId: '20220506',
        projectCode: '20220506',
        projectName: '20220506(團購網&UNI團購網系統優化)',
        sourceType: 'project',
        moduleKey: '20220506(團購網&UNI團購網系統優化)',
        sourceRow: 1,
        content: mainContent,
        matchStatus: 'exact',
      }, {
        itemNo: '1-1',
        parentItemNo: '1',
        itemType: 'child',
        stableItemId: '202304119',
        projectCode: '202304119',
        projectName: '202304119(UNI團購網系統維運)',
        sourceType: 'maintenance',
        moduleKey: '202304119(UNI團購網系統維運)',
        sourceRow: 2,
        content: childContent,
        matchStatus: 'exact',
      }],
      mainItems: [],
      childItems: [],
      orderedMainItemIds: ['1'],
      allowedStableItemIds: new Set(['20220506', '202304119']),
      issues: [],
    }
    analysis.presentationScope.mainItems = [analysis.presentationScope.items[0]!]
    analysis.presentationScope.childItems = [analysis.presentationScope.items[1]!]

    const result = buildExecutiveProjectSlides(
      analysis,
      content([mainContent, childContent]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )

    const details = result.slides[0]!.overview!.summary.financialDetails
    expect(details.map((row) => row.itemNo)).toEqual(['1', '1-1', '1 合計'])
    expect(details[1]!.projectCode).toBe('202304119')
    expect(details[1]!.annualRevenue).toBe(300000)
    expect(details[1]!.costBreakdown.informationServiceHours).toBe(118)
    expect(details[1]!.costBreakdown.frontendDevelopmentHours).toBe(0)
    expect(details[1]!.costBreakdown.backendDevelopmentHours).toBe(175)
    expect(details[1]!.workHoursStatus).toBe('matched')
    expect(
      details[1]!.costBreakdown.informationServiceHours +
        details[1]!.costBreakdown.frontendDevelopmentHours +
        details[1]!.costBreakdown.backendDevelopmentHours
    ).toBe(293)
    expect(details[1]!.costBreakdown.totalCost).toBe(159437)
    expect(details[1]!.costBreakdown.performance).toBe(140563)
    expect(details[1]!.cumulativeCostBreakdown.totalCost).toBe(178770)
    expect(details[1]!.cumulativeCostBreakdown.performance).toBe(121230)
    expect(details[2]!.costBreakdown.totalCost).toBe(
      details[0]!.costBreakdown.totalCost! + details[1]!.costBreakdown.totalCost!
    )
    expect(details[2]!.cumulativeCostBreakdown.totalCost).toBe(
      details[0]!.cumulativeCostBreakdown.totalCost! + details[1]!.cumulativeCostBreakdown.totalCost!
    )
    expect(result.slides[0]!.itemNo).toBe('1')
    expect(result.slides[0]!.sections.some((section) =>
      section.text.includes('主項完成') || section.text.includes('子項完成')
    )).toBe(true)
    expect(result.audit.lostContentCount).toBe(0)
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

// ── 年度收入唯一來源驗證（Phase 6J+）────────────────────────────────────────

function makeScopeWithRevenue(
  itemNo: string,
  annualRevenue: number | undefined,
  parentItemNo?: string
): import('@/types/presentationScope').PresentationWhitelistItem {
  return {
    itemNo,
    parentItemNo,
    itemType: parentItemNo ? 'child' : 'main',
    stableItemId: `CODE${itemNo}`,
    projectCode: `CODE${itemNo}`,
    projectName: `CODE${itemNo}(測試専案${itemNo})`,
    sourceType: 'project',
    moduleKey: `CODE${itemNo}(測試専案${itemNo})`,
    sourceRow: 1,
    content: item(itemNo, annualRevenue !== undefined ? { '專案收入_年度收入': annualRevenue } : {}),
    matchStatus: 'exact',
  }
}

function makeAnalysisWithScope(
  groups: Array<{ itemNo: string; childItemNos?: string[]; quarterHours?: number }>,
  revenueMap: Record<string, number | undefined>
): ReportAnalysisResult {
  const analysis = makeAnalysis(groups.map((g) => ({ itemNo: g.itemNo, quarterHours: g.quarterHours })))

  const allItems: import('@/types/presentationScope').PresentationWhitelistItem[] = []
  for (const group of groups) {
    const mainScope = makeScopeWithRevenue(group.itemNo, revenueMap[group.itemNo])
    allItems.push(mainScope)
    for (const childNo of group.childItemNos ?? []) {
      const childScope = makeScopeWithRevenue(childNo, revenueMap[childNo], group.itemNo)
      allItems.push(childScope)
    }
    // Build child items for group
    const children = (group.childItemNos ?? []).map((childNo) => ({
      itemNo: childNo,
      itemType: 'child' as const,
      projectKey: `CODE${childNo}(子項${childNo})`,
      projectName: `子項${childNo}`,
      cumulativeHours: 0,
      quarterHours: 0,
      cumulativePeopleCount: 0,
      quarterPeopleCount: 0,
      revenue: null,
    }))
    analysis.projectGroups.find((g) => g.mainItemNo === group.itemNo)!.children = children
  }

  analysis.presentationScope = {
    items: allItems,
    mainItems: allItems.filter((i) => i.itemType === 'main'),
    childItems: allItems.filter((i) => i.itemType === 'child'),
    orderedMainItemIds: groups.map((g) => g.itemNo),
    allowedStableItemIds: new Set(allItems.map((i) => i.stableItemId)),
    issues: [],
  }

  return analysis
}

describe('年度收入唯一來源：専案内容.専案収入_年度収入', () => {
  it('年度收入來自 専案内容.専案収入_年度収入，不使用 group.revenue 或 masterAnnualRevenue', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': 1044000 })
    // group.revenue 是不同來源（整體彙總），不得影響專案年度收入
    analysis.projectGroups[0]!.revenue = 9999999

    const result = buildExecutiveProjectSlides(analysis, content([
      makeScopeWithRevenue('1', 1044000).content,
    ]))
    expect(result.slides[0]?.overview?.annualRevenue).toBe(1044000)
  })

  it('不再使用 専案清單.年度収入（group.mainProject.revenue）', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': undefined })
    // 即使 mainProject.revenue 有值，年度收入也應為 null
    analysis.projectGroups[0]!.mainProject.revenue = 800000

    const result = buildExecutiveProjectSlides(analysis, content([
      makeScopeWithRevenue('1', undefined).content,
    ]))
    expect(result.slides[0]?.overview?.annualRevenue).toBeUndefined()
  })

  it('0 是有效收入，顯示為 0 而非缺值', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': 0 })

    const result = buildExecutiveProjectSlides(analysis, content([
      makeScopeWithRevenue('1', 0).content,
    ]))
    expect(result.slides[0]?.overview?.annualRevenue).toBe(0)
  })

  it('0 年度收入仍參與績效計算（calculationStatus = calculated）', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': 0 })
    analysis.projectCostHoursByItemNo = {
      '1': { informationServiceHours: 10, frontendDevelopmentHours: 20, backendDevelopmentHours: 5 },
    }
    analysis.projectCostCumulativeHoursByItemNo = analysis.projectCostHoursByItemNo

    const result = buildExecutiveProjectSlides(
      analysis,
      content([makeScopeWithRevenue('1', 0).content]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )
    const details = result.slides[0]!.overview!.summary.financialDetails
    const mainRow = details.find((r) => r.itemNo === '1')!
    expect(mainRow.annualRevenue).toBe(0)
    expect(mainRow.cumulativeCostBreakdown.calculationStatus).toBe('calculated')
    // 績效 = 0 - 費用 < 0
    expect(mainRow.cumulativeCostBreakdown.performance).toBeLessThan(0)
  })

  it('専案収入_年度収入 空白時年度收入為 null（顯示 —，不 fallback）', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': undefined })

    const result = buildExecutiveProjectSlides(analysis, content([
      makeScopeWithRevenue('1', undefined).content,
    ]))
    // overview.annualRevenue 使用 null ?? undefined = undefined
    expect(result.slides[0]?.overview?.annualRevenue).toBeUndefined()
    // financialDetails 中 annualRevenue = null
    const details = result.slides[0]!.overview!.summary.financialDetails
    if (details.length > 0) {
      expect(details[0]!.annualRevenue).toBeNull()
    }
  })

  it('主項使用自己的 専案収入_年度收入，不複製子項收入', () => {
    const analysis = makeAnalysisWithScope(
      [{ itemNo: '1', childItemNos: ['1-1'] }],
      { '1': 1044000, '1-1': 300000 }
    )
    analysis.projectCostHoursByItemNo = {
      '1': { informationServiceHours: 10, frontendDevelopmentHours: 20, backendDevelopmentHours: 5 },
      '1-1': { informationServiceHours: 5, frontendDevelopmentHours: 10, backendDevelopmentHours: 2 },
    }
    analysis.projectCostCumulativeHoursByItemNo = analysis.projectCostHoursByItemNo

    const result = buildExecutiveProjectSlides(
      analysis,
      content([
        makeScopeWithRevenue('1', 1044000).content,
        { ...makeScopeWithRevenue('1-1', 300000).content, parentItemNo: '1' },
      ]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )

    const details = result.slides[0]!.overview!.summary.financialDetails
    const mainRow = details.find((r) => r.itemNo === '1')!
    const childRow = details.find((r) => r.itemNo === '1-1')!
    expect(mainRow.annualRevenue).toBe(1044000)
    expect(childRow.annualRevenue).toBe(300000)
  })

  it('子項 0 不改用主項收入', () => {
    const analysis = makeAnalysisWithScope(
      [{ itemNo: '1', childItemNos: ['1-1'] }],
      { '1': 1044000, '1-1': 0 }
    )
    analysis.projectCostHoursByItemNo = {
      '1': { informationServiceHours: 10, frontendDevelopmentHours: 20, backendDevelopmentHours: 5 },
      '1-1': { informationServiceHours: 0, frontendDevelopmentHours: 0, backendDevelopmentHours: 0 },
    }
    analysis.projectCostCumulativeHoursByItemNo = analysis.projectCostHoursByItemNo

    const result = buildExecutiveProjectSlides(
      analysis,
      content([
        makeScopeWithRevenue('1', 1044000).content,
        { ...makeScopeWithRevenue('1-1', 0).content, parentItemNo: '1' },
      ]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )

    const details = result.slides[0]!.overview!.summary.financialDetails
    const childRow = details.find((r) => r.itemNo === '1-1')!
    // 子項 0 不得被替換為主項的 1044000
    expect(childRow.annualRevenue).toBe(0)
  })

  it('群組年度收入等於主項＋子項加總（不重複計算主項）', () => {
    const analysis = makeAnalysisWithScope(
      [{ itemNo: '1', childItemNos: ['1-1'] }],
      { '1': 1044000, '1-1': 0 }
    )
    analysis.projectCostHoursByItemNo = {
      '1': { informationServiceHours: 10, frontendDevelopmentHours: 20, backendDevelopmentHours: 5 },
      '1-1': { informationServiceHours: 0, frontendDevelopmentHours: 0, backendDevelopmentHours: 0 },
    }
    analysis.projectCostCumulativeHoursByItemNo = analysis.projectCostHoursByItemNo

    const result = buildExecutiveProjectSlides(
      analysis,
      content([
        makeScopeWithRevenue('1', 1044000).content,
        { ...makeScopeWithRevenue('1-1', 0).content, parentItemNo: '1' },
      ]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )

    const details = result.slides[0]!.overview!.summary.financialDetails
    const groupRow = details.find((r) => r.itemType === 'groupTotal')!
    const mainRow = details.find((r) => r.itemNo === '1')!
    const childRow = details.find((r) => r.itemNo === '1-1')!
    // 群組年度收入 = 主項 1044000 + 子項 0 = 1044000（不重複加主項）
    expect(groupRow.annualRevenue).toBe((mainRow.annualRevenue ?? 0) + (childRow.annualRevenue ?? 0))
    expect(groupRow.annualRevenue).toBe(1044000)
  })

  it('部分收入缺值時群組年度收入為 null（incomplete 狀態）', () => {
    const analysis = makeAnalysisWithScope(
      [{ itemNo: '1', childItemNos: ['1-1'] }],
      { '1': 1044000, '1-1': undefined }  // 子項無收入
    )
    analysis.projectCostHoursByItemNo = {
      '1': { informationServiceHours: 10, frontendDevelopmentHours: 20, backendDevelopmentHours: 5 },
      '1-1': { informationServiceHours: 5, frontendDevelopmentHours: 10, backendDevelopmentHours: 2 },
    }
    analysis.projectCostCumulativeHoursByItemNo = analysis.projectCostHoursByItemNo

    const result = buildExecutiveProjectSlides(
      analysis,
      content([
        makeScopeWithRevenue('1', 1044000).content,
        { ...makeScopeWithRevenue('1-1', undefined).content, parentItemNo: '1' },
      ]),
      { informationService: 709, frontendDevelopment: 398, backendDevelopment: 433 }
    )

    const details = result.slides[0]!.overview!.summary.financialDetails
    const mainRow = details.find((r) => r.itemNo === '1')!
    const childRow = details.find((r) => r.itemNo === '1-1')!
    const groupRow = details.find((r) => r.itemType === 'groupTotal')!
    // 主項有收入，子項無收入
    expect(mainRow.annualRevenue).toBe(1044000)
    expect(childRow.annualRevenue).toBeNull()
    // 群組合計標記為 incomplete（null）
    expect(groupRow.annualRevenue).toBeNull()
    // 群組累積績效因缺值而無法計算
    expect(groupRow.cumulativeCostBreakdown.calculationStatus).toBe('missing-revenue')
  })

  it('整體収入摘要（revenue.cumulativeRevenue）不得覆蓋個別專案年度收入', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': 500000 })
    // 整體收入摘要使用不同數字
    analysis.revenue = {
      configured: true,
      cumulativeRevenue: 22496000,
      quarterRevenue: null,
      revenuePerHour: null,
      inputOutputRatio: null,
      issues: [],
    }

    const result = buildExecutiveProjectSlides(analysis, content([
      makeScopeWithRevenue('1', 500000).content,
    ]))
    // 個別專案年度收入應為 500000，不受整體收入 22496000 影響
    expect(result.slides[0]?.overview?.annualRevenue).toBe(500000)
  })

  it('専案収入_描述文字不被解析為年度收入數字', () => {
    const analysis = makeAnalysisWithScope([{ itemNo: '1' }], { '1': undefined })
    // content 只有描述，沒有 専案収入_年度収入
    const mainContent = item('1', {
      '專案收入_描述': '合約金額：NT$1,500,000',
    })
    // 即使描述中含有數字，年度收入仍應為 null
    analysis.presentationScope!.items[0]!.content = mainContent

    const result = buildExecutiveProjectSlides(analysis, content([mainContent]))
    expect(result.slides[0]?.overview?.annualRevenue).toBeUndefined()
  })
})
