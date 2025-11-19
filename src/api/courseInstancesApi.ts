import { apiClient } from './apiClient'

export type CourseInstance = {
  courseInstanceId: number
  subjectId: number
  subjectCode: string
  subjectAreaCode: string | null
  subjectName: string
  gradeLevel: number
  weeklyHours: number
  courseCode: string
  courseName: string
  isActive: boolean | null
  schoolYearId: number
  schoolYearName: string
}

export type CourseInstancesQuery = {
  schoolYearId?: number
  gradeLevel?: number
  subjectId?: number
  q?: string
}

export type CreateCourseInstancePayload = {
  subjectId: number
  gradeLevel: number
  schoolYearId: number
  courseName: string
  courseCode?: string
  weeklyHours?: number
  isActive?: boolean
}

export const courseInstancesApi = {
  list(params: CourseInstancesQuery = {}) {
    return apiClient.get<CourseInstance[]>('/course-instances', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        subjectId: params.subjectId,
        q: params.q,
      },
    })
  },
  create(payload: CreateCourseInstancePayload) {
    return apiClient.post<CourseInstance>('/course-instances', payload)
  },
  remove(courseInstanceId: number) {
    return apiClient.del(`/course-instances/${courseInstanceId}`)
  },
}
