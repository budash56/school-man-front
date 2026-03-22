import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type PlanillaColumn = {
  key: string
  group: string
  label: string
  type: string
}

export type PlanillaRowStatus = 'pending_id' | 'resolved' | 'retired'

export type PlanillaRow = {
  rowId: string
  order: number
  studentName: string
  normalizedName: string
  note: string | null
  retired: boolean
  nationalId: string | null
  studentId: number | null
  status: PlanillaRowStatus
  cells: Record<string, string>
}

export type PlanillaSheet = {
  planillaSheetId: number
  schoolYearId: number
  classGroupId: number | null
  gradeLevel: number
  section: string
  groupCode: string
  sourceSheet: string
  sourceFileName: string | null
  templateKey: string
  title: string
  metadata: Record<string, unknown>
  columns: PlanillaColumn[]
  rows: PlanillaRow[]
  isActive: boolean
  importedById: string | null
  importedAt: string | null
  updatedAt: string | null
}

export type PlanillasQuery = {
  schoolYearId?: number
  gradeLevel?: number
  groupCode?: string
  page?: number
  pageSize?: number
}

export type ImportPlanillasPayload = {
  schoolYearId: number
  replaceExisting?: boolean
  file: File
}

export type ImportPlanillasResult = {
  imported: number
  replaced: number
  skipped: number
  unmatchedGroups: string[]
  sheets: PlanillaSheet[]
}

export type UpdatePlanillaPayload = {
  title?: string
  metadata?: Record<string, unknown>
  rows?: Array<Record<string, unknown>>
}

export type FinalizePlanillaPayload = {
  allowPartial?: boolean
}

export type FinalizePlanillaResult = {
  planillaSheetId: number
  resolved: number
  retired: number
  unresolved: string[]
}

export const planillasApi = {
  list(params: PlanillasQuery = {}) {
    return apiClient.get<PaginatedResult<PlanillaSheet>>('/planillas', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        groupCode: params.groupCode,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  getById(planillaSheetId: number) {
    return apiClient.get<PlanillaSheet>(`/planillas/${planillaSheetId}`)
  },
  import(payload: ImportPlanillasPayload) {
    const formData = new FormData()
    formData.append('schoolYearId', String(payload.schoolYearId))
    formData.append('replaceExisting', String(payload.replaceExisting ?? true))
    formData.append('file', payload.file)
    return apiClient.postForm<ImportPlanillasResult>('/planillas/import', formData)
  },
  update(planillaSheetId: number, payload: UpdatePlanillaPayload) {
    return apiClient.patch<PlanillaSheet>(`/planillas/${planillaSheetId}`, payload)
  },
  finalize(planillaSheetId: number, payload: FinalizePlanillaPayload = {}) {
    return apiClient.post<FinalizePlanillaResult>(`/planillas/${planillaSheetId}/finalize`, payload)
  },
}
