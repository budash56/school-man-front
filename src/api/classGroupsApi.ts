import { apiClient } from './apiClient'
import { type PaginatedResult } from '../types/pagination'

export type ClassGroup = {
  classGroupId: number
  schoolYearId: number
  gradeLevel: number
  section: string
  code?: string
  defaultClassroomId?: number | null
}

export type ClassGroupsQuery = {
  schoolYearId?: number
  gradeLevel?: number
  page?: number
  pageSize?: number
}

export type ManualAssignClassGroupPayload = {
  schoolYearId: number
  gradeLevel: number
  section: string
  classroomId: number
  enrollmentIds: number[]
  fixedLocation?: boolean
}

export type ManualAssignClassGroupResult = {
  classGroup: ClassGroup
  studentsAssigned: number
  capacity: number
  capacityWarning: boolean
  fixedLocationApplied: boolean
}

export type UpdateClassGroupClassroomPayload = {
  classroomId: number
  fixedLocation?: boolean
}

export type UpdateClassGroupClassroomResult = ManualAssignClassGroupResult

export const classGroupsApi = {
  list(params: ClassGroupsQuery) {
    return apiClient.get<PaginatedResult<ClassGroup>>('/class-groups', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        page: params.page,
        pageSize: params.pageSize,
      },
    })
  },
  manualAssign(payload: ManualAssignClassGroupPayload) {
    return apiClient.post<ManualAssignClassGroupResult>('/class-groups/manual-assign', payload)
  },
  updateClassroom(classGroupId: number, payload: UpdateClassGroupClassroomPayload) {
    return apiClient.patch<UpdateClassGroupClassroomResult>(`/class-groups/${classGroupId}/classroom`, payload)
  },
}
