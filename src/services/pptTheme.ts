/**
 * pptTheme.ts
 * Phase 6B executive PowerPoint theme.
 *
 * Centralizes the visual system used by fullPptxBuilder.
 * No external font download, CDN, network, or storage is used.
 */

export const PPT_THEME = {
  slide: {
    width: 10,
    height: 5.625,
  },
  font: {
    family: 'Microsoft JhengHei, Noto Sans TC, PingFang TC, Arial',
    title: 22,
    subtitle: 12,
    body: 11.2,
    bodySmall: 10.8,
    caption: 8.8,
    kpiValue: 17,
    kpiLabel: 7.8,
    footer: 7.5,
  },
  color: {
    navy: '0F2F56',
    navy2: '173E68',
    blue: '24618E',
    cyan: '2AA7B8',
    teal: '1C8A84',
    bg: 'F6F8FB',
    white: 'FFFFFF',
    surface: 'FFFFFF',
    surface2: 'EEF4F8',
    border: 'C8D3DE',
    divider: 'D8E1EA',
    text: '1E293B',
    muted: '64748B',
    footer: '7B8794',
    warning: 'B7791F',
    warningBg: 'FFF7E6',
    positive: '13795B',
    danger: 'B42318',
  },
  layout: {
    marginX: 0.36,
    titleY: 0.16,
    titleH: 0.36,
    subtitleY: 0.56,
    subtitleH: 0.2,
    contentY: 0.9,
    contentW: 9.28,
    footerY: 5.28,
    footerH: 0.16,
    radius: 0.06,
    gap: 0.12,
    lineWidth: 0.45,
    sectionSpacing: 0.1,
    cardRadius: 0.08,
  },
} as const

export type PptTheme = typeof PPT_THEME
