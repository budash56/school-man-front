import { apiClient } from './apiClient'

export type DashboardMetricsQuery = {
  schoolYearId?: number
  gradeLevel?: number
  classGroupId?: number
  courseId?: number
}

export type AttendanceMetricSummary = {
  total: number
  present: number
  absent: number
  excused: number
  absenceRate: number
}

export type AcademicMetricSummary = {
  total: number
  average: number
  low: number
  students: number
  lowRate: number
}

export type DashboardMetrics = {
  schoolYearId: number | null
  attendance: AttendanceMetricSummary & {
    byClassGroup: Array<
      AttendanceMetricSummary & {
        classGroupId: number
        label: string
      }
    >
  }
  academic: AcademicMetricSummary & {
    byCourse: Array<
      AcademicMetricSummary & {
        courseId: number
        classGroupId: number
        label: string
      }
    >
    bySubject: Array<
      AcademicMetricSummary & {
        subjectCode: string
        label: string
      }
    >
    byTeacher: Array<
      AcademicMetricSummary & {
        teacherId: string
        label: string
        courses: number
      }
    >
  }
  teacherCourses: Array<{
    courseId: number
    classGroupId: number
    gradeLevel: number
    section: string
    subjectCode: string
    subjectName: string
  }>
}

export const dashboardsApi = {
  metrics(params: DashboardMetricsQuery) {
    return apiClient.get<DashboardMetrics>('/dashboards/metrics', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        classGroupId: params.classGroupId,
        courseId: params.courseId,
      },
    })
  },
}
