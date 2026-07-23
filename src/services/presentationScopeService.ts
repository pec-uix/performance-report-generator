import type {
  MaintenanceMasterRecord,
  NormalizedWorkRecord,
  ProjectMasterRecord,
} from '@/types/analysis'
import type { ProjectContentResult, ProjectItem } from '@/types/project'
import type {
  PresentationScope,
  PresentationScopeIssue,
  PresentationScopeMatchStatus,
  PresentationScopeSourceType,
  PresentationWhitelistItem,
} from '@/types/presentationScope'
import type { ValidationIssue } from '@/types/validation'
import { PROJECT_CONTENT_NAME_FIELD_ALIASES } from '@/config/requiredSheets'
import { normalizeHeaderName } from './headerNormalizer'

interface BuildPresentationScopeInput {
  projectContent: ProjectContentResult | null | undefined
  projectMasters: ProjectMasterRecord[]
  maintenanceMasters: MaintenanceMasterRecord[]
  workRecords: NormalizedWorkRecord[]
}

interface MasterCandidate {
  sourceType: Exclude<PresentationScopeSourceType, 'unresolved'>
  stableItemId: string
  moduleKey?: string
  matchedName: string
  code?: string
  pm?: string
  members?: string[]
  annualRevenue?: number | null
}

interface ResolvedScopeMatch {
  sourceType: PresentationScopeSourceType
  stableItemId: string
  moduleKey?: string
  matchedName?: string
  matchStatus: PresentationScopeMatchStatus
  projectCode?: string
  pm?: string
  members?: string[]
  masterAnnualRevenue?: number | null
}

function addMapValue<T>(map: Map<string, T[]>, key: string | undefined, value: T): void {
  const normalized = normalizeHeaderName(key ?? '')
  if (!normalized) return
  const list = map.get(normalized) ?? []
  list.push(value)
  map.set(normalized, list)
}

function extractLeadingCode(text: string): string | undefined {
  return text.match(/^(\d+)\(/)?.[1]
}

function extractLeadingIdentifier(text: string | undefined): string | undefined {
  return normalizeHeaderName(text ?? '').match(/^([^()]+)\(/)?.[1]
}

function extractCodeFromAnyModule(text: string | undefined): string | undefined {
  return normalizeHeaderName(text ?? '').match(/^(\d+)(?:\(|$)/)?.[1]
}

function findProjectContentName(item: ProjectItem): string {
  if (item.displayName) return item.displayName
  for (const alias of PROJECT_CONTENT_NAME_FIELD_ALIASES) {
    const exact = item.data[alias]
    if (typeof exact === 'string' && normalizeHeaderName(exact)) {
      return normalizeHeaderName(exact)
    }
    for (const key of Object.keys(item.data)) {
      if (key.endsWith(`_${alias}`)) {
        const val = item.data[key]
        if (typeof val === 'string' && normalizeHeaderName(val)) {
          return normalizeHeaderName(val)
        }
      }
    }
  }
  return ''
}

function equalsAsciiCaseOnly(a: string, b: string): boolean {
  if (a === b || a.length !== b.length) return a === b
  let hasCaseDifference = false
  for (let i = 0; i < a.length; i++) {
    const ca = a.charCodeAt(i)
    const cb = b.charCodeAt(i)
    if (ca === cb) continue
    const la = a[i]?.toLowerCase()
    const lb = b[i]?.toLowerCase()
    const asciiLetterA = (ca >= 65 && ca <= 90) || (ca >= 97 && ca <= 122)
    const asciiLetterB = (cb >= 65 && cb <= 90) || (cb >= 97 && cb <= 122)
    if (asciiLetterA && asciiLetterB && la === lb) {
      hasCaseDifference = true
      continue
    }
    return false
  }
  return hasCaseDifference
}

function makeIssue(
  code: PresentationScopeIssue['code'],
  severity: PresentationScopeIssue['severity'],
  message: string,
  item: ProjectItem,
  projectName: string,
  reason: string,
  resolved?: Partial<ResolvedScopeMatch>
): PresentationScopeIssue {
  return {
    code,
    severity,
    message,
    itemNo: item.normalizedItemNo,
    sourceRow: item.sourceRow,
    projectCode: resolved?.projectCode ?? extractLeadingCode(projectName),
    projectName,
    matchedName: resolved?.matchedName,
    stableItemId: resolved?.stableItemId,
    moduleKey: resolved?.moduleKey,
    reason,
  }
}

function toValidationIssue(issue: PresentationScopeIssue): ValidationIssue {
  return {
    code: issue.code,
    severity: issue.severity,
    source: 'presentation-scope',
    message: issue.message,
    row: issue.sourceRow,
    itemNo: issue.itemNo,
    projectName: issue.projectName,
    stableItemId: issue.stableItemId,
    moduleKey: issue.moduleKey,
    matchedName: issue.matchedName,
    reason: issue.reason,
  }
}

function buildMasterIndexes(
  projectMasters: ProjectMasterRecord[],
  maintenanceMasters: MaintenanceMasterRecord[]
): {
  exact: Map<string, MasterCandidate[]>
  caseCandidates: MasterCandidate[]
  code: Map<string, MasterCandidate[]>
} {
  const exact = new Map<string, MasterCandidate[]>()
  const caseCandidates: MasterCandidate[] = []
  const code = new Map<string, MasterCandidate[]>()

  for (const record of projectMasters) {
    const stableItemId = extractCodeFromAnyModule(record.projectModuleKey)
      ?? extractLeadingIdentifier(record.projectKey)
      ?? record.projectKey
    if (!stableItemId) continue
    const moduleKey = record.projectModuleKey
    const matchedName = moduleKey || record.projectName || stableItemId
    const candidate: MasterCandidate = {
      sourceType: 'project',
      stableItemId,
      moduleKey,
      matchedName,
      code: extractCodeFromAnyModule(stableItemId) ?? stableItemId,
      pm: record.pm,
      members: record.members,
      annualRevenue: record.annualRevenue,
    }
    addMapValue(exact, moduleKey, candidate)
    caseCandidates.push(candidate)
    addMapValue(code, candidate.code, candidate)
  }

  for (const record of maintenanceMasters) {
    const stableItemId = extractLeadingIdentifier(record.maintenanceModuleKey)
      ?? extractLeadingIdentifier(record.maintenanceKey)
      ?? record.maintenanceKey
    if (!stableItemId) continue
    const moduleKey = record.maintenanceModuleKey
    const matchedName = moduleKey || record.maintenanceName || stableItemId
    const candidate: MasterCandidate = {
      sourceType: 'maintenance',
      stableItemId,
      moduleKey,
      matchedName,
      code: extractLeadingIdentifier(stableItemId) ?? stableItemId,
    }
    addMapValue(exact, moduleKey, candidate)
    caseCandidates.push(candidate)
    addMapValue(code, candidate.code, candidate)
  }

  return { exact, caseCandidates, code }
}

function buildWorkModuleKeysByCode(workRecords: NormalizedWorkRecord[]): Map<string, Set<string>> {
  const byCode = new Map<string, Set<string>>()
  for (const record of workRecords) {
    const moduleKey = record.moduleKey
    const code = extractCodeFromAnyModule(moduleKey)
    if (!moduleKey || !code) continue
    const set = byCode.get(code) ?? new Set<string>()
    set.add(moduleKey)
    byCode.set(code, set)
  }
  return byCode
}

function resolveModuleKeyFromWorkRecords(
  code: string,
  workModuleKeysByCode: ReadonlyMap<string, ReadonlySet<string>>
): { moduleKey?: string; status: 'none' | 'unique' | 'multiple' } {
  const matches = Array.from(workModuleKeysByCode.get(code) ?? [])
  if (matches.length === 0) return { status: 'none' }
  if (matches.length > 1) return { status: 'multiple' }
  return { status: 'unique', moduleKey: matches[0] }
}

function resolveScopeMatch(
  item: ProjectItem,
  projectName: string,
  indexes: ReturnType<typeof buildMasterIndexes>,
  workModuleKeysByCode: ReadonlyMap<string, ReadonlySet<string>>,
  issues: PresentationScopeIssue[]
): ResolvedScopeMatch {
  const normalizedName = normalizeHeaderName(projectName)
  const exactCandidates = indexes.exact.get(normalizedName) ?? []
  if (exactCandidates.length === 1) {
    const c = exactCandidates[0] as MasterCandidate
    return {
      sourceType: c.sourceType,
      stableItemId: c.stableItemId,
      moduleKey: c.moduleKey,
      matchedName: c.matchedName,
      matchStatus: 'exact',
      projectCode: c.code,
      pm: c.pm,
      members: c.members,
      masterAnnualRevenue: c.annualRevenue,
    }
  }
  if (exactCandidates.length > 1) {
    issues.push(makeIssue(
      'PRESENTATION_SCOPE_MATCH_AMBIGUOUS',
      'error',
      `項次 ${item.normalizedItemNo}「${projectName}」完整名稱命中多筆主檔，已保留但不任選。`,
      item,
      projectName,
      'exact full-name match is ambiguous'
    ))
  }

  const caseMatches = indexes.caseCandidates.filter((candidate) =>
    candidate.moduleKey && equalsAsciiCaseOnly(candidate.moduleKey, normalizedName)
  )
  if (caseMatches.length === 1) {
    const c = caseMatches[0] as MasterCandidate
    const resolved: ResolvedScopeMatch = {
      sourceType: c.sourceType,
      stableItemId: c.stableItemId,
      moduleKey: c.moduleKey,
      matchedName: c.matchedName,
      matchStatus: 'case-normalized',
      projectCode: c.code,
      pm: c.pm,
      members: c.members,
      masterAnnualRevenue: c.annualRevenue,
    }
    issues.push(makeIssue(
      'PRESENTATION_SCOPE_CASE_NORMALIZED_MATCH',
      'warning',
      `項次 ${item.normalizedItemNo}「${projectName}」以英文大小寫正規化命中「${c.matchedName}」。`,
      item,
      projectName,
      'ASCII case-only match',
      resolved
    ))
    return resolved
  }
  if (caseMatches.length > 1) {
    issues.push(makeIssue(
      'PRESENTATION_SCOPE_MATCH_AMBIGUOUS',
      'error',
      `項次 ${item.normalizedItemNo}「${projectName}」大小寫正規化命中多筆主檔，已保留但不任選。`,
      item,
      projectName,
      'case-normalized match is ambiguous'
    ))
  }

  const code = extractLeadingCode(normalizedName)
  if (code) {
    const codeMatches = indexes.code.get(code) ?? []
    if (codeMatches.length === 1) {
      const c = codeMatches[0] as MasterCandidate
      let moduleKey = c.moduleKey
      if (!moduleKey) {
        const fallback = resolveModuleKeyFromWorkRecords(code, workModuleKeysByCode)
        if (fallback.status === 'unique') {
          moduleKey = fallback.moduleKey
        } else {
          issues.push(makeIssue(
            'PRESENTATION_SCOPE_MODULE_MISSING',
            fallback.status === 'multiple' ? 'error' : 'warning',
            `項次 ${item.normalizedItemNo}「${projectName}」主檔模組為空，工時明細 code fallback ${fallback.status === 'multiple' ? '命中多個模組' : '沒有命中模組'}。`,
            item,
            projectName,
            fallback.status === 'multiple'
              ? 'multiple work module keys matched project code'
              : 'no work module key matched project code',
            {
              sourceType: c.sourceType,
              stableItemId: c.stableItemId,
              matchedName: c.matchedName,
              projectCode: code,
            }
          ))
        }
      }
      const resolved: ResolvedScopeMatch = {
        sourceType: c.sourceType,
        stableItemId: c.stableItemId,
        moduleKey,
        matchedName: c.matchedName,
        matchStatus: 'code-fallback',
        projectCode: code,
        pm: c.pm,
        members: c.members,
        masterAnnualRevenue: c.annualRevenue,
      }
      issues.push(makeIssue(
        'PRESENTATION_SCOPE_CODE_FALLBACK_MATCH',
        'warning',
        `項次 ${item.normalizedItemNo}「${projectName}」以 project code ${code} 精確 fallback 命中「${c.matchedName}」。`,
        item,
        projectName,
        'project code exact fallback',
        resolved
      ))
      return resolved
    }
    if (codeMatches.length > 1) {
      issues.push(makeIssue(
        'PRESENTATION_SCOPE_MATCH_AMBIGUOUS',
        'error',
        `項次 ${item.normalizedItemNo}「${projectName}」project code ${code} 命中多筆主檔，已保留但不任選。`,
        item,
        projectName,
        'project code exact fallback is ambiguous',
        { projectCode: code }
      ))
    }
  }

  const fallbackCode = code ?? normalizedName
  const resolved: ResolvedScopeMatch = {
    sourceType: 'unresolved',
    stableItemId: fallbackCode,
    matchStatus: 'unmatched',
    projectCode: code,
  }
  issues.push(makeIssue(
    'PRESENTATION_SCOPE_UNMATCHED_ITEM',
    'warning',
    `項次 ${item.normalizedItemNo}「${projectName}」無法精確對應專案清單或維運清單，已保留內容頁並標示未匹配。`,
    item,
    projectName,
    'no exact, case-normalized, or project-code match',
    resolved
  ))
  return resolved
}

function makeWhitelistItem(
  item: ProjectItem,
  projectName: string,
  resolved: ResolvedScopeMatch
): PresentationWhitelistItem {
  return {
    itemNo: item.normalizedItemNo,
    parentItemNo: item.parentItemNo,
    itemType: item.itemType === 'child' ? 'child' : 'main',
    stableItemId: resolved.stableItemId,
    projectCode: resolved.projectCode,
    projectName,
    sourceType: resolved.sourceType,
    moduleKey: resolved.moduleKey,
    pm: resolved.pm,
    members: resolved.members,
    masterAnnualRevenue: resolved.masterAnnualRevenue,
    sourceRow: item.sourceRow ?? item.rowIndex + 3,
    content: {
      ...item,
      projectCode: resolved.projectCode,
      sourceType: resolved.sourceType,
      stableItemId: resolved.stableItemId,
      moduleKey: resolved.moduleKey,
      matchedName: resolved.matchedName,
      matchStatus: resolved.matchStatus,
      displayName: projectName,
    },
    matchStatus: resolved.matchStatus,
    matchedName: resolved.matchedName,
  }
}

export function buildPresentationScope(input: BuildPresentationScopeInput): PresentationScope {
  const projectContent = input.projectContent
  const issues: PresentationScopeIssue[] = []

  if (!projectContent || projectContent.items.length === 0 || projectContent.legacyMode) {
    return {
      items: [],
      mainItems: [],
      childItems: [],
      orderedMainItemIds: [],
      allowedStableItemIds: new Set(),
      issues,
    }
  }

  issues.push({
    code: 'PRESENTATION_SCOPE_USED',
    severity: 'info',
    reason: 'project content sheet controls result-page whitelist',
    message: '已使用專案內容工作表建立 PPT 成果頁白名單；整體分析仍使用完整工時資料。',
  })

  const indexes = buildMasterIndexes(input.projectMasters, input.maintenanceMasters)
  const workModuleKeysByCode = buildWorkModuleKeysByCode(input.workRecords)
  const allWorkModuleKeys = new Set(input.workRecords.map((record) => record.moduleKey).filter(Boolean))
  const scopedItems: PresentationWhitelistItem[] = []

  for (const item of projectContent.items) {
    if (item.itemType !== 'main' && item.itemType !== 'child') continue
    const projectName = findProjectContentName(item)
    const resolved = resolveScopeMatch(item, projectName, indexes, workModuleKeysByCode, issues)
    if (resolved.moduleKey && !allWorkModuleKeys.has(resolved.moduleKey)) {
      issues.push(makeIssue(
        'PRESENTATION_SCOPE_WORK_HOURS_UNMATCHED',
        'warning',
        `項次 ${item.normalizedItemNo}「${projectName}」模組「${resolved.moduleKey}」未在工時明細精確命中。`,
        item,
        projectName,
        'module key did not match work records',
        resolved
      ))
    }
    scopedItems.push(makeWhitelistItem(item, projectName, resolved))
  }

  const mainItems = scopedItems.filter((item) => item.itemType === 'main')
  const childItems = scopedItems.filter((item) => item.itemType === 'child')
  for (const child of childItems) {
    issues.push({
      code: 'PRESENTATION_SCOPE_CHILD_MERGED',
      severity: 'info',
      itemNo: child.itemNo,
      sourceRow: child.sourceRow,
      projectCode: child.projectCode,
      projectName: child.projectName,
      matchedName: child.matchedName,
      stableItemId: child.stableItemId,
      moduleKey: child.moduleKey,
      reason: 'child item remains in parent project result context',
      message: `子項 ${child.itemNo}「${child.projectName}」將併入主項 ${child.parentItemNo} 的成果脈絡。`,
    })
  }

  const allowedStableItemIds = new Set(scopedItems.map((item) => item.stableItemId))
  return {
    items: scopedItems,
    mainItems,
    childItems,
    orderedMainItemIds: mainItems.map((item) => item.itemNo),
    allowedStableItemIds,
    issues,
  }
}

export function presentationScopeIssuesToValidationIssues(
  issues: readonly PresentationScopeIssue[]
): ValidationIssue[] {
  return issues.map(toValidationIssue)
}

export function buildPresentationScopeModuleToItemNo(
  scope: PresentationScope | undefined
): Map<string, string> {
  const result = new Map<string, string>()
  if (!scope) return result
  for (const item of scope.items) {
    if (!item.moduleKey) continue
    if (!result.has(item.moduleKey)) result.set(item.moduleKey, item.itemNo)
  }
  return result
}

export function applyPresentationScopeToProjectItems(
  projectItems: readonly ProjectItem[],
  scope: PresentationScope | undefined
): ProjectItem[] {
  if (!scope || scope.items.length === 0) return [...projectItems]
  const scopedContentByItemNo = new Map(scope.items.map((item) => [item.itemNo, item.content]))
  return projectItems
    .filter((item) => scopedContentByItemNo.has(item.normalizedItemNo))
    .map((item) => scopedContentByItemNo.get(item.normalizedItemNo) ?? item)
}
