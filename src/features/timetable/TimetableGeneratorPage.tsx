import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '../../api/apiClient'
import {
  timetableGeneratorApi,
  type CurriculumScheduleImportApplyResponse,
  type TimetableImportApplyResponse,
} from '../../api/timetableGeneratorApi'
import { scannerApi, type ScannedCurriculumScheduleResponse, type ScannedTimetableResponse } from '../../api/scannerApi'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const formatTimetableImportError = (error: unknown) => {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'No se pudo confirmar la importación.'
  }

  const details = error.details
  if (!isRecord(details)) {
    return error.message
  }

  const message = typeof details.message === 'string' ? details.message : error.message
  const conflicts = Array.isArray(details.conflicts) ? details.conflicts : []
  if (conflicts.length === 0) {
    return message
  }

  const lines = conflicts.slice(0, 30).flatMap((conflict) => {
    if (!isRecord(conflict)) {
      return []
    }
    const grade = conflict.gradeLevel ?? '?'
    const subject = conflict.subjectName ?? conflict.subjectCode ?? 'Asignatura'
    const expected = conflict.expectedWeeklyHours ?? '?'
    const groups = Array.isArray(conflict.groups) ? conflict.groups : []
    return [
      `Grado ${grade} · ${subject} · intensidad esperada ${expected}`,
      ...groups.map((group) => {
        if (!isRecord(group)) {
          return ''
        }
        const slots = Array.isArray(group.slots) ? group.slots.join(', ') : ''
        return `  ${group.groupCode ?? '?'}: ${group.weeklyHours ?? 0} horas${slots ? ` (${slots})` : ''}`
      }).filter(Boolean),
    ]
  })

  const remainder = conflicts.length > 30 ? `\n...${conflicts.length - 30} conflictos más.` : ''
  return `${message}\n${lines.join('\n')}${remainder}`
}

const TimetableGeneratorPage = () => {
  const queryClient = useQueryClient()
  const { data: schoolYears, isLoading: isLoadingYears } = useSchoolYearsQuery({})
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('')
  const [timetableImportResult, setTimetableImportResult] = useState<ScannedTimetableResponse | null>(null)
  const [timetableImportError, setTimetableImportError] = useState<string | null>(null)
  const [timetableImportApplyResult, setTimetableImportApplyResult] = useState<TimetableImportApplyResponse | null>(null)
  const [curriculumImportResult, setCurriculumImportResult] = useState<ScannedCurriculumScheduleResponse | null>(null)
  const [curriculumImportError, setCurriculumImportError] = useState<string | null>(null)
  const [curriculumImportApplyResult, setCurriculumImportApplyResult] = useState<CurriculumScheduleImportApplyResponse | null>(null)
  const [curriculumSpecializationNames, setCurriculumSpecializationNames] = useState<Record<string, string>>({})

  const schoolYearId = selectedSchoolYearId ? Number(selectedSchoolYearId) || undefined : undefined

  const curriculumSpecializationTracks = useMemo(() => {
    const tracks = new Map<string, { trackName: string; grades: number[]; groups: string[] }>()
    ;(curriculumImportResult?.curricula ?? []).forEach((curriculum) => {
      if (!curriculum.trackName || ![10, 11].includes(curriculum.gradeLevel)) {
        return
      }
      const existing = tracks.get(curriculum.trackName) ?? {
        trackName: curriculum.trackName,
        grades: [],
        groups: [],
      }
      existing.grades.push(curriculum.gradeLevel)
      existing.groups.push(...curriculum.groupCodes)
      tracks.set(curriculum.trackName, existing)
    })
    return [...tracks.values()].map((track) => ({
      ...track,
      grades: [...new Set(track.grades)].sort((a, b) => a - b),
      groups: [...new Set(track.groups)].sort(),
    }))
  }, [curriculumImportResult])

  const missingCurriculumSpecializationNames = useMemo(
    () =>
      curriculumSpecializationTracks.filter(
        (track) => !curriculumSpecializationNames[track.trackName]?.trim(),
      ),
    [curriculumSpecializationNames, curriculumSpecializationTracks],
  )

  const scanTimetableMutation = useMutation({
    mutationFn: (file: File) => scannerApi.scanTimetable(file),
    onSuccess: (result) => {
      setTimetableImportResult(result)
      setTimetableImportError(null)
      setTimetableImportApplyResult(null)
    },
    onError: (error) => {
      setTimetableImportResult(null)
      setTimetableImportError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'No se pudo leer el horario de profesores.',
      )
    },
  })

  const confirmTimetableImportMutation = useMutation({
    mutationFn: () => {
      if (!schoolYearId || !timetableImportResult) {
        throw new Error('Selecciona un año escolar y sube el horario de profesores antes de confirmar.')
      }
      return timetableGeneratorApi.confirmImport({
        schoolYearId,
        scan: {
          assignments: timetableImportResult.assignments,
        },
      })
    },
    onSuccess: (result) => {
      setTimetableImportApplyResult(result)
      setTimetableImportError(null)
      queryClient.invalidateQueries({ queryKey: ['professors', 'timetable'] })
      queryClient.invalidateQueries({ queryKey: ['courses', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['class-groups', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['timetable-slots'] })
    },
    onError: (error) => {
      setTimetableImportError(formatTimetableImportError(error))
    },
  })

  const scanCurriculumScheduleMutation = useMutation({
    mutationFn: (file: File) => scannerApi.scanCurriculumSchedule(file),
    onSuccess: (result) => {
      setCurriculumImportResult(result)
      setCurriculumImportError(null)
      setCurriculumImportApplyResult(null)
      const initialNames: Record<string, string> = {}
      result.curricula.forEach((curriculum) => {
        if (!curriculum.trackName || ![10, 11].includes(curriculum.gradeLevel)) {
          return
        }
        const scannedName = curriculum.specializationName?.trim()
        initialNames[curriculum.trackName] =
          scannedName && scannedName !== curriculum.trackName ? scannedName : ''
      })
      setCurriculumSpecializationNames(initialNames)
    },
    onError: (error) => {
      setCurriculumImportResult(null)
      setCurriculumSpecializationNames({})
      setCurriculumImportError(
        error instanceof ApiError || error instanceof Error
          ? error.message
          : 'No se pudo leer el horario de cursos.',
      )
    },
  })

  const confirmCurriculumScheduleImportMutation = useMutation({
    mutationFn: () => {
      if (!schoolYearId || !curriculumImportResult) {
        throw new Error('Selecciona un año escolar y sube el horario de cursos antes de confirmar.')
      }
      if (missingCurriculumSpecializationNames.length > 0) {
        throw new Error('Escribe el nombre de cada especialización antes de importar.')
      }
      return timetableGeneratorApi.confirmCurriculumScheduleImport({
        schoolYearId,
        scan: {
          classGroups: curriculumImportResult.classGroups,
          curricula: curriculumImportResult.curricula.map((curriculum) => {
            if (!curriculum.trackName || ![10, 11].includes(curriculum.gradeLevel)) {
              return curriculum
            }
            const specializationName = curriculumSpecializationNames[curriculum.trackName]?.trim()
            return {
              ...curriculum,
              specializationName,
            }
          }),
          warnings: curriculumImportResult.warnings,
        },
      })
    },
    onSuccess: (result) => {
      setCurriculumImportApplyResult(result)
      setCurriculumImportError(null)
      queryClient.invalidateQueries({ queryKey: ['curricula'] })
      queryClient.invalidateQueries({ queryKey: ['subjects'] })
      queryClient.invalidateQueries({ queryKey: ['class-groups', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['courses', schoolYearId] })
    },
    onError: (error) => {
      setCurriculumImportError(formatTimetableImportError(error))
    },
  })

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Stack spacing={0.5}>
        <Typography variant="h4">Horarios</Typography>
        <Typography color="text.secondary">
          Importa archivos PDF generados desde ASC Horarios. Usa primero el horario de cursos para crear la base académica y luego el horario de profesores para completar docentes, carga y clases.
        </Typography>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
        <FormControl sx={{ minWidth: 240 }}>
          <InputLabel id="school-year-select">Año escolar</InputLabel>
          <Select
            labelId="school-year-select"
            label="Año escolar"
            value={selectedSchoolYearId}
            onChange={(event) => setSelectedSchoolYearId(event.target.value as string)}
          >
            {(schoolYears ?? []).map((year) => (
              <MenuItem key={year.schoolYearId} value={year.schoolYearId}>
                {year.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        {isLoadingYears ? <CircularProgress size={24} /> : null}
      </Stack>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6">Importar horario de cursos</Typography>
              <Typography variant="body2" color="text.secondary">
                Carga el PDF de ASC Horarios organizado por grupos. Esta importación crea grupos, asignaturas, currículos e instancias de curso; las áreas académicas deben revisarse o crearse después.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Recomendación: el archivo debe mostrar cada grupo con sus materias en negrilla, respetar dobles espacios o bloques dobles, y mantener la misma cantidad de sesiones por grado cuando el currículo es común.
              </Typography>
            </Box>
            <Box>
              <Button component="label" variant="outlined" disabled={scanCurriculumScheduleMutation.isPending}>
                {scanCurriculumScheduleMutation.isPending ? 'Leyendo PDF...' : 'Subir PDF'}
                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) {
                      scanCurriculumScheduleMutation.mutate(file)
                    }
                  }}
                />
              </Button>
            </Box>
          </Stack>

          {curriculumImportError ? (
            <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{curriculumImportError}</Alert>
          ) : null}
          {curriculumImportResult ? (
            <Stack spacing={2}>
              <Alert severity="info">{curriculumImportResult.message}</Alert>
              {curriculumImportResult.warnings.length > 0 ? (
                <Alert severity="warning" sx={{ whiteSpace: 'pre-line' }}>
                  {curriculumImportResult.warnings.join('\n')}
                </Alert>
              ) : null}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`${curriculumImportResult.classGroups.length} grupos`} />
                <Chip label={`${curriculumImportResult.subjects.length} asignaturas`} />
                <Chip label={`${curriculumImportResult.curricula.length} currículos`} />
                <Chip label={`${curriculumImportResult.sessions.length} sesiones`} />
              </Stack>
              {curriculumSpecializationTracks.length > 0 ? (
                <Stack spacing={1.5}>
                  <Typography variant="subtitle2">Especializaciones</Typography>
                  <Stack spacing={1}>
                    {curriculumSpecializationTracks.map((track) => (
                      <TextField
                        key={track.trackName}
                        label={`Especialización ${track.trackName}`}
                        value={curriculumSpecializationNames[track.trackName] ?? ''}
                        onChange={(event) =>
                          setCurriculumSpecializationNames((current) => ({
                            ...current,
                            [track.trackName]: event.target.value,
                          }))
                        }
                        helperText={`Grados ${track.grades.join(' y ')} · grupos ${track.groups.join(', ')}`}
                        size="small"
                        fullWidth
                      />
                    ))}
                  </Stack>
                </Stack>
              ) : null}
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Grado</TableCell>
                      <TableCell>Especialización</TableCell>
                      <TableCell>Grupos</TableCell>
                      <TableCell>Horas</TableCell>
                      <TableCell>Asignaturas</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {curriculumImportResult.curricula.map((curriculum) => (
                      <TableRow key={`${curriculum.gradeLevel}-${curriculum.trackName ?? 'base'}`}>
                        <TableCell>{curriculum.gradeLevel}</TableCell>
                        <TableCell>
                          {curriculum.trackName
                            ? (curriculumSpecializationNames[curriculum.trackName]?.trim() || curriculum.trackName)
                            : '-'}
                        </TableCell>
                        <TableCell>{curriculum.groupCodes.join(', ')}</TableCell>
                        <TableCell>{curriculum.weeklyHours}</TableCell>
                        <TableCell>
                          {curriculum.items.map((item) => `${item.subjectName} (${item.weeklyHours})`).join(', ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => confirmCurriculumScheduleImportMutation.mutate()}
                  disabled={
                    !schoolYearId ||
                    confirmCurriculumScheduleImportMutation.isPending ||
                    curriculumImportResult.warnings.length > 0 ||
                    missingCurriculumSpecializationNames.length > 0
                  }
                >
                  {confirmCurriculumScheduleImportMutation.isPending ? 'Importando...' : 'Confirmar horario de cursos'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Si hay advertencias o especializaciones sin nombre, corrige la información antes de confirmar.
                </Typography>
              </Stack>
              {curriculumImportApplyResult ? (
                <Alert severity="success">{curriculumImportApplyResult.message}</Alert>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h6">Importar horario de profesores</Typography>
              <Typography variant="body2" color="text.secondary">
                Carga el PDF de ASC Horarios organizado por docentes. Esta importación agrega profesores, los relaciona con cursos, registra su carga docente y crea las clases/franjas detectadas.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Recomendación: usa el archivo oficial exportado desde ASC Horarios, con nombres de profesores legibles, grupos completos y sin cambios manuales en los códigos de curso o grupo.
              </Typography>
            </Box>
            <Box>
              <Button
                component="label"
                variant="outlined"
                disabled={scanTimetableMutation.isPending}
              >
                {scanTimetableMutation.isPending ? 'Leyendo PDF...' : 'Subir PDF'}
                <input
                  hidden
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    event.target.value = ''
                    if (file) {
                      scanTimetableMutation.mutate(file)
                    }
                  }}
                />
              </Button>
            </Box>
          </Stack>

          {timetableImportError ? (
            <Alert severity="error" sx={{ whiteSpace: 'pre-line' }}>{timetableImportError}</Alert>
          ) : null}
          {timetableImportResult ? (
            <Stack spacing={2}>
              <Alert severity="info">{timetableImportResult.message}</Alert>
              {timetableImportResult.warnings.length > 0 ? (
                <Alert severity="warning">{timetableImportResult.warnings.join(' ')}</Alert>
              ) : null}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`${timetableImportResult.teachers.length} profesores`} />
                <Chip label={`${timetableImportResult.classGroups.length} grupos`} />
                <Chip label={`${timetableImportResult.subjects.length} asignaturas`} />
                <Chip label={`${timetableImportResult.slots.length} franjas`} />
                <Chip label={`${timetableImportResult.assignments.length} clases`} />
              </Stack>
              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 320 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Profesor</TableCell>
                      <TableCell>Asignatura</TableCell>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Día</TableCell>
                      <TableCell>Periodo</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {timetableImportResult.assignments.slice(0, 80).map((assignment, index) => (
                      <TableRow
                        key={`${assignment.teacherId}-${assignment.groupCode}-${assignment.dayOfWeek}-${assignment.period}-${index}`}
                      >
                        <TableCell>{assignment.teacherName}</TableCell>
                        <TableCell>{assignment.subjectName}</TableCell>
                        <TableCell>{assignment.groupCode}</TableCell>
                        <TableCell>{DAYS_OF_WEEK[assignment.dayOfWeek - 1] ?? assignment.dayOfWeek}</TableCell>
                        <TableCell>{`${assignment.period} · ${assignment.startTime.slice(0, 5)}-${assignment.endTime.slice(0, 5)}`}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              {timetableImportResult.assignments.length > 80 ? (
                <Typography variant="caption" color="text.secondary">
                  Mostrando 80 de {timetableImportResult.assignments.length} clases detectadas.
                </Typography>
              ) : null}
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
                <Button
                  variant="contained"
                  color="warning"
                  onClick={() => confirmTimetableImportMutation.mutate()}
                  disabled={!schoolYearId || confirmTimetableImportMutation.isPending}
                >
                  {confirmTimetableImportMutation.isPending ? 'Importando...' : 'Confirmar horario de profesores'}
                </Button>
                <Typography variant="caption" color="text.secondary">
                  Esta importación agrega relaciones y clases faltantes; no reemplaza los datos creados por el horario de cursos.
                </Typography>
              </Stack>
              {timetableImportApplyResult ? (
                <Alert severity="success">
                  {timetableImportApplyResult.message} Contraseña temporal para profesores nuevos: {timetableImportApplyResult.defaultTeacherPassword}
                </Alert>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  )
}

export default TimetableGeneratorPage
