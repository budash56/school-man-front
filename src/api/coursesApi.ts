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
}
