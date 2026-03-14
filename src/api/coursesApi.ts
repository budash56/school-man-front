import { apiClient } from './apiClient'

export type CourseSummary = {
  courseId: number
  courseInstanceId: number
  classGroupId: number
  teacherId: number
  schoolYearId: number
  gradeLevel: number
  section: string
  classGroupCode: string
  subjectCode: string
  subjectName: string
  teacherName: string | null
  createdAt: string | null
}

export type CoursesQuery = {
  schoolYearId?: number
  gradeLevel?: number
  section?: string
  teacherId?: number
}

export type CreateCoursePayload = {
  courseInstanceId: number
  classGroupId: number
  teacherId: number
}

export type UpdateCoursePayload = Partial<CreateCoursePayload>

export const coursesApi = {
  list(params: CoursesQuery = {}) {
    return apiClient.get<CourseSummary[]>('/courses', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        section: params.section,
        teacherId: params.teacherId,
      },
    })
  },
  create(payload: CreateCoursePayload) {
    return apiClient.post<CourseSummary>('/courses', payload)
  },
  update(courseId: number, payload: UpdateCoursePayload) {
    return apiClient.patch<CourseSummary>(`/courses/${courseId}`, payload)
  },
  remove(courseId: number) {
    return apiClient.del<{ deleted: true }>(`/courses/${courseId}`)
  },
}
