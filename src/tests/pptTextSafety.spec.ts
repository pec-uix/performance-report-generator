import { describe, expect, it } from 'vitest'
import { assertNoReplacementCharacters, assertPptText } from '@/services/pptTextSafety'

describe('pptTextSafety', () => {
  it('所有 PPT 文字不允許 U+FFFD', () => {
    expect(() => assertNoReplacementCharacters('成本分析')).not.toThrow()
    expect(() => assertNoReplacementCharacters('成本�分析')).toThrow('U+FFFD')
  })

  it('不允許連續問號替代字元', () => {
    expect(() => assertPptText('???', 'bad text')).toThrow('question marks')
  })
})
