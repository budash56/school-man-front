import { apiClient } from './apiClient'

export type ScannedPlanillaFile = {
  filename: string
  contentType: string
  sizeBytes: number
}

export type ScannedPlanillaMetadata = {
  gradeLevel: number | null
  groupCode: string | null
  subjectName: string | null
  teacherName: string | null
}

export type ScannedPlanillaRow = {
  order: number
  studentName: string | null
  nationalId: string | null
  cells: Record<string, string>
}

export type ScannedPlanillaResponse = {
  status: string
  templateKey: string
  message: string
  uploadedFile: ScannedPlanillaFile
  metadata: ScannedPlanillaMetadata
  rows: ScannedPlanillaRow[]
  warnings: string[]
}

export type ScannedTimetableTeacher = {
  teacherId: string
  fullName: string
}

export type ScannedTimetableClassGroup = {
  groupCode: string
  gradeLevel: number
  section: string
}

export type ScannedTimetableSubject = {
  subjectCode: string
  name: string
}

export type ScannedTimetableSlot = {
  period: number
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type ScannedTimetableAssignment = {
  teacherId: string
  teacherName: string
  subjectCode: string
  subjectName: string
  groupCode: string
  gradeLevel: number
  section: string
  period: number
  dayOfWeek: number
  startTime: string
  endTime: string
}

export type ScannedTimetableResponse = {
  status: string
  message: string
  uploadedFile: ScannedPlanillaFile
  teachers: ScannedTimetableTeacher[]
  classGroups: ScannedTimetableClassGroup[]
  subjects: ScannedTimetableSubject[]
  slots: ScannedTimetableSlot[]
  assignments: ScannedTimetableAssignment[]
  warnings: string[]
}

export type ScannedCurriculumScheduleItem = {
  subjectCode: string
  subjectName: string
  weeklyHours: number
}

export type ScannedCurriculumScheduleCurriculum = {
  gradeLevel: number
  trackName: string | null
  specializationName: string | null
  groupCodes: string[]
  weeklyHours: number
  items: ScannedCurriculumScheduleItem[]
}

export type ScannedCurriculumScheduleSession = {
  groupCode: string
  gradeLevel: number
  section: string
  subjectCode: string
  subjectName: string
  period: number
  dayOfWeek: number
  isContinuation: boolean
}

export type ScannedCurriculumScheduleResponse = {
  status: string
  message: string
  uploadedFile: ScannedPlanillaFile
  classGroups: ScannedTimetableClassGroup[]
  subjects: ScannedTimetableSubject[]
  curricula: ScannedCurriculumScheduleCurriculum[]
  sessions: ScannedCurriculumScheduleSession[]
  warnings: string[]
}

export const scannerApi = {
  scanPlanilla(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postForm<ScannedPlanillaResponse>('/scanner/planilla', formData)
  },
  scanTimetable(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postForm<ScannedTimetableResponse>('/scanner/timetable', formData)
  },
  scanCurriculumSchedule(file: File) {
    const formData = new FormData()
    formData.append('file', file)
    return apiClient.postForm<ScannedCurriculumScheduleResponse>('/scanner/curriculum-schedule', formData)
  },
}
