export type QuarterKey = 'S1' | 'S2' | 'S3'

export interface QuarterConfig {
  label: string
  cumulativeLabel: string
  periodLabel: string
  cumulativeStart: string
  cumulativeEnd: string
  periodStart: string
  periodEnd: string
}

export interface FileUploadState {
  file: File | null
  error: string
  validated: boolean
}

export interface ReportState {
  selectedQuarter: QuarterKey
  workExcel: FileUploadState
  contentExcel: FileUploadState
  imageZip: FileUploadState
  globalMessage: string
}
