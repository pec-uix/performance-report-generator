/**
 * pptTheme.spec.ts
 * Phase 6B executive PPT theme and shared component checks.
 */

import { describe, expect, it, vi } from 'vitest'
import { PPT_THEME } from '@/services/pptTheme'
import {
  addContentCard,
  addImageFrame,
  addKpiCard,
  addLinkRow,
  addProjectHeader,
  addSlideFooter,
  addSlideHeader,
  addStatusBadge,
  addWarningBlock,
} from '@/services/pptComponents'

function isHex(color: string): boolean {
  return /^[0-9A-F]{6}$/i.test(color)
}

function makeSlide() {
  return {
    addText: vi.fn().mockReturnThis(),
  }
}

describe('pptTheme Phase 6B', () => {
  it('集中管理 16:9 尺寸、字型、色票與版面 token', () => {
    expect(PPT_THEME.slide.width).toBe(10)
    expect(PPT_THEME.slide.height).toBe(5.625)
    expect(PPT_THEME.font.family.startsWith('Microsoft JhengHei')).toBe(true)
    expect(PPT_THEME.font.family).toContain('Noto Sans TC')
    expect(PPT_THEME.font.body).toBeGreaterThanOrEqual(11)
    expect(PPT_THEME.font.bodySmall).toBeGreaterThanOrEqual(10)
    expect(PPT_THEME.layout.footerY).toBeLessThan(PPT_THEME.slide.height)
    expect(PPT_THEME.layout.marginX).toBeGreaterThan(0)
  })

  it('content card 的 section title 與 body 使用不同 y 且保留固定間距', () => {
    const slide = makeSlide()
    addContentCard(slide as never, {
      x: 0.4,
      y: 1.8,
      w: 4,
      h: 1.2,
      title: '已完成工作事項',
      body: '1. 完成內容',
    })

    const titleCall = slide.addText.mock.calls.find((call) => call[0] === '已完成工作事項')
    const bodyCall = slide.addText.mock.calls.find((call) => call[0] === '1. 完成內容')
    const titleOptions = titleCall?.[1] as { y: number; h: number } | undefined
    const bodyOptions = bodyCall?.[1] as { y: number } | undefined

    expect(titleOptions).toBeTruthy()
    expect(bodyOptions).toBeTruthy()
    expect(bodyOptions?.y).not.toBe(titleOptions?.y)
    expect((bodyOptions?.y ?? 0) - ((titleOptions?.y ?? 0) + (titleOptions?.h ?? 0))).toBeCloseTo(0.08)
  })

  it('色票使用深藍、白色與低飽和強調色', () => {
    for (const color of Object.values(PPT_THEME.color)) {
      expect(isHex(color)).toBe(true)
    }
    expect(PPT_THEME.color.navy).toBe('0F2F56')
    expect(PPT_THEME.color.white).toBe('FFFFFF')
    expect(PPT_THEME.color.cyan).toBe('2AA7B8')
  })

  it('共用 header/footer/project/KPI/content/image/status/link/warning 元件可渲染', () => {
    const slide = makeSlide()
    addSlideHeader(slide as never, { title: '工作成果說明－工時', subtitle: '2025/12-2026/07' })
    addSlideFooter(slide as never, { pageNum: 2, totalPages: 37 })
    addProjectHeader(slide as never, {
      itemNo: '1',
      projectName: '202601001(專案名稱)',
      pageIndex: 1,
      pageCount: 2,
      slideKind: '主管整合摘要',
    })
    addKpiCard(slide as never, { x: 0.4, y: 1, w: 1.5, h: 0.7, label: '工時', value: '0.0 H' })
    addContentCard(slide as never, { x: 0.4, y: 1.8, w: 4, h: 1, title: '已完成工作事項', body: '完成內容' })
    addImageFrame(slide as never, { x: 5, y: 1.8, w: 4, h: 2, title: 'UIX 執行成果' })
    addStatusBadge(slide as never, { x: 7, y: 1, w: 2, h: 0.3, text: '本期無工時', tone: 'muted' })
    addLinkRow(slide as never, {
      x: 0.4, y: 4.8, w: 3, h: 0.3,
      links: [{ label: 'Figma', url: 'https://example.com/figma' }],
    })
    addWarningBlock(slide as never, { x: 0.4, y: 2.9, w: 3, h: 0.5 }, '人力公式尚未確認')

    const text = slide.addText.mock.calls.map((call) => String(call[0]))
    expect(text.some((value) => value.includes('INTERNAL PEC REPORT // CONFIDENTIAL'))).toBe(true)
    expect(text.some((value) => value.includes('PROJECT CODE'))).toBe(true)
    expect(text.some((value) => value.includes('工時'))).toBe(true)
    expect(text.some((value) => value.includes('人力公式尚未確認'))).toBe(true)
  })

  it('多個連結各自保留 hyperlink', () => {
    const slide = makeSlide()
    addLinkRow(slide as never, {
      x: 0.4, y: 4.5, w: 3, h: 0.6,
      links: [
        { label: '連結 A', url: 'https://example.com/a' },
        { label: '連結 B', url: 'https://example.com/b' },
      ],
    })

    const hyperlinkUrls = slide.addText.mock.calls
      .map((call) => (call[1] as { hyperlink?: { url: string } } | undefined)?.hyperlink?.url)
      .filter(Boolean)
    expect(hyperlinkUrls).toEqual(['https://example.com/a', 'https://example.com/b'])
  })
})
