/**
 * slidePaginationService.ts
 * Phase 5/6A project slide pagination.
 *
 * This layer reshapes ProjectContentResult into presentation-ready pages only.
 * It does not recalculate hours, revenue, people, ranking, or mapping data.
 */

import type { ProjectGroupAnalysis } from '@/types/analysis'
import type { ProjectContentResult, ProjectItem, ImageRef } from '@/types/project'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { Phase5Warning } from '@/types/ppt'
import type { HourlyRateSettings, ProjectCostBreakdown } from '@/types/projectCost'
import { estimateTextLines, paginateTextBlocks, sanitizeText } from './textPaginationService'
import { PRES_IMAGE_PER_PAGE, PRES_TEXT_LAYOUT } from '@/config/presentationTheme'
import { calculateProjectCostBreakdown } from './projectCostService'

// -- Section model ----------------------------------------------------------

export type ProjectContentSectionType =
  | 'projectIncome'
  | 'completedWork'
  | 'plannedWork'
  | 'uixResult'
  | 'executionResult'
  | 'legacyGeneric'

export interface ProjectContentTextBlock {
  label: string
  text: string
  sourceItemNo: string
}

export interface ProjectImageRef {
  category: string
  filename: string
  basenameKey: string
  sourceItemNo: string
  fieldName: string
}

export interface ProjectContentSection {
  type: ProjectContentSectionType
  title: string
  textBlocks: ProjectContentTextBlock[]
  imageRefs: ProjectImageRef[]
  sourceItemNos: string[]
}

interface SectionDefinition {
  type: ProjectContentSectionType
  title: string
  textAliases: readonly string[]
  imageAliases: readonly string[]
}

export const PROJECT_CONTENT_SECTION_DEFINITIONS: readonly SectionDefinition[] = [
  {
    type: 'projectIncome',
    title: '專案收入',
    textAliases: ['專案收入_描述'],
    imageAliases: ['專案收入_圖片展示'],
  },
  {
    type: 'completedWork',
    title: '已完成工作事項',
    textAliases: ['已完成工作事項_描述'],
    imageAliases: ['已完成工作事項_圖片展示'],
  },
  {
    type: 'plannedWork',
    title: '預計完成工作',
    textAliases: ['預計完成工作_描述'],
    imageAliases: ['預計完成工作_圖片展示'],
  },
  {
    type: 'uixResult',
    title: 'UIX執行成果',
    textAliases: ['UIX執行成果_文字/連結描述'],
    imageAliases: ['UIX執行成果_圖片展示'],
  },
  {
    type: 'executionResult',
    title: '執行成果',
    textAliases: ['執行成果_文字/連結描述'],
    imageAliases: ['執行成果_圖片展示'],
  },
]

const SECTION_BY_TEXT_ALIAS = new Map<string, SectionDefinition>()
const SECTION_BY_IMAGE_ALIAS = new Map<string, SectionDefinition>()
for (const def of PROJECT_CONTENT_SECTION_DEFINITIONS) {
  for (const alias of def.textAliases) SECTION_BY_TEXT_ALIAS.set(alias, def)
  for (const alias of def.imageAliases) SECTION_BY_IMAGE_ALIAS.set(alias, def)
}

// -- Slide model ------------------------------------------------------------

export interface ProjectSummaryRow {
  mainItemNo: string
  projectCode?: string
  projectName: string
  pm?: string
  members?: string[]
  cumulativeHours: number
  quarterHours: number
  quarterScopeRatio: number | null
  peopleCumulative: number
  peopleQuarter: number
  childCount: number
  revenue: number | null
  annualRevenue: number | null
  costBreakdown: ProjectCostBreakdown
  workHoursStatus: 'matched' | 'zero-hours' | 'unmatched'
}

export interface ProjectSummarySlide {
  type: 'summary'
  groupIndex: number
  projectPageIndex: number
  projectTotalPages: number
  mainItemNo: string
  projectName: string
  summary: ProjectSummaryRow
  sections: ProjectContentSection[]
}

export interface ProjectTextSlide {
  type: 'text'
  groupIndex: number
  projectPageIndex: number
  projectTotalPages: number
  mainItemNo: string
  projectName: string
  sectionType: ProjectContentSectionType
  sectionTitle: string
  isContinuation: boolean
  textBlocks: ProjectContentTextBlock[]
}

export interface ProjectImageSlide {
  type: 'images'
  groupIndex: number
  projectPageIndex: number
  projectTotalPages: number
  mainItemNo: string
  projectName: string
  sectionType: ProjectContentSectionType
  category: string
  filenames: string[]
  basenameKeys: string[]
  imageRefs: ProjectImageRef[]
}

export type ProjectSlideContent = ProjectSummarySlide | ProjectTextSlide | ProjectImageSlide

export interface PaginationResult {
  slides: ProjectSlideContent[]
  totalProjectSlides: number
  totalProjectGroups: number
  totalImagesReferenced: number
  warnings: Phase5Warning[]
}

// -- Helpers ----------------------------------------------------------------

function getBasenameKey(filename: string): string {
  const parts = filename.split(/[/\\]/)
  return (parts[parts.length - 1] ?? filename).toLowerCase()
}

function stripDuplicateSuffix(key: string): { baseKey: string; duplicateIndex: number | null } {
  const match = key.match(/^(.*)_(\d+)$/)
  if (!match) return { baseKey: key, duplicateIndex: null }
  return { baseKey: match[1] ?? key, duplicateIndex: Number(match[2]) }
}

function compareItemNoNatural(a: ProjectItem, b: ProjectItem): number {
  const aParts = a.normalizedItemNo.split('-').map((p) => Number(p))
  const bParts = b.normalizedItemNo.split('-').map((p) => Number(p))
  const len = Math.max(aParts.length, bParts.length)

  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? -1
    const bv = bParts[i] ?? -1
    if (av !== bv) return av - bv
  }

  return a.normalizedItemNo.localeCompare(b.normalizedItemNo)
}

function makeEmptySections(): ProjectContentSection[] {
  return PROJECT_CONTENT_SECTION_DEFINITIONS.map((def) => ({
    type: def.type,
    title: def.title,
    textBlocks: [],
    imageRefs: [],
    sourceItemNos: [],
  }))
}

function findSection(
  sections: ProjectContentSection[],
  type: ProjectContentSectionType
): ProjectContentSection {
  const section = sections.find((s) => s.type === type)
  if (!section) throw new Error(`Unknown project content section: ${type}`)
  return section
}

function findOrCreateLegacySection(
  sections: ProjectContentSection[],
  title: string
): ProjectContentSection {
  const sectionTitle = sanitizeText(title) || '投影片內容'
  const existing = sections.find((s) => s.type === 'legacyGeneric' && s.title === sectionTitle)
  if (existing) return existing
  const section: ProjectContentSection = {
    type: 'legacyGeneric',
    title: sectionTitle,
    textBlocks: [],
    imageRefs: [],
    sourceItemNos: [],
  }
  sections.push(section)
  return section
}

function addSourceItemNo(section: ProjectContentSection, itemNo: string): void {
  if (!section.sourceItemNos.includes(itemNo)) section.sourceItemNos.push(itemNo)
}

function pushContentWarning(
  warnings: Phase5Warning[],
  code: string,
  message: string,
  mainItemNo: string,
  sourceItemNo: string,
  fieldName: string,
  reason: string
): void {
  warnings.push({
    code,
    message,
    itemNo: mainItemNo,
    mainItemNo,
    sourceItemNo,
    fieldName,
    reason,
  })
}

function parseMoneyValue(raw: unknown): number | null | undefined {
  if (raw === 0) return 0
  const text = sanitizeText(String(raw ?? '')).replace(/,/g, '').replace(/^NT\$/i, '')
  if (!text) return undefined
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

function findDataString(item: ProjectItem | undefined, aliases: readonly string[]): string | undefined {
  if (!item) return undefined
  for (const alias of aliases) {
    const exact = item.data[alias]
    if (typeof exact === 'string' && sanitizeText(exact)) return sanitizeText(exact)
    for (const [key, value] of Object.entries(item.data)) {
      if (key.endsWith(`_${alias}`) && typeof value === 'string' && sanitizeText(value)) {
        return sanitizeText(value)
      }
    }
  }
  return undefined
}

function findDataMoney(item: ProjectItem | undefined, aliases: readonly string[]): number | null | undefined {
  if (!item) return undefined
  for (const alias of aliases) {
    const exact = parseMoneyValue(item.data[alias])
    if (exact !== undefined) return exact
    for (const [key, value] of Object.entries(item.data)) {
      if (key.endsWith(`_${alias}`)) {
        const parsed = parseMoneyValue(value)
        if (parsed !== undefined) return parsed
      }
    }
  }
  return undefined
}

function splitPeople(value: string | undefined): string[] | undefined {
  if (!value) return undefined
  const people = value
    .split(/[、,，/／\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
  return people.length > 0 ? people : undefined
}

function extractProjectCode(text: string | undefined): string | undefined {
  return sanitizeText(text ?? '').match(/^(\d+)\(/)?.[1]
}

function buildSummaryRow(
  analysis: ReportAnalysisResult,
  group: ProjectGroupAnalysis,
  hourlyRateSettings?: HourlyRateSettings,
  workHoursStatus: ProjectSummaryRow['workHoursStatus'] = 'matched'
): ProjectSummaryRow {
  const scopedMain = analysis.presentationScope?.mainItems.find((item) => item.itemNo === group.mainItemNo)
  const content = scopedMain?.content
  const contentAnnualRevenue = findDataMoney(content, ['專案收入_年度收入'])
  const annualRevenue = contentAnnualRevenue !== undefined
    ? contentAnnualRevenue
    : scopedMain?.masterAnnualRevenue !== undefined
      ? scopedMain.masterAnnualRevenue
      : group.revenue
  const contentPm = findDataString(content, ['PM'])
  const contentMembers = findDataString(content, ['專案成員', '成員'])
  const projectCode =
    extractProjectCode(scopedMain?.projectName) ??
    scopedMain?.projectCode ??
    extractProjectCode(scopedMain?.moduleKey) ??
    scopedMain?.stableItemId
  const scopeQuarterTotal =
    analysis.presentationAnalysis.presentationScopeAnalysis?.quarterTotalHours ??
    analysis.quarterSummary.workHours.totalHours
  const resolvedAnnualRevenue = annualRevenue ?? null
  return {
    mainItemNo: group.mainItemNo,
    projectCode,
    projectName: group.mainProject.projectName ?? '（未命名專案）',
    pm: contentPm ?? scopedMain?.pm,
    members: splitPeople(contentMembers) ?? scopedMain?.members,
    cumulativeHours: group.cumulativeHours,
    quarterHours: group.quarterHours,
    quarterScopeRatio:
      scopeQuarterTotal > 0 && workHoursStatus !== 'unmatched'
        ? group.quarterHours / scopeQuarterTotal
        : null,
    peopleCumulative: group.cumulativePeopleCount,
    peopleQuarter: group.quarterPeopleCount,
    childCount: group.children.length,
    revenue: group.revenue,
    annualRevenue: resolvedAnnualRevenue,
    costBreakdown: calculateProjectCostBreakdown(
      analysis.projectCostHoursByItemNo?.[group.mainItemNo],
      resolvedAnnualRevenue,
      workHoursStatus,
      hourlyRateSettings
    ),
    workHoursStatus,
  }
}

function resolveWorkHoursStatus(
  analysis: ReportAnalysisResult,
  group: ProjectGroupAnalysis
): ProjectSummaryRow['workHoursStatus'] {
  const scopedMain = analysis.presentationScope?.mainItems.find(
    (item) => item.itemNo === group.mainItemNo
  )
  if (scopedMain && (scopedMain.matchStatus === 'unmatched' || !scopedMain.moduleKey)) {
    return 'unmatched'
  }
  if (group.quarterHours === 0) return 'zero-hours'
  return 'matched'
}

function addTextBlock(
  section: ProjectContentSection,
  item: ProjectItem,
  label: string,
  text: string
): void {
  section.textBlocks.push({
    label: item.itemType === 'child' ? `子項 ${item.normalizedItemNo}` : label,
    text,
    sourceItemNo: item.normalizedItemNo,
  })
  addSourceItemNo(section, item.normalizedItemNo)
}

function addImageRefs(
  section: ProjectContentSection,
  item: ProjectItem,
  fieldName: string,
  ref: ImageRef,
  seenImages: Set<string>
): void {
  for (const filename of ref.filenames) {
    const basenameKey = getBasenameKey(filename)
    const dedupeKey = `${section.type}|${basenameKey}`
    if (seenImages.has(dedupeKey)) continue
    seenImages.add(dedupeKey)
    section.imageRefs.push({
      category: section.title,
      filename,
      basenameKey,
      sourceItemNo: item.normalizedItemNo,
      fieldName,
    })
  }
  addSourceItemNo(section, item.normalizedItemNo)
}

function buildSectionsForItems(
  mainItemNo: string,
  items: ProjectItem[],
  warnings: Phase5Warning[]
): ProjectContentSection[] {
  const sections = makeEmptySections()
  const seenImages = new Set<string>()

  for (const item of items) {
    let childContentMerged = false

    const legacyText = sanitizeText(String(item.data.legacyGenericSection_內容 ?? ''))
    const legacyTitle = sanitizeText(
      String(item.legacySectionTitle ?? item.data.legacyGenericSection_段落標題 ?? '')
    )
    if (legacyText) {
      const section = findOrCreateLegacySection(sections, legacyTitle)
      addTextBlock(section, item, legacyTitle || '投影片內容', legacyText)
    }
    const legacyImageRef = item.imageRefs.find((ref) => ref.column === 'legacyGenericSection_圖片檔名')
    if (legacyImageRef && legacyImageRef.filenames.length > 0) {
      const section = findOrCreateLegacySection(sections, legacyTitle)
      addImageRefs(section, item, legacyImageRef.column, legacyImageRef, seenImages)
    }

    for (const [key, rawVal] of Object.entries(item.data)) {
      if (key.startsWith('legacyGenericSection_') || key.startsWith('legacy')) continue
      if (item.legacyContent && (key === '專案名稱' || key === 'PM')) continue
      const { baseKey, duplicateIndex } = stripDuplicateSuffix(key)
      const textDef = SECTION_BY_TEXT_ALIAS.get(baseKey)
      const text = sanitizeText(String(rawVal ?? ''))

      if (duplicateIndex !== null && textDef) {
        pushContentWarning(
          warnings,
          'PROJECT_CONTENT_DUPLICATE_FIELD',
          `專案 ${mainItemNo} 的欄位「${baseKey}」出現重複鍵「${key}」，已依欄位順序合併。`,
          mainItemNo,
          item.normalizedItemNo,
          key,
          'duplicate field key'
        )
      }

      if (textDef) {
        if (!text) continue
        const section = findSection(sections, textDef.type)
        addTextBlock(section, item, textDef.title, text)
        childContentMerged = childContentMerged || item.itemType === 'child'
        continue
      }

      if (text) {
        pushContentWarning(
          warnings,
          'PROJECT_CONTENT_UNKNOWN_FIELD',
          `專案 ${mainItemNo} 的欄位「${key}」不在成果頁 exact alias 清單中，未輸出至成果頁。`,
          mainItemNo,
          item.normalizedItemNo,
          key,
          'unknown project content field'
        )
      }
    }

    for (const ref of item.imageRefs) {
      if (ref.column === 'legacyGenericSection_圖片檔名') continue
      const { baseKey, duplicateIndex } = stripDuplicateSuffix(ref.column)
      const imageDef = SECTION_BY_IMAGE_ALIAS.get(baseKey)
      if (!imageDef || ref.filenames.length === 0) continue

      if (duplicateIndex !== null) {
        pushContentWarning(
          warnings,
          'PROJECT_CONTENT_DUPLICATE_FIELD',
          `專案 ${mainItemNo} 的欄位「${baseKey}」出現重複鍵「${ref.column}」，已依欄位順序合併。`,
          mainItemNo,
          item.normalizedItemNo,
          ref.column,
          'duplicate field key'
        )
      }

      const section = findSection(sections, imageDef.type)
      addImageRefs(section, item, ref.column, ref, seenImages)
      childContentMerged = childContentMerged || item.itemType === 'child'
    }

    if (childContentMerged) {
      warnings.push({
        code: 'PROJECT_CHILD_CONTENT_MERGED',
        message: `子項 ${item.normalizedItemNo} 的成果內容已併入主專案 ${mainItemNo}。`,
        itemNo: mainItemNo,
        mainItemNo,
        sourceItemNo: item.normalizedItemNo,
        reason: 'child content merged into parent project',
      })
    }
  }

  return sections
}

function buildTextSlidesForSection(
  groupIndex: number,
  mainItemNo: string,
  projectName: string,
  section: ProjectContentSection
): ProjectTextSlide[] {
  const slides: ProjectTextSlide[] = []
  let currentBlocks: ProjectContentTextBlock[] = []
  let usedLines = 0
  const maxLines = PRES_TEXT_LAYOUT.maxLinesPerTextSlide

  const flush = (isContinuation: boolean): void => {
    if (currentBlocks.length === 0) return
    slides.push({
      type: 'text',
      groupIndex,
      projectPageIndex: 0,
      projectTotalPages: 0,
      mainItemNo,
      projectName,
      sectionType: section.type,
      sectionTitle: section.title,
      isContinuation,
      textBlocks: currentBlocks,
    })
    currentBlocks = []
    usedLines = 0
  }

  for (const block of section.textBlocks) {
    const pages = paginateTextBlocks(block.text)
    pages.forEach((pageText, pageIndex) => {
      const blockLines = estimateTextLines(pageText) + 2
      if (currentBlocks.length > 0 && usedLines + blockLines > maxLines) {
        flush(slides.length > 0 || pageIndex > 0)
      }
      currentBlocks.push({ ...block, text: pageText })
      usedLines += blockLines
      if (blockLines >= maxLines) {
        flush(slides.length > 0 || pageIndex > 0)
      }
    })
  }
  flush(slides.length > 0)
  return slides
}

function buildCombinedTextSlidesForSections(
  groupIndex: number,
  mainItemNo: string,
  projectName: string,
  sections: ProjectContentSection[]
): ProjectTextSlide[] {
  const combinedSection: ProjectContentSection = {
    type: 'legacyGeneric',
    title: '專案成果內容',
    textBlocks: [],
    imageRefs: [],
    sourceItemNos: [],
  }

  for (const section of sections) {
    for (const block of section.textBlocks) {
      const isChildBlock = block.label.startsWith('子項 ')
      combinedSection.textBlocks.push({
        ...block,
        label: isChildBlock ? `${block.label}｜${section.title}` : section.title,
      })
    }
  }

  return combinedSection.textBlocks.length > 0
    ? buildTextSlidesForSection(groupIndex, mainItemNo, projectName, combinedSection)
    : []
}

function buildImageSlidesForSection(
  groupIndex: number,
  mainItemNo: string,
  projectName: string,
  section: ProjectContentSection
): ProjectImageSlide[] {
  const slides: ProjectImageSlide[] = []
  const totalPagesForSection = Math.ceil(section.imageRefs.length / PRES_IMAGE_PER_PAGE)

  for (let p = 0; p < totalPagesForSection; p++) {
    const start = p * PRES_IMAGE_PER_PAGE
    const end = start + PRES_IMAGE_PER_PAGE
    const refs = section.imageRefs.slice(start, end)
    slides.push({
      type: 'images',
      groupIndex,
      projectPageIndex: 0,
      projectTotalPages: 0,
      mainItemNo,
      projectName,
      sectionType: section.type,
      category: section.title,
      filenames: refs.map((ref) => ref.filename),
      basenameKeys: refs.map((ref) => ref.basenameKey),
      imageRefs: refs,
    })
  }

  return slides
}

// -- Public API -------------------------------------------------------------

export function buildProjectSlideContents(
  analysis: ReportAnalysisResult,
  projectContent: ProjectContentResult,
  hourlyRateSettings?: HourlyRateSettings
): PaginationResult {
  const slides: ProjectSlideContent[] = []
  const warnings: Phase5Warning[] = []
  let totalImages = 0

  analysis.projectGroups.forEach((group, groupIndex) => {
    const mainItem = projectContent.items.find(
      (i) => i.itemType === 'main' && i.normalizedItemNo === group.mainItemNo
    )

    if (!mainItem) {
      warnings.push({
        code: 'P5_ITEM_NOT_FOUND',
        message: `找不到主專案 ${group.mainItemNo} 的內容資料，僅顯示數據摘要頁。`,
        itemNo: group.mainItemNo,
        mainItemNo: group.mainItemNo,
        reason: 'main project item not found',
      })
    }

    const childItems = projectContent.items
      .filter((i) => i.itemType === 'child' && i.parentItemNo === group.mainItemNo)
      .sort(compareItemNoNatural)

    const contentItems = mainItem ? [mainItem, ...childItems] : childItems
    const sections = buildSectionsForItems(group.mainItemNo, contentItems, warnings)
    const activeSections = sections.filter(
      (section) => section.textBlocks.length > 0 || section.imageRefs.length > 0
    )
    const summary = buildSummaryRow(
      analysis,
      group,
      hourlyRateSettings,
      resolveWorkHoursStatus(analysis, group)
    )

    totalImages += activeSections.reduce((acc, section) => acc + section.imageRefs.length, 0)

    const projectSlides: ProjectSlideContent[] = [{
      type: 'summary',
      groupIndex,
      projectPageIndex: 0,
      projectTotalPages: 0,
      mainItemNo: group.mainItemNo,
      projectName: summary.projectName,
      summary,
      sections: activeSections,
    }]

    const standardSections = activeSections.filter((section) => section.type !== 'legacyGeneric')
    const legacySections = activeSections.filter((section) => section.type === 'legacyGeneric')

    projectSlides.push(
      ...buildCombinedTextSlidesForSections(
        groupIndex,
        group.mainItemNo,
        summary.projectName,
        standardSections
      )
    )

    for (const section of legacySections) {
      projectSlides.push(
        ...buildTextSlidesForSection(groupIndex, group.mainItemNo, summary.projectName, section)
      )
    }

    for (const section of activeSections) {
      projectSlides.push(
        ...buildImageSlidesForSection(groupIndex, group.mainItemNo, summary.projectName, section)
      )
    }

    const projectTotalPages = projectSlides.length
    projectSlides.forEach((slide, idx) => {
      slide.projectPageIndex = idx + 1
      slide.projectTotalPages = projectTotalPages
      slides.push(slide)
    })
  })

  return {
    slides,
    totalProjectSlides: slides.length,
    totalProjectGroups: analysis.projectGroups.length,
    totalImagesReferenced: totalImages,
    warnings,
  }
}
