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
}
