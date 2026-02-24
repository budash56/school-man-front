import { apiClient } from './apiClient'
import { type Subject } from './subjectsApi'

export type TeacherSubject = {
  teacherSubjectId: number
  teacherId: string
  subjectId: number
  createdAt: string | null
  subject?: Subject
}

export type TeacherSubjectsQuery = {
  teacherId?: string
  subjectId?: number
}

export type CreateTeacherSubjectPayload = {
  teacherId: string
  subjectId: number
}

export const teacherSubjectsApi = {
  list(params: TeacherSubjectsQuery = {}) {
    return apiClient.get<TeacherSubject[]>('/teacher-subjects', {
      query: {
        teacherId: params.teacherId,
        subjectId: params.subjectId,
      },
    })
  },
  create(payload: CreateTeacherSubjectPayload) {
    return apiClient.post<TeacherSubject>('/teacher-subjects', payload)
  },
  remove(teacherSubjectId: number) {
    return apiClient.del(`/teacher-subjects/${teacherSubjectId}`)
  },
}
