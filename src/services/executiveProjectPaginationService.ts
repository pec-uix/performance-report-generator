import type { ProjectContentResult } from '@/types/project'
import type { ReportAnalysisResult } from '@/types/reportAnalysis'
import type { Phase5Warning } from '@/types/ppt'
import type { HourlyRateSettings } from '@/types/projectCost'
import {
  buildProjectSlideContents,
  type ProjectContentTextBlock,
  type ProjectImageRef,
  type ProjectSummaryRow,
} from './slidePaginationService'

export type ExecutiveProjectSlideType =
  | 'project-overview'
  | 'project-detail'
  | 'project-gallery'

export interface ExecutiveContentSection {
  title: string
  text: string
  sourceItemNo: string
  sourceLabel: string
}

export interface ExecutiveImagePlacement {
  category: string
  filename: string
  basenameKey: string
  sourceItemNo: string
  fieldName: string
  placement: 'inline' | 'gallery'
}

export interface ExecutiveProjectLink {
  label: string
  url: string
  sourceItemNo: string
}

export interface ExecutiveProjectOverview {
  projectCode?: string
  projectName: string
  pm?: string
  members?: string[]
  workHours?: number
  ratio?: number
  annualRevenue?: number
  performance?: number
  cumulativePerformance?: number
  costBreakdown: ProjectSummaryRow['costBreakdown']
  cumulativeCostBreakdown: ProjectSummaryRow['cumulativeCostBreakdown']
  workStatus: ProjectSummaryRow['workHoursStatus']
  revenueDescription?: string
  summary: ProjectSummaryRow
}

export interface ExecutiveProjectSlide {
  mainItemId: string
  itemNo: string
  projectCode?: string
  projectName: string
  pm?: string
  pageIndex: number
  pageCount: number
  slideType: ExecutiveProjectSlideType
  overview?: ExecutiveProjectOverview
  sections: ExecutiveContentSection[]
  images: ExecutiveImagePlacement[]
  links: ExecutiveProjectLink[]
}

export interface ExecutivePaginationAudit {
  inputSectionCount: number
  outputSectionCount: number
  inputImageCount: number
  outputImageCount: number
  inputLinkCount: number
  outputLinkCount: number
  lostContentCount: number
}

export interface ExecutivePaginationResult {
  slides: ExecutiveProjectSlide[]
  totalProjectSlides: number
  totalProjectGroups: number
  totalImagesReferenced: number
  warnings: Phase5Warning[]
  audit: ExecutivePaginationAudit
  perProjectPageCounts: Record<string, number>
}

interface ProjectBundle {
  itemNo: string
  projectName: string
  summary: ProjectSummaryRow
  sections: ExecutiveContentSection[]
  images: ExecutiveImagePlacement[]
  links: ExecutiveProjectLink[]
}

const URL_PATTERN = /https?:\/\/[^\s)）]+/gi

function extractLinks(block: ProjectContentTextBlock): ExecutiveProjectLink[] {
  const matches = block.text.match(URL_PATTERN) ?? []
  return matches.map((url, index) => ({
    label: matches.length === 1 ? block.label : `${block.label} ${index + 1}`,
    url,
    sourceItemNo: block.sourceItemNo,
  }))
}

function toExecutiveSection(block: ProjectContentTextBlock): ExecutiveContentSection {
  return {
    title: block.label,
    text: block.text,
    sourceItemNo: block.sourceItemNo,
    sourceLabel: block.label,
  }
}

function toExecutiveImage(ref: ProjectImageRef, placement: 'inline' | 'gallery'): ExecutiveImagePlacement {
  return {
    category: ref.category,
    filename: ref.filename,
    basenameKey: ref.basenameKey,
    sourceItemNo: ref.sourceItemNo,
    fieldName: ref.fieldName,
    placement,
  }
}

function estimateTextHeight(text: string, fontSize: number, boxWidth: number, lineHeight = 1.25): number {
  const safeText = text.trim()
  if (!safeText) return 0.18
  const charsPerLine = Math.max(16, Math.floor((boxWidth * 96) / fontSize))
  return safeText.split(/\r?\n/).reduce((sum, line) => {
    const visualChars = Math.max(line.trim().length, 1)
    return sum + Math.max(1, Math.ceil(visualChars / charsPerLine)) * (fontSize / 72) * lineHeight
  }, 0)
}

function estimateSectionHeight(section: ExecutiveContentSection, boxWidth: number): number {
  const titleHeight = 0.28
  const titleBodyGap = 0.08
  const verticalPadding = 0.2
  return Math.min(
    2.55,
    Math.max(0.68, verticalPadding + titleHeight + titleBodyGap + estimateTextHeight(section.text, 10.8, boxWidth - 0.24))
  )
}

function chunkSectionsByHeight(
  sections: readonly ExecutiveContentSection[],
  boxWidth: number,
  capacity: number
): ExecutiveContentSection[][] {
  const chunks: ExecutiveContentSection[][] = []
  let current: ExecutiveContentSection[] = []
  let currentHeight = 0

  for (const section of sections) {
    const sectionHeight = estimateSectionHeight(section, boxWidth) + 0.12
    if (current.length > 0 && currentHeight + sectionHeight > capacity) {
      chunks.push(current)
      current = []
      currentHeight = 0
    }
    current.push(section)
    currentHeight += sectionHeight
  }

  if (current.length > 0) chunks.push(current)
  return chunks.length > 0 ? chunks : [[]]
}

function sectionChunkHeight(sections: readonly ExecutiveContentSection[], boxWidth: number): number {
  return sections.reduce((sum, section) => sum + estimateSectionHeight(section, boxWidth) + 0.12, 0)
}

function makeSlide(
  bundle: ProjectBundle,
  slideType: ExecutiveProjectSlideType,
  sections: ExecutiveContentSection[],
  images: ExecutiveImagePlacement[],
  links: ExecutiveProjectLink[],
  includeOverview: boolean
): ExecutiveProjectSlide {
  return {
    mainItemId: bundle.itemNo,
    itemNo: bundle.itemNo,
    projectCode: bundle.summary.projectCode,
    projectName: bundle.projectName,
    pm: bundle.summary.pm,
    pageIndex: 0,
    pageCount: 0,
    slideType,
    overview: includeOverview
      ? {
          projectCode: bundle.summary.projectCode,
          projectName: bundle.projectName,
          pm: bundle.summary.pm,
          members: bundle.summary.members,
          workHours: bundle.summary.workHoursStatus === 'unmatched'
            ? undefined
            : bundle.summary.quarterHours,
          ratio: bundle.summary.quarterScopeRatio ?? undefined,
          annualRevenue: bundle.summary.annualRevenue ?? undefined,
          performance: bundle.summary.costBreakdown.performance,
          cumulativePerformance: bundle.summary.cumulativeCostBreakdown.performance,
          costBreakdown: bundle.summary.costBreakdown,
          cumulativeCostBreakdown: bundle.summary.cumulativeCostBreakdown,
          workStatus: bundle.summary.workHoursStatus,
          summary: bundle.summary,
        }
      : undefined,
    sections,
    images,
    links,
  }
}

function paginateBundle(bundle: ProjectBundle): ExecutiveProjectSlide[] {
  const slides: ExecutiveProjectSlide[] = []
  const imageCount = bundle.images.length
  const hasInlineImages = imageCount > 0 && imageCount <= 2
  const overviewTextWidth = hasInlineImages ? 5.72 : 9.28
  const detailTextWidth = hasInlineImages ? 5.72 : 9.28
  const memberReserve = bundle.summary.members && bundle.summary.members.length > 0 ? 0.26 : 0
  const linkReserve = bundle.links.length > 0 ? Math.min(0.72, Math.max(0.32, bundle.links.length * 0.18)) : 0
  const overviewCapacity = Math.max(0.9, 3.0 - memberReserve - 1.56)
  const overviewChunks = chunkSectionsByHeight(bundle.sections, overviewTextWidth, overviewCapacity)
  const tentativeFirstChunk = overviewChunks[0] ?? []
  const firstChunk = sectionChunkHeight(tentativeFirstChunk, overviewTextWidth) <= overviewCapacity
    ? tentativeFirstChunk
    : []
  const remainingAfterOverview = firstChunk.length > 0
    ? overviewChunks.slice(1).flat()
    : bundle.sections

  if (imageCount >= 3) {
    const detailChunks = remainingAfterOverview.length > 0
      ? chunkSectionsByHeight(remainingAfterOverview, 9.28, 3.66 - linkReserve)
      : []
    slides.push(makeSlide(
      bundle,
      'project-overview',
      firstChunk,
      [],
      detailChunks.length === 0 ? bundle.links : [],
      true
    ))
    detailChunks.forEach((chunk, index) => {
      slides.push(makeSlide(
        bundle,
        'project-detail',
        chunk,
        [],
        index === detailChunks.length - 1 ? bundle.links : [],
        false
      ))
    })
    for (let i = 0; i < bundle.images.length; i += 4) {
      slides.push(makeSlide(
        bundle,
        'project-gallery',
        [],
        bundle.images.slice(i, i + 4).map((image) => ({ ...image, placement: 'gallery' })),
        [],
        false
      ))
    }
  } else {
    const detailCapacity = 3.66 - linkReserve
    const detailChunks = remainingAfterOverview.length > 0
      ? chunkSectionsByHeight(remainingAfterOverview, detailTextWidth, detailCapacity)
      : []
    const needsDetail = detailChunks.length > 0

    slides.push(makeSlide(
      bundle,
      'project-overview',
      firstChunk,
      needsDetail ? [] : bundle.images.map((image) => ({ ...image, placement: 'inline' })),
      needsDetail ? [] : bundle.links,
      true
    ))

    detailChunks.forEach((chunk, index) => {
      slides.push(makeSlide(
        bundle,
        'project-detail',
        chunk,
        index === detailChunks.length - 1 ? bundle.images.map((image) => ({ ...image, placement: 'inline' })) : [],
        index === detailChunks.length - 1 ? bundle.links : [],
        false
      ))
    })
  }

  slides.forEach((slide, index) => {
    slide.pageIndex = index + 1
    slide.pageCount = slides.length
  })
  return slides
}

function makeContentLossWarning(audit: ExecutivePaginationAudit): Phase5Warning | null {
  if (audit.lostContentCount === 0) return null
  return {
    code: 'EXECUTIVE_PAGINATION_CONTENT_LOSS',
    message: `Executive pagination 偵測到內容數量不一致，lostContentCount=${audit.lostContentCount}。`,
    reason: 'executive pagination audit failed',
  }
}

export function buildExecutiveProjectSlides(
  analysis: ReportAnalysisResult,
  projectContent: ProjectContentResult,
  hourlyRateSettings?: HourlyRateSettings
): ExecutivePaginationResult {
  const base = buildProjectSlideContents(analysis, projectContent, hourlyRateSettings)
  const bundles = new Map<string, ProjectBundle>()
  const order: string[] = []
  let inputSectionCount = 0
  let inputImageCount = 0
  let inputLinkCount = 0

  for (const slide of base.slides) {
    const existing = bundles.get(slide.mainItemNo)
    const bundle = existing ?? {
      itemNo: slide.mainItemNo,
      projectName: slide.projectName,
      summary: slide.type === 'summary' ? slide.summary : {
        mainItemNo: slide.mainItemNo,
        projectCode: undefined,
        projectName: slide.projectName,
        pm: undefined,
        members: undefined,
        cumulativeHours: 0,
        quarterHours: 0,
        quarterScopeRatio: null,
        peopleCumulative: 0,
        peopleQuarter: 0,
        childCount: 0,
        revenue: null,
        annualRevenue: null,
        costBreakdown: {
          informationServiceHours: 0,
          frontendDevelopmentHours: 0,
          backendDevelopmentHours: 0,
          calculationStatus: 'missing-hourly-rates',
        },
        cumulativeCostBreakdown: {
          informationServiceHours: 0,
          frontendDevelopmentHours: 0,
          backendDevelopmentHours: 0,
          calculationStatus: 'missing-hourly-rates',
        },
        financialDetails: [],
        workHoursStatus: 'matched' as const,
      },
      sections: [],
      images: [],
      links: [],
    }
    if (!existing) {
      bundles.set(slide.mainItemNo, bundle)
      order.push(slide.mainItemNo)
    }

    if (slide.type === 'summary') {
      bundle.summary = slide.summary
      bundle.projectName = slide.projectName
    } else if (slide.type === 'text') {
      for (const block of slide.textBlocks) {
        bundle.sections.push(toExecutiveSection(block))
        const links = extractLinks(block)
        bundle.links.push(...links)
        inputSectionCount++
        inputLinkCount += links.length
      }
    } else {
      for (const ref of slide.imageRefs) {
        bundle.images.push(toExecutiveImage(ref, 'inline'))
        inputImageCount++
      }
    }
  }

  const slides = order.flatMap((itemNo) => paginateBundle(bundles.get(itemNo) as ProjectBundle))
  const outputSectionCount = slides.reduce((sum, slide) => sum + slide.sections.length, 0)
  const outputImageCount = slides.reduce((sum, slide) => sum + slide.images.length, 0)
  const outputLinkCount = slides.reduce((sum, slide) => sum + slide.links.length, 0)
  const audit: ExecutivePaginationAudit = {
    inputSectionCount,
    outputSectionCount,
    inputImageCount,
    outputImageCount,
    inputLinkCount,
    outputLinkCount,
    lostContentCount:
      Math.max(0, inputSectionCount - outputSectionCount) +
      Math.max(0, inputImageCount - outputImageCount) +
      Math.max(0, inputLinkCount - outputLinkCount),
  }
  const warnings = [...base.warnings]
  const contentLossWarning = makeContentLossWarning(audit)
  if (contentLossWarning) warnings.push(contentLossWarning)

  return {
    slides,
    totalProjectSlides: slides.length,
    totalProjectGroups: base.totalProjectGroups,
    totalImagesReferenced: outputImageCount,
    warnings,
    audit,
    perProjectPageCounts: slides.reduce<Record<string, number>>((acc, slide) => {
      acc[slide.itemNo] = (acc[slide.itemNo] ?? 0) + 1
      return acc
    }, {}),
  }
}
