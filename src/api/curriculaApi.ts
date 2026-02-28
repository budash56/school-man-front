import { apiClient } from './apiClient'

export type CurriculumSubject = {
  subjectId: number
  subjectCode?: string
  name: string
}

export type CurriculumItem = {
  curriculumItemId: number
  curriculumId?: number
  subjectId: number
  weeklyHours: number
  doubleSessionRequired: boolean
  notes: string | null
  subject?: CurriculumSubject
}

export type Curriculum = {
  curriculumId: number
  gradeLevel: number
  trackName?: string | null
  specializationAreaId?: number | null
  specializationArea?: {
    areaId: number
    name: string
    code: string | null
    isSpecialization?: boolean
  } | null
  name: string
  isActive: boolean
  createdAt: string | null
  items: CurriculumItem[]
}

export type CurriculaQuery = {
  gradeLevel?: number
  active?: boolean
}

export type CreateCurriculumItemPayload = {
  subjectId: number
  weeklyHours?: number
  doubleSessionRequired?: boolean
  notes?: string
}

export type CreateCurriculumPayload = {
  gradeLevel: number
  trackName?: string
  specializationAreaId?: number
  name: string
  isActive?: boolean
  items: CreateCurriculumItemPayload[]
}

export const curriculaApi = {
  list(params: CurriculaQuery = {}) {
    return apiClient.get<Curriculum[]>('/curricula', {
      query: {
        gradeLevel: params.gradeLevel,
        active: params.active,
      },
    })
  },
  create(payload: CreateCurriculumPayload) {
    return apiClient.post<Curriculum>('/curricula', payload)
  },
  getById(curriculumId: number) {
    return apiClient.get<Curriculum>(`/curricula/${curriculumId}`)
  },
  linkSpecializationArea(curriculumId: number, specializationAreaId: number) {
    return apiClient.patch<Curriculum>(`/curricula/${curriculumId}/specialization-area`, {
      specializationAreaId,
    })
  },
}
