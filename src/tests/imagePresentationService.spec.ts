/**
 * imagePresentationService.spec.ts
 * 驗證圖片服務：Data URL 轉換、Contain 版型計算、占位圖、ImageRepository 建立。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getMimeTypeFromFilename,
  uint8ToDataUrl,
  calcContainLayout,
  buildPlaceholderDataUrl,
  getImageDataUrl,
  buildImageRepository,
} from '@/services/imagePresentationService'
import type { ParsedImageEntry } from '@/types/image'

// ── JSZip mock ─────────────────────────────────────────────────────────────

const { mockZipFiles, mockLoadAsync } = vi.hoisted(() => {
  const mockZipFiles: Record<string, { dir: boolean; async: (type: string) => Promise<Uint8Array> }> = {}
  const mockLoadAsync = vi.fn().mockImplementation(async () => ({ files: mockZipFiles }))
  return { mockZipFiles, mockLoadAsync }
})

vi.mock('jszip', () => ({
  default: { loadAsync: mockLoadAsync },
}))

beforeEach(() => {
  vi.clearAllMocks()
  // 預設：JSZip 成功載入，files 為空
  Object.keys(mockZipFiles).forEach((k) => delete mockZipFiles[k])
  mockLoadAsync.mockResolvedValue({ files: mockZipFiles })
})

afterEach(() => {
  vi.clearAllMocks()
})

// ── 測試 ───────────────────────────────────────────────────────────────────

describe('imagePresentationService', () => {
  describe('getMimeTypeFromFilename', () => {
    it('.png 回傳 image/png', () => {
      expect(getMimeTypeFromFilename('image.png')).toBe('image/png')
    })

    it('.jpg 回傳 image/jpeg', () => {
      expect(getMimeTypeFromFilename('photo.jpg')).toBe('image/jpeg')
    })

    it('.jpeg 回傳 image/jpeg', () => {
      expect(getMimeTypeFromFilename('photo.jpeg')).toBe('image/jpeg')
    })

    it('大寫副檔名轉小寫', () => {
      expect(getMimeTypeFromFilename('IMAGE.PNG')).toBe('image/png')
    })

    it('未知副檔名預設回傳 image/png', () => {
      expect(getMimeTypeFromFilename('file.bmp')).toBe('image/png')
    })
  })

  describe('uint8ToDataUrl', () => {
    it('回傳 data: URL 格式', () => {
      const data = new Uint8Array([1, 2, 3])
      const url = uint8ToDataUrl(data, 'test.png')
      expect(url).toMatch(/^data:image\/png;base64,/)
    })

    it('jpg 檔名使用 image/jpeg MIME', () => {
      const data = new Uint8Array([1])
      const url = uint8ToDataUrl(data, 'test.jpg')
      expect(url).toMatch(/^data:image\/jpeg;base64,/)
    })

    it('空 Uint8Array 仍回傳合法格式', () => {
      const data = new Uint8Array(0)
      const url = uint8ToDataUrl(data, 'test.png')
      expect(url).toMatch(/^data:image\/png;base64,/)
    })

    it('不在 URL 中洩漏不必要的資訊（只有 MIME 和 base64）', () => {
      const data = new Uint8Array([65, 66, 67])
      const url = uint8ToDataUrl(data, 'secret.png')
      expect(url).not.toContain('secret')
    })
  })

  describe('calcContainLayout', () => {
    it('正方形圖在長方形容器置中縮放', () => {
      const result = calcContainLayout(100, 100, 0, 0, 4, 2)
      expect(result.w).toBe(2)
      expect(result.h).toBe(2)
      expect(result.x).toBe(1) // (4-2)/2
    })

    it('橫向圖（寬 > 高）以寬度為準縮放', () => {
      const result = calcContainLayout(200, 100, 0, 0, 4, 3)
      expect(result.w).toBe(4) // 填滿容器寬
      expect(result.h).toBeCloseTo(2) // 4 / (200/100) = 2
    })

    it('縱向圖（高 > 寬）以高度為準縮放', () => {
      const result = calcContainLayout(100, 200, 0, 0, 4, 3)
      expect(result.h).toBe(3) // 填滿容器高
      expect(result.w).toBeCloseTo(1.5) // 3 * (100/200) = 1.5
    })

    it('結果不超出容器範圍', () => {
      const result = calcContainLayout(300, 200, 1, 1, 4, 2)
      expect(result.x).toBeGreaterThanOrEqual(1)
      expect(result.y).toBeGreaterThanOrEqual(1)
      expect(result.x + result.w).toBeLessThanOrEqual(5) // 1 + 4
      expect(result.y + result.h).toBeLessThanOrEqual(3) // 1 + 2
    })

    it('來源尺寸 ≤ 0 時直接回傳容器尺寸', () => {
      const result = calcContainLayout(0, 100, 0, 0, 4, 3)
      expect(result).toEqual({ x: 0, y: 0, w: 4, h: 3 })
    })

    it('保持原始比例（aspect ratio 不變）', () => {
      const srcAspect = 16 / 9
      const result = calcContainLayout(1600, 900, 0, 0, 5, 4)
      const resultAspect = result.w / result.h
      expect(resultAspect).toBeCloseTo(srcAspect, 5)
    })
  })

  describe('buildPlaceholderDataUrl', () => {
    it('回傳非空的 data URL', () => {
      const url = buildPlaceholderDataUrl()
      expect(url).toMatch(/^data:image\/png;base64,/)
      expect(url.length).toBeGreaterThan(20)
    })
  })

  describe('buildImageRepository', () => {
    it('空 validImages 回傳空 Map', async () => {
      const file = new File(['zip'], 'test.zip', { type: 'application/zip' })
      const repo = await buildImageRepository(file, [])
      expect(repo.size).toBe(0)
    })

    it('ZIP 解析失敗時回傳空 Map（不拋出）', async () => {
      mockLoadAsync.mockRejectedValueOnce(new Error('parse error'))
      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      } as unknown as File
      const entry: ParsedImageEntry = {
        filename: 'img.png', basename: 'img.png', basenameKey: 'img.png',
        size: 100, compressedSize: 50,
      }
      const repo = await buildImageRepository(mockFile, [entry])
      expect(repo.size).toBe(0)
    })

    it('成功解壓圖片存入 Map（basenameKey 為 key）', async () => {
      const fakeData = new Uint8Array([1, 2, 3])
      const filesMock: Record<string, { dir: boolean; async: (type: string) => Promise<Uint8Array> }> = {
        'folder/test.png': { dir: false, async: vi.fn().mockResolvedValue(fakeData) },
      }
      mockLoadAsync.mockImplementationOnce(async () => ({ files: filesMock }))

      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      } as unknown as File
      const entry: ParsedImageEntry = {
        filename: 'folder/test.png', basename: 'test.png', basenameKey: 'test.png',
        size: 3, compressedSize: 3,
      }
      const repo = await buildImageRepository(mockFile, [entry])
      expect(repo.get('test.png')).toEqual(fakeData)
    })

    it('單張圖片解壓失敗不阻擋其他圖片', async () => {
      const goodData = new Uint8Array([10, 20])
      const filesMock: Record<string, { dir: boolean; async: (type: string) => Promise<Uint8Array> }> = {
        'good.png': { dir: false, async: vi.fn().mockResolvedValue(goodData) },
        'bad.jpg': { dir: false, async: vi.fn().mockRejectedValue(new Error('corrupt')) },
      }
      mockLoadAsync.mockImplementationOnce(async () => ({ files: filesMock }))

      const mockFile = {
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(4)),
      } as unknown as File
      const entries: ParsedImageEntry[] = [
        { filename: 'good.png', basename: 'good.png', basenameKey: 'good.png', size: 2, compressedSize: 2 },
        { filename: 'bad.jpg', basename: 'bad.jpg', basenameKey: 'bad.jpg', size: 2, compressedSize: 2 },
      ]
      const repo = await buildImageRepository(mockFile, entries)
      expect(repo.get('good.png')).toEqual(goodData)
      expect(repo.get('bad.jpg')).toBeUndefined()
    })
  })

  describe('getImageDataUrl', () => {
    it('找到圖片時回傳 Data URL', () => {
      const repo = new Map<string, Uint8Array>([
        ['test.png', new Uint8Array([137, 80])],
      ])
      const url = getImageDataUrl(repo as ReadonlyMap<string, Uint8Array>, 'test.png', 'test.png')
      expect(url).toMatch(/^data:image\/png;base64,/)
    })

    it('找不到圖片時回傳 null', () => {
      const repo = new Map<string, Uint8Array>()
      const url = getImageDataUrl(repo as ReadonlyMap<string, Uint8Array>, 'missing.png', 'missing.png')
      expect(url).toBeNull()
    })
  })
})
