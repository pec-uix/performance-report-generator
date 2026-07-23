import type { ProjectItem } from './project'

export type PresentationScopeSourceType = 'project' | 'maintenance' | 'unresolved'

export type PresentationScopeMatchStatus =
  | 'exact'
  | 'case-normalized'
  | 'code-fallback'
  | 'unmatched'

export type PresentationScopeIssueCode =
  | 'PRESENTATION_SCOPE_USED'
  | 'PRESENTATION_SCOPE_CASE_NORMALIZED_MATCH'
  | 'PRESENTATION_SCOPE_CODE_FALLBACK_MATCH'
  | 'PRESENTATION_SCOPE_UNMATCHED_ITEM'
  | 'PRESENTATION_SCOPE_MODULE_MISSING'
  | 'PRESENTATION_SCOPE_WORK_HOURS_UNMATCHED'
  | 'PRESENTATION_SCOPE_CHILD_MERGED'
  | 'PRESENTATION_SCOPE_ITEM_NO_DISPLAY_RESTORED'
  | 'PRESENTATION_SCOPE_MATCH_AMBIGUOUS'

export interface PresentationScopeIssue {
  code: PresentationScopeIssueCode
  severity: 'warning' | 'error' | 'info'
  itemNo?: string
  sourceRow?: number
  projectCode?: string
  projectName?: string
  matchedName?: string
  stableItemId?: string
  moduleKey?: string
  reason: string
  message: string
}

export interface PresentationWhitelistItem {
  itemNo: string
  parentItemNo?: string
  itemType: 'main' | 'child'
  stableItemId: string
  projectCode?: string
  projectName: string
  sourceType: PresentationScopeSourceType
  moduleKey?: string
  pm?: string
  members?: string[]
  masterAnnualRevenue?: number | null
  sourceRow: number
  content: ProjectItem
  matchStatus: PresentationScopeMatchStatus
  matchedName?: string
}

export interface PresentationScope {
  items: PresentationWhitelistItem[]
  mainItems: PresentationWhitelistItem[]
  childItems: PresentationWhitelistItem[]
  orderedMainItemIds: string[]
  allowedStableItemIds: ReadonlySet<string>
  issues: PresentationScopeIssue[]
}
