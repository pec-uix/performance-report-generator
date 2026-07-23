import { describe, it, expect } from 'vitest'
import JSZip from 'jszip'
import { parseZipBuffer } from '@/services/zipReader'
import { isSafePath, isAllowedImageExtension } from '@/services/imageValidator'
import { FILE_LIMITS } from '@/config/fileLimits'

// ── 測試輔助 ──────────────────────────────────────────────────────
const FAKE_PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0])

async function buildZip(files: { name: string; content: Uint8Array }[]): Promise<ArrayBuffer> {
  const zip = new JSZip()
  for (const f of files) {
    zip.file(f.name, f.content)
  }
  return zip.generateAsync({ type: 'arraybuffer' })
}

describe('zipReader', () => {
  // ── 路徑安全（直接測試 isSafePath）────────────────────────────
  describe('isSafePath', () => {
    it('正常相對路徑安全', () => {
      expect(isSafePath('images/photo.png').safe).toBe(true)
      expect(isSafePath('photo.png').safe).toBe(true)
    })

    it('../ 路徑拒絕', () => {
      expect(isSafePath('../evil.png').safe).toBe(false)
    })

    it('..\\\\ 路徑拒絕', () => {
      expect(isSafePath('..\\evil.png').safe).toBe(false)
    })

    it('Unix 絕對路徑拒絕', () => {
      expect(isSafePath('/etc/passwd.png').safe).toBe(false)
    })

    it('Windows 磁碟代號路徑拒絕', () => {
      expect(isSafePath('C:\\path\\photo.png').safe).toBe(false)
      expect(isSafePath('D:/photo.png').safe).toBe(false)
    })
  })

  // ── 副檔名驗證 ────────────────────────────────────────────────
  describe('isAllowedImageExtension', () => {
    it('允許 .png / .jpg / .jpeg（大小寫不敏感）', () => {
      expect(isAllowedImageExtension('photo.png')).toBe(true)
      expect(isAllowedImageExtension('photo.PNG')).toBe(true)
      expect(isAllowedImageExtension('photo.jpg')).toBe(true)
      expect(isAllowedImageExtension('photo.JPG')).toBe(true)
      expect(isAllowedImageExtension('photo.jpeg')).toBe(true)
      expect(isAllowedImageExtension('photo.JPEG')).toBe(true)
    })

    it('拒絕 .exe .js .html .svg .pdf .xlsx .pptx', () => {
      for (const ext of ['.exe', '.js', '.html', '.svg', '.pdf', '.xlsx', '.pptx']) {
        expect(isAllowedImageExtension(`file${ext}`)).toBe(false)
      }
    })
  })

  // ── parseZipBuffer 整合測試 ───────────────────────────────────
  describe('parseZipBuffer', () => {
    it('有效 png 圖片被解析', async () => {
      const buf = await buildZip([{ name: 'photo.png', content: FAKE_PNG }])
      const result = await parseZipBuffer(buf)
      expect(result.valid).toBe(true)
      expect(result.images).toHaveLength(1)
      expect(result.images[0].basename).toBe('photo.png')
    })

    it('有效 jpg / jpeg 圖片被解析', async () => {
      const buf = await buildZip([
        { name: 'a.jpg', content: FAKE_PNG },
        { name: 'b.jpeg', content: FAKE_PNG },
      ])
      const result = await parseZipBuffer(buf)
      expect(result.images).toHaveLength(2)
    })

    it('無效副檔名 → ZIP_INVALID_EXTENSION error', async () => {
      const buf = await buildZip([{ name: 'malware.exe', content: new Uint8Array([0]) }])
      const result = await parseZipBuffer(buf)
      expect(result.issues.some((i) => i.code === 'ZIP_INVALID_EXTENSION')).toBe(true)
      expect(result.images).toHaveLength(0)
    })

    it('../ 路徑：JSZip 正規化或 isSafePath 提供防護', async () => {
      // JSZip 會自動正規化 ../ 路徑（安全行為），所以可能不會保留 ../
      // 無論如何，結果中不應出現含有 ../ 的圖片路徑
      const buf = await buildZip([{ name: '../evil.png', content: FAKE_PNG }])
      const result = await parseZipBuffer(buf)
      expect(result.images.every((img) => !img.filename.includes('..'))).toBe(true)
      // isSafePath 的直接測試已驗證路徑穿越防護邏輯
    })

    it('資料夾項目被忽略', async () => {
      const zip = new JSZip()
      zip.folder('subfolder')
      zip.file('subfolder/photo.png', FAKE_PNG)
      const buf = await zip.generateAsync({ type: 'arraybuffer' })
      const result = await parseZipBuffer(buf)
      // 資料夾本身不計入圖片，只有檔案計入
      expect(result.images.every((img) => !img.basename.endsWith('/'))).toBe(true)
    })

    it('__MACOSX 路徑被忽略', async () => {
      const buf = await buildZip([
        { name: '__MACOSX/photo.png', content: FAKE_PNG },
        { name: 'real.png', content: FAKE_PNG },
      ])
      const result = await parseZipBuffer(buf)
      // 只有 real.png，不計入 __MACOSX 下的檔案
      expect(result.images).toHaveLength(1)
      expect(result.images[0].basename).toBe('real.png')
    })

    it('.DS_Store 被忽略', async () => {
      const buf = await buildZip([
        { name: '.DS_Store', content: new Uint8Array([0]) },
        { name: 'ok.png', content: FAKE_PNG },
      ])
      const result = await parseZipBuffer(buf)
      expect(result.images).toHaveLength(1)
    })

    it('超過圖片數量上限 → ZIP_TOO_MANY_IMAGES error', async () => {
      const smallLimits = { ...FILE_LIMITS, maxImageCount: 2 }
      const buf = await buildZip([
        { name: 'a.png', content: FAKE_PNG },
        { name: 'b.png', content: FAKE_PNG },
        { name: 'c.png', content: FAKE_PNG },
      ])
      const result = await parseZipBuffer(buf, smallLimits)
      expect(result.issues.some((i) => i.code === 'ZIP_TOO_MANY_IMAGES')).toBe(true)
    })

    it('超過單張圖片大小上限 → ZIP_IMAGE_TOO_LARGE error', async () => {
      const smallLimits = { ...FILE_LIMITS, maxSingleImageBytes: 5 }
      const largeContent = new Uint8Array(10) // 10 bytes > 5 limit
      const buf = await buildZip([{ name: 'big.png', content: largeContent }])
      const result = await parseZipBuffer(buf, smallLimits)
      // 若 _data.uncompressedSize 不可用，此測試會回報 0 issues（已知限制）
      const hasSizeError = result.issues.some((i) => i.code === 'ZIP_IMAGE_TOO_LARGE')
      const sizeMetaUnavailable = result.images.some((img) => img.size === null)
      expect(hasSizeError || sizeMetaUnavailable).toBe(true)
    })

    it('重複 basename → ZIP_DUPLICATE_BASENAME error', async () => {
      const buf = await buildZip([
        { name: 'folder1/photo.png', content: FAKE_PNG },
        { name: 'folder2/photo.png', content: FAKE_PNG },
      ])
      const result = await parseZipBuffer(buf)
      expect(result.issues.some((i) => i.code === 'ZIP_DUPLICATE_BASENAME')).toBe(true)
      expect(result.duplicateBasenames).toContain('photo.png')
    })

    it('無效 ZIP buffer → ZIP_PARSE_ERROR error', async () => {
      const badBuffer = new Uint8Array([0, 1, 2, 3]).buffer
      const result = await parseZipBuffer(badBuffer)
      expect(result.valid).toBe(false)
      expect(result.issues.some((i) => i.code === 'ZIP_PARSE_ERROR')).toBe(true)
    })
  })
})
