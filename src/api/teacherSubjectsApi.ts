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

const normalizeTeacherSubject = (item: TeacherSubject): TeacherSubject => ({
  ...item,
  teacherSubjectId: Number(item.teacherSubjectId),
  subjectId: Number(item.subjectId),
})

export const teacherSubjectsApi = {
  async list(params: TeacherSubjectsQuery = {}) {
    const response = await apiClient.get<TeacherSubject[]>('/teacher-subjects', {
      query: {
        teacherId: params.teacherId,
        subjectId: params.subjectId,
      },
    })
    return response.map(normalizeTeacherSubject)
  },
  async create(payload: CreateTeacherSubjectPayload) {
    const response = await apiClient.post<TeacherSubject>('/teacher-subjects', payload)
    return normalizeTeacherSubject(response)
  },
  remove(teacherSubjectId: number) {
    return apiClient.del(`/teacher-subjects/${teacherSubjectId}`)
  },
}
