import type { QuarterConfig, QuarterKey } from '@/types/report'

export const QUARTER_CONFIG: Record<QuarterKey, QuarterConfig> = {
  S1: {
    label: '2026 S1',
    cumulativeLabel: '工時累積期間：2025/12–2026/03',
    periodLabel: '人力及專案／維運期間：2025/12–2026/03',
    cumulativeStart: '2025-12-01',
    cumulativeEnd: '2026-03-31',
    periodStart: '2025-12-01',
    periodEnd: '2026-03-31',
  },
  S2: {
    label: '2026 S2',
    cumulativeLabel: '工時累積期間：2025/12–2026/07',
    periodLabel: '人力及專案／維運期間：2026/04–2026/07',
    cumulativeStart: '2025-12-01',
    cumulativeEnd: '2026-07-31',
    periodStart: '2026-04-01',
    periodEnd: '2026-07-31',
  },
  S3: {
    label: '2026 S3',
    cumulativeLabel: '工時累積期間：2025/12–2026/11',
    periodLabel: '人力及專案／維運期間：2026/08–2026/11',
    cumulativeStart: '2025-12-01',
    cumulativeEnd: '2026-11-30',
    periodStart: '2026-08-01',
    periodEnd: '2026-11-30',
  },
} as const

export const QUARTER_KEYS: QuarterKey[] = ['S1', 'S2', 'S3']
