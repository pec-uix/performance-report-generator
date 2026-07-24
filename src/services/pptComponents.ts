/**
 * pptComponents.ts
 * Reusable executive PowerPoint components for Phase 6B.
 */

import type PptxGenJS from 'pptxgenjs'
import { PPT_THEME } from './pptTheme'
import { assertPptText } from './pptTextSafety'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface HeaderOptions {
  title: string
  subtitle?: string
}

interface FooterOptions {
  pageNum: number
  totalPages: number
  department?: string
}

interface ProjectHeaderOptions {
  itemNo: string
  projectCode?: string
  pm?: string
  projectName: string
  pageIndex: number
  pageCount: number
  slideKind: string
}

interface KpiCardOptions extends Box {
  label: string
  value: string
  caption?: string
  tone?: 'normal' | 'positive' | 'warning' | 'danger' | 'muted'
}

interface StatusBadgeOptions extends Box {
  text: string
  tone?: 'normal' | 'warning' | 'muted'
}

interface ContentCardOptions extends Box {
  title: string
  body: string
  compact?: boolean
}

interface ImageFrameOptions extends Box {
  title: string
}

interface LinkRowOptions extends Box {
  links: { label: string; url: string }[]
}

function toneColor(tone: KpiCardOptions['tone']): string {
  if (tone === 'positive') return PPT_THEME.color.positive
  if (tone === 'warning') return PPT_THEME.color.warning
  if (tone === 'danger') return PPT_THEME.color.danger
  if (tone === 'muted') return PPT_THEME.color.muted
  return PPT_THEME.color.navy
}

function kpiValueFontSize(value: string): number {
  if (value.length > 14) return 18
  if (value.length > 11) return 19
  return 20
}

export function addSlideHeader(slide: PptxGenJS.Slide, options: HeaderOptions): void {
  const T = PPT_THEME
  slide.addText(options.title, {
    x: T.layout.marginX,
    y: T.layout.titleY,
    w: T.layout.contentW,
    h: T.layout.titleH,
    fontFace: T.font.family,
    fontSize: T.font.title,
    bold: true,
    color: T.color.navy,
    fit: 'shrink',
  })
  if (options.subtitle) {
    slide.addText(options.subtitle, {
      x: T.layout.marginX,
      y: T.layout.subtitleY,
      w: T.layout.contentW,
      h: T.layout.subtitleH,
      fontFace: T.font.family,
      fontSize: T.font.subtitle,
      color: T.color.muted,
      fit: 'shrink',
    })
  }
  addDivider(slide, { x: T.layout.marginX, y: 0.82, w: T.layout.contentW, h: 0.02 })
}

export function addSlideFooter(slide: PptxGenJS.Slide, options: FooterOptions): void {
  const T = PPT_THEME
  const label = `${options.department ?? '行動前端開發課'}  |  INTERNAL PEC REPORT // CONFIDENTIAL`
  slide.addText(label, {
    x: T.layout.marginX,
    y: T.layout.footerY,
    w: 6.5,
    h: T.layout.footerH,
    fontFace: T.font.family,
    fontSize: T.font.footer,
    color: T.color.footer,
  })
  addPageNumber(slide, options.pageNum, options.totalPages)
}

export function addPageNumber(
  slide: PptxGenJS.Slide,
  pageNum: number,
  totalPages: number
): void {
  const T = PPT_THEME
  slide.addText(`SLIDE ${pageNum} / ${totalPages}`, {
    x: 7.8,
    y: T.layout.footerY,
    w: 1.85,
    h: T.layout.footerH,
    fontFace: T.font.family,
    fontSize: T.font.footer,
    color: T.color.footer,
    align: 'right',
  })
}

export function addProjectHeader(slide: PptxGenJS.Slide, options: ProjectHeaderOptions): void {
  const T = PPT_THEME
  const code = options.projectCode || '—'
  const pmText = options.pm ? `  |  PM  ${options.pm}` : ''
  slide.addText(`PROJECT CODE  ${code}${pmText}`, {
    x: T.layout.marginX,
    y: 0.16,
    w: 5.8,
    h: 0.18,
    fontFace: T.font.family,
    fontSize: T.font.caption,
    color: T.color.cyan,
    bold: true,
  })
  slide.addText(options.projectName, {
    x: T.layout.marginX,
    y: 0.36,
    w: 7.6,
    h: 0.42,
    fontFace: T.font.family,
    fontSize: 18,
    bold: true,
    color: T.color.navy,
    fit: 'shrink',
  })
  slide.addText(`${options.slideKind}  ${options.pageIndex} / ${options.pageCount}`, {
    x: 7.7,
    y: 0.18,
    w: 1.9,
    h: 0.18,
    fontFace: T.font.family,
    fontSize: T.font.caption,
    color: T.color.muted,
    align: 'right',
  })
  addDivider(slide, { x: T.layout.marginX, y: 0.82, w: T.layout.contentW, h: 0.02 })
}

export function addKpiCard(slide: PptxGenJS.Slide, options: KpiCardOptions): void {
  const T = PPT_THEME
  slide.addText('', {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fill: { color: T.color.surface },
    line: { color: T.color.border, width: T.layout.lineWidth },
    radius: T.layout.cardRadius,
  } as PptxGenJS.TextPropsOptions)
  slide.addText(options.label, {
    x: options.x + 0.08,
    y: options.y + 0.05,
    w: options.w - 0.16,
    h: 0.14,
    fontFace: T.font.family,
    fontSize: T.font.kpiLabel,
    color: T.color.muted,
    bold: true,
  })
  slide.addText(options.value, {
    x: options.x + 0.08,
    y: options.y + 0.25,
    w: options.w - 0.16,
    h: 0.25,
    fontFace: T.font.family,
    fontSize: kpiValueFontSize(options.value),
    color: toneColor(options.tone),
    bold: true,
    breakLine: false,
    fit: 'shrink',
  })
  if (options.caption) {
    slide.addText(options.caption, {
      x: options.x + 0.08,
      y: options.y + options.h - 0.18,
      w: options.w - 0.16,
      h: 0.12,
      fontFace: T.font.family,
      fontSize: T.font.caption,
      color: T.color.muted,
      fit: 'shrink',
    })
  }
}

export function addSectionTitle(
  slide: PptxGenJS.Slide,
  title: string,
  box: Box
): void {
  const T = PPT_THEME
  slide.addText(assertPptText(title, 'section title'), {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: T.font.family,
    fontSize: 12.5,
    bold: true,
    color: T.color.navy2,
    fit: 'shrink',
  })
}

export function addContentCard(slide: PptxGenJS.Slide, options: ContentCardOptions): void {
  const T = PPT_THEME
  const titleHeight = 0.28
  const titleBodyGap = 0.08
  const titleY = options.y + 0.1
  const bodyY = titleY + titleHeight + titleBodyGap
  slide.addText('', {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fill: { color: T.color.surface },
    line: { color: T.color.border, width: T.layout.lineWidth },
    radius: T.layout.cardRadius,
  } as PptxGenJS.TextPropsOptions)
  addSectionTitle(slide, options.title, {
    x: options.x + 0.12,
    y: titleY,
    w: options.w - 0.24,
    h: titleHeight,
  })
  slide.addText(assertPptText(options.body, `content card body: ${options.title}`), {
    x: options.x + 0.12,
    y: bodyY,
    w: options.w - 0.24,
    h: Math.max(0.18, options.y + options.h - bodyY - 0.1),
    fontFace: T.font.family,
    fontSize: options.compact ? T.font.bodySmall : T.font.body,
    color: T.color.text,
    breakLine: false,
    wrap: true,
    fit: 'shrink',
  })
}

export function addStatusBadge(slide: PptxGenJS.Slide, options: StatusBadgeOptions): void {
  const T = PPT_THEME
  const bg = options.tone === 'warning'
    ? T.color.warningBg
    : options.tone === 'muted'
      ? T.color.surface2
      : 'E8F7F6'
  const fg = options.tone === 'warning'
    ? T.color.warning
    : options.tone === 'muted'
      ? T.color.muted
      : T.color.teal
  slide.addText(options.text, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fontFace: T.font.family,
    fontSize: T.font.caption,
    color: fg,
    bold: true,
    align: 'center',
    valign: 'middle',
    fill: { color: bg },
    line: { color: fg, width: 0.35 },
    radius: T.layout.cardRadius,
    fit: 'shrink',
  } as PptxGenJS.TextPropsOptions)
}

export function addImageFrame(slide: PptxGenJS.Slide, options: ImageFrameOptions): void {
  const T = PPT_THEME
  slide.addText('', {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fill: { color: T.color.white },
    line: { color: T.color.border, width: T.layout.lineWidth },
    radius: T.layout.cardRadius,
  } as PptxGenJS.TextPropsOptions)
  slide.addText(options.title, {
    x: options.x + 0.08,
    y: options.y + 0.05,
    w: options.w - 0.16,
    h: 0.16,
    fontFace: T.font.family,
    fontSize: T.font.caption,
    color: T.color.muted,
    bold: true,
    fit: 'shrink',
  })
}

function makeLinkDisplayLabel(label: string, index: number, total: number): string {
  const stripped = label.replace(/\s+\d+$/, '').trim()
  if (!stripped) return total === 1 ? '開啟連結' : `連結 ${index + 1}`
  return `查看 ${stripped}`
}

export function addLinkRow(slide: PptxGenJS.Slide, options: LinkRowOptions): void {
  if (options.links.length === 0) return
  const T = PPT_THEME
  const rowCount = Math.min(options.links.length, 4)
  const rowH = Math.max(0.13, options.h / rowCount)
  options.links.slice(0, 4).forEach((link, index) => {
    slide.addText(makeLinkDisplayLabel(link.label, index, options.links.length), {
      x: options.x,
      y: options.y + index * rowH,
      w: options.w,
      h: rowH,
      fontFace: T.font.family,
      fontSize: T.font.caption,
      color: T.color.blue,
      bold: true,
      hyperlink: { url: link.url },
      fit: 'shrink',
    } as PptxGenJS.TextPropsOptions)
  })
}

export function addDivider(slide: PptxGenJS.Slide, box: Box): void {
  slide.addText('', {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fill: { color: PPT_THEME.color.divider },
    line: { color: PPT_THEME.color.divider, width: 0 },
  } as PptxGenJS.TextPropsOptions)
}

export function addWarningBlock(slide: PptxGenJS.Slide, box: Box, message: string): void {
  const T = PPT_THEME
  slide.addText(message, {
    x: box.x,
    y: box.y,
    w: box.w,
    h: box.h,
    fontFace: T.font.family,
    fontSize: T.font.body,
    color: T.color.warning,
    fill: { color: T.color.warningBg },
    line: { color: T.color.warning, width: T.layout.lineWidth },
    radius: T.layout.cardRadius,
    wrap: true,
    fit: 'shrink',
  } as PptxGenJS.TextPropsOptions)
}
