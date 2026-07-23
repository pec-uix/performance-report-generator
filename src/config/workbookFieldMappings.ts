/**
 * workbookFieldMappings.ts
 * 欄位盤點與欄位映射設定。
 *
 * 設計原則：
 * 1. 所有欄位名稱在比對前均透過 normalizeHeaderName() 標準化（全半形、換行、多餘空白）。
 * 2. 嚴格使用完整相符，禁止模糊字串相似度、禁止 includes 自動猜欄位。
 * 3. 若尚未確認實際欄位名稱，configuredStatus 設為 'pending-confirmation'。
 * 4. 未設定的欄位在分析預覽中顯示「尚未設定」。
 */

/** 欄位映射設定 */
export interface FieldAliasConfig {
  /** 程式內部使用的標準欄位名稱 */
  canonicalField: string
  /** 是否為必要欄位 */
  required: boolean
  /**
   * 所有可能的欄位別名（含 canonicalField 本身）。
   * 比對時先經 normalizeHeaderName() 再進行完整字串比較。
   */
  aliases: string[]
  /** 選用說明文字 */
  description?: string
  /**
   * 'configured'            - 已確認欄位名稱
   * 'pending-confirmation'  - 已提供合理預設別名，尚未與實際 Excel 核對
   * 'not-configured'        - 尚未提供別名，分析預覽顯示「尚未設定」
   */
  configuredStatus: 'configured' | 'pending-confirmation' | 'not-configured'
}

/** 單一工作表的所有欄位映射；key 為 canonicalField */
export type WorkbookFieldMapping = Record<string, FieldAliasConfig>

// ─── 工時分析(自助) ─────────────────────────────────────────────────────────

export const WORK_HOURS_FIELD_MAPPING: WorkbookFieldMapping = {
  workDate: {
    canonicalField: 'workDate',
    required: true,
    aliases: ['日期', '工作日期', '作業日期', '填報日期', 'Date', '工作日'],
    description: '工作日期欄（YYYY-MM-DD 或 YYYY/M/D）',
    configuredStatus: 'pending-confirmation',
  },
  employeeId: {
    canonicalField: 'employeeId',
    required: false,
    aliases: ['員工編號', '人員編號', '工號', '員工號', 'Employee ID'],
    description: '員工編號欄；若無此欄則改用姓名作為識別鍵',
    configuredStatus: 'pending-confirmation',
  },
  employeeName: {
    canonicalField: 'employeeName',
    required: false,
    aliases: ['員工姓名', '姓名', '人員姓名', 'Name', '姓名(Name)'],
    description: '員工姓名欄',
    configuredStatus: 'pending-confirmation',
  },
  hours: {
    canonicalField: 'hours',
    required: true,
    aliases: ['工時', '作業時數', '工作時數', '時數', '投入工時', '投入工時(H)'],
    description: '當日投入工時（小時）',
    configuredStatus: 'pending-confirmation',
  },
  projectCode: {
    canonicalField: 'projectCode',
    required: false,
    aliases: ['專案代碼', '案號', '項目代碼', '專案碼', '專案號'],
    description: '對應專案清單的鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  projectName: {
    canonicalField: 'projectName',
    required: false,
    aliases: ['專案名稱', '項目名稱', '案名', '專案'],
    description: '專案名稱（作為備用識別鍵）',
    configuredStatus: 'pending-confirmation',
  },
  maintenanceCode: {
    canonicalField: 'maintenanceCode',
    required: false,
    aliases: ['維運代碼', '維運碼', '維運項目代碼'],
    description: '對應維運清單的鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  maintenanceName: {
    canonicalField: 'maintenanceName',
    required: false,
    aliases: ['維運名稱', '維運項目', '維運'],
    description: '維運項目名稱（作為備用識別鍵）',
    configuredStatus: 'pending-confirmation',
  },
}

// ─── 專案清單 ────────────────────────────────────────────────────────────────

export const PROJECT_MASTER_FIELD_MAPPING: WorkbookFieldMapping = {
  itemNo: {
    canonicalField: 'itemNo',
    required: false,
    aliases: ['項次', '序號', '編號', 'No'],
    description: '對應 Phase 2 ProjectItem 的項次欄',
    configuredStatus: 'pending-confirmation',
  },
  projectCode: {
    canonicalField: 'projectCode',
    required: false,
    aliases: ['專案代碼', '代碼', '案號', '專案號'],
    description: '用於與工時記錄關聯的鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  projectName: {
    canonicalField: 'projectName',
    required: false,
    aliases: ['專案名稱', '名稱', '案名'],
    description: '專案名稱',
    configuredStatus: 'pending-confirmation',
  },
}

// ─── 維運清單 ────────────────────────────────────────────────────────────────

export const MAINTENANCE_FIELD_MAPPING: WorkbookFieldMapping = {
  maintenanceCode: {
    canonicalField: 'maintenanceCode',
    required: false,
    aliases: ['維運代碼', '代碼', '維運碼', '維運號'],
    description: '用於與工時記錄關聯的鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  maintenanceName: {
    canonicalField: 'maintenanceName',
    required: false,
    aliases: ['維運名稱', '名稱', '維運項目'],
    description: '維運項目名稱',
    configuredStatus: 'pending-confirmation',
  },
}

// ─── 人員清單 ────────────────────────────────────────────────────────────────

export const PERSON_FIELD_MAPPING: WorkbookFieldMapping = {
  employeeId: {
    canonicalField: 'employeeId',
    required: false,
    aliases: ['員工編號', '工號', '人員編號', '員工號'],
    description: '員工識別鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  employeeName: {
    canonicalField: 'employeeName',
    required: false,
    aliases: ['員工姓名', '姓名', '人員姓名'],
    description: '員工姓名',
    configuredStatus: 'pending-confirmation',
  },
  department: {
    canonicalField: 'department',
    required: false,
    aliases: ['部門', '單位', '部門名稱'],
    description: '所屬部門',
    configuredStatus: 'pending-confirmation',
  },
  monthlyCapacityHours: {
    canonicalField: 'monthlyCapacityHours',
    required: false,
    aliases: ['月標準工時', '月工時', '每月標準工時', '標準工時'],
    description: '月度標準容量工時；用於計算人月',
    configuredStatus: 'pending-confirmation',
  },
  hourlyCost: {
    canonicalField: 'hourlyCost',
    required: false,
    aliases: ['時薪', '每小時成本', '工時費率'],
    description: '每小時人力成本；僅有明確口徑時才用於投入產出計算',
    configuredStatus: 'not-configured',
  },
}

// ─── 收入工時彙總 ────────────────────────────────────────────────────────────

export const REVENUE_FIELD_MAPPING: WorkbookFieldMapping = {
  itemNo: {
    canonicalField: 'itemNo',
    required: false,
    aliases: ['項次', '序號'],
    description: '對應 Phase 2 ProjectItem 的項次欄',
    configuredStatus: 'pending-confirmation',
  },
  projectCode: {
    canonicalField: 'projectCode',
    required: false,
    aliases: ['專案代碼', '案號', '代碼'],
    description: '用於關聯專案的鍵值欄',
    configuredStatus: 'pending-confirmation',
  },
  revenueAmount: {
    canonicalField: 'revenueAmount',
    required: false,
    aliases: ['收入', '金額', '收入金額', '專案收入'],
    description: '收入金額；僅有明確口徑時才用於績效計算',
    configuredStatus: 'pending-confirmation',
  },
  revenueType: {
    canonicalField: 'revenueType',
    required: false,
    aliases: ['收入類型', '類型', '收入別'],
    description: '收入類型說明',
    configuredStatus: 'not-configured',
  },
  periodType: {
    canonicalField: 'periodType',
    required: false,
    aliases: ['期間類型', '期別', '季別', '期間'],
    description: '是否為年度/季度收入',
    configuredStatus: 'not-configured',
  },
}

/** 所有工作表欄位映射的彙整 */
export const ALL_SHEET_FIELD_MAPPINGS = {
  workHours: WORK_HOURS_FIELD_MAPPING,
  projectMaster: PROJECT_MASTER_FIELD_MAPPING,
  maintenance: MAINTENANCE_FIELD_MAPPING,
  person: PERSON_FIELD_MAPPING,
  revenue: REVENUE_FIELD_MAPPING,
} as const

export type SheetMappingKey = keyof typeof ALL_SHEET_FIELD_MAPPINGS
