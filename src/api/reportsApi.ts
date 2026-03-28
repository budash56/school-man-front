import { apiClient } from './apiClient'

export type RecordPeriod = 1 | 2 | 3 | 4

export type StudentRecordReport = {
  printId: number
  schoolYear: {
    schoolYearId: number
    name: string
  }
  student: {
    studentId: number
    nationalId: string
    fullName: string
    gradeLevel: number | null
    groupCode: string | null
  }
  periods: RecordPeriod[]
  subjects: Array<{
    planillaSheetId: number
    subjectName: string
    teacherName: string | null
    groupCode: string
    periods: Array<{
      period: RecordPeriod
      procedural: string
      cognitive: string
      attitudinal: string
      complete: boolean
      passing: boolean
    }>
    complete: boolean
    passing: boolean
  }>
  allSelectedPeriodsComplete: boolean
}

export type EligibilityReport = {
  printId: number
  schoolYear: {
    schoolYearId: number
    name: string
  }
  gradeLevel: number
  classGroup: {
    classGroupId: number
    groupCode: string
  } | null
  documentType: 'promotion' | 'graduation'
  statement: string
  eligibleCount: number
  totalStudents: number
  students: Array<{
    studentId: number
    nationalId: string
    fullName: string
    groupCode: string | null
    eligible: boolean
    missingSubjects: string[]
    missingGrades: string[]
    failingSubjects: string[]
  }>
}

export const reportsApi = {
  getStudentRecord(params: { studentId: number; schoolYearId: number; periods?: string }) {
    return apiClient.get<StudentRecordReport>('/reports/documents/student-record', {
      query: {
        studentId: params.studentId,
        schoolYearId: params.schoolYearId,
        periods: params.periods,
      },
    })
  },
  getEligibility(params: { schoolYearId: number; gradeLevel: number; classGroupId?: number }) {
    return apiClient.get<EligibilityReport>('/reports/documents/eligibility', {
      query: {
        schoolYearId: params.schoolYearId,
        gradeLevel: params.gradeLevel,
        classGroupId: params.classGroupId,
      },
    })
  },
}
