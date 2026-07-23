import { describe, it, expect } from 'vitest'
import { matchImages } from '@/services/imageMatcher'
import type { ParsedZipResult, ParsedImageEntry } from '@/types/image'
import type { ProjectContentResult } from '@/types/project'

// ── 測試輔助 ──────────────────────────────────────────────────────
function makeZipResult(basenames: string[], duplicates: string[] = []): ParsedZipResult {
  const images: ParsedImageEntry[] = basenames.map((name) => ({
    filename: name,
    basename: name,
    basenameKey: name.toLowerCase(),
    size: 1024,
    compressedSize: 512,
  }))
  return {
    valid: true,
    totalImages: images.length,
    images,
    duplicateBasenames: duplicates,
    issues: [],
  }
}

function makeProjectResult(refs: { column: string; filenames: string[] }[]): ProjectContentResult {
  return {
    sheetFound: true,
    alternativeSheetFound: false,
    totalRows: refs.length,
    mainCount: 1,
    childCount: 0,
    invalidCount: 0,
    duplicateCount: 0,
    orphanChildCount: 0,
    items: [
      {
        rowIndex: 0,
        rawItemNo: '1',
        normalizedItemNo: '1',
        itemType: 'main',
        data: {},
        imageRefs: refs,
      },
    ],
    detectedHeaders: [],
    issues: [],
  }
}

describe('imageMatcher', () => {
  it('完整比對：有引用且 ZIP 有圖片 → matched=1, missing=0', () => {
    const project = makeProjectResult([{ column: '圖片展示', filenames: ['photo.png'] }])
    const zip = makeZipResult(['photo.png'])
    const { summary } = matchImages(project, zip)
    expect(summary.matchedCount).toBe(1)
    expect(summary.missingCount).toBe(0)
    expect(summary.referencedCount).toBe(1)
  })

  it('圖片缺少 → IMG_MISSING warning', () => {
    const project = makeProjectResult([{ column: '圖片展示', filenames: ['missing.png'] }])
    const zip = makeZipResult([])
    const { issues } = matchImages(project, zip)
    expect(issues.some((i) => i.code === 'IMG_MISSING')).toBe(true)
    const warn = issues.find((i) => i.code === 'IMG_MISSING')
    expect(warn?.severity).toBe('warning')
  })

  it('ZIP 有多餘圖片 → IMG_UNUSED info', () => {
    const project = makeProjectResult([])
    const zip = makeZipResult(['unused.png'])
    const { issues } = matchImages(project, zip)
    expect(issues.some((i) => i.code === 'IMG_UNUSED')).toBe(true)
    const info = issues.find((i) => i.code === 'IMG_UNUSED')
    expect(info?.severity).toBe('info')
  })

  it('大小寫不敏感比對：Excel 引用 Photo.PNG，ZIP 有 photo.png → matched', () => {
    const project = makeProjectResult([{ column: '圖片展示', filenames: ['Photo.PNG'] }])
    const zip = makeZipResult(['photo.png'])
    const { summary } = matchImages(project, zip)
    expect(summary.matchedCount).toBe(1)
    expect(summary.missingCount).toBe(0)
  })

  it('每欄超過 4 張圖片 → IMG_TOO_MANY_PER_FIELD warning', () => {
    const filenames = ['a.png', 'b.png', 'c.png', 'd.png', 'e.png'] // 5 > 4
    const project = makeProjectResult([{ column: '圖片展示', filenames }])
    const zip = makeZipResult(filenames)
    const { issues } = matchImages(project, zip)
    expect(issues.some((i) => i.code === 'IMG_TOO_MANY_PER_FIELD')).toBe(true)
    const warn = issues.find((i) => i.code === 'IMG_TOO_MANY_PER_FIELD')
    expect(warn?.severity).toBe('warning')
  })

  it('不計入 ZIP 重複基本檔名的問題（由 zipReader 負責），summary.duplicateBasenameCount 正確', () => {
    const project = makeProjectResult([])
    const zip = makeZipResult(['photo.png'], ['photo.png']) // 已標記為重複
    const { summary } = matchImages(project, zip)
    expect(summary.duplicateBasenameCount).toBe(1)
  })

  it('同一張圖片在不同欄位引用 → 只計一次 referencedCount', () => {
    const project = makeProjectResult([
      { column: '圖片展示1', filenames: ['photo.png'] },
      { column: '圖片展示2', filenames: ['photo.png'] },
    ])
    const zip = makeZipResult(['photo.png'])
    const { summary } = matchImages(project, zip)
    expect(summary.referencedCount).toBe(1)
    expect(summary.matchedCount).toBe(1)
  })

  it('空專案 + 空 ZIP → 全部計數為 0，無 issue', () => {
    const project = makeProjectResult([])
    const zip = makeZipResult([])
    const { summary, issues } = matchImages(project, zip)
    expect(summary.referencedCount).toBe(0)
    expect(summary.matchedCount).toBe(0)
    expect(summary.missingCount).toBe(0)
    expect(summary.unusedCount).toBe(0)
    expect(issues).toHaveLength(0)
  })
})
