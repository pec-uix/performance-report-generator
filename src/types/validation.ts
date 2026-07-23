export type ValidationSeverity = 'error' | 'warning' | 'info'

export interface ValidationIssue {
  code: string
  severity: ValidationSeverity
  source:
    | 'work-hours-excel'
    | 'project-content-excel'
    | 'project-item'
    | 'image-zip'
    | 'image-reference'
    | 'work-record'
    | 'person-record'
    | 'project-master'
    | 'maintenance-record'
    | 'revenue-record'
    | 'analysis'
  message: string
  sheet?: string
  row?: number
  column?: string
  itemNo?: string
  filename?: string
}
