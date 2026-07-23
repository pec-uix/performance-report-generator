const REPLACEMENT_CHARACTER_PATTERN = /\uFFFD/
const SUSPICIOUS_QUESTION_PATTERN = /\?{3,}/

export function assertNoReplacementCharacters(text: string, context = 'PPT text'): void {
  if (REPLACEMENT_CHARACTER_PATTERN.test(text)) {
    throw new Error(`${context} contains Unicode replacement character U+FFFD`)
  }
  if (SUSPICIOUS_QUESTION_PATTERN.test(text)) {
    throw new Error(`${context} contains suspicious replacement question marks`)
  }
}

export function assertPptText(value: string, context?: string): string {
  assertNoReplacementCharacters(value, context)
  return value
}
