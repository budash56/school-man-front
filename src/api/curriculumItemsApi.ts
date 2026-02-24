import { apiClient } from './apiClient'
import { type CurriculumItem } from './curriculaApi'

export type CreateCurriculumItemPayload = {
  curriculumId: number
  subjectId: number
  weeklyHours?: number
  doubleSessionRequired?: boolean
  notes?: string
}

export type UpdateCurriculumItemPayload = {
  weeklyHours?: number
  doubleSessionRequired?: boolean
  notes?: string | null
}

export const curriculumItemsApi = {
  create(payload: CreateCurriculumItemPayload) {
    return apiClient.post<CurriculumItem>('/curriculum-items', payload)
  },
  update(curriculumItemId: number, payload: UpdateCurriculumItemPayload) {
    return apiClient.patch<CurriculumItem>(`/curriculum-items/${curriculumItemId}`, payload)
  },
  remove(curriculumItemId: number) {
    return apiClient.del<{ deleted: true }>(`/curriculum-items/${curriculumItemId}`)
  },
}
