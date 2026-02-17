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
}
