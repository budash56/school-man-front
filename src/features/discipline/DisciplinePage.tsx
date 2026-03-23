import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew'
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { useClassGroupsQuery } from '../classGroups/useClassGroupsQuery'
import { useStudentsByClassGroup } from '../schoolYears/useStudentsByClassGroup'
import { useStudentDiscipline } from '../students/useStudentDiscipline'
import { coursesApi } from '../../api/coursesApi'
import { useAuth } from '../auth/AuthContext'
import {
  disciplinaryRecordsApi,
  type DisciplinaryCategory,
} from '../../api/disciplinaryRecordsApi'

const disciplinaryCategoryOptions: Array<{
  value: DisciplinaryCategory
  label: string
}> = [
  { value: 'green', label: 'Green' },
  { value: 'yellow', label: 'Yellow' },
  { value: 'red', label: 'Red' },
  { value: 'last_notice', label: 'Last notice' },
]

const getGroupLabel = (
  group?: { code?: string; gradeLevel?: number; section?: string },
  fallback?: number,
) => {
  if (!group) {
    return fallback ? String(fallback) : 'Grupo'
  }
  if (group.code) {
    return group.code
  }
  if (group.gradeLevel !== undefined && group.section) {
    return `${group.gradeLevel}° ${group.section}`
  }
  return group.section ?? (fallback ? `Grupo ${fallback}` : 'Grupo')
}

export const DisciplinePage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('')
  const [selectedClassGroupId, setSelectedClassGroupId] = useState('')
  const [currentStudentIndex, setCurrentStudentIndex] = useState(0)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [createDraft, setCreateDraft] = useState<{
    category: DisciplinaryCategory
    dateHappened: string
    description: string
    expiresAt: string
  }>({
    category: 'yellow',
    dateHappened: new Date().toISOString().slice(0, 10),
    description: '',
    expiresAt: '',
  })

  const {
    data: schoolYears,
    isLoading: isLoadingYears,
    isError: isYearError,
    error: yearError,
  } = useSchoolYearsQuery({})

  useEffect(() => {
    if (!selectedSchoolYearId && schoolYears && schoolYears.length > 0) {
      setSelectedSchoolYearId(String(schoolYears[0].schoolYearId))
    }
  }, [selectedSchoolYearId, schoolYears])

  useEffect(() => {
    setSelectedClassGroupId('')
    setCurrentStudentIndex(0)
  }, [selectedSchoolYearId])

  const schoolYearId = selectedSchoolYearId ? Number(selectedSchoolYearId) || undefined : undefined
  const classGroupId = selectedClassGroupId ? Number(selectedClassGroupId) || undefined : undefined

  const classGroupQueryParams = useMemo(
    () => ({
      schoolYearId,
      page: 1,
      pageSize: 100,
    }),
    [schoolYearId],
  )

  const {
    data: classGroups,
    isLoading: isLoadingClassGroups,
    isError: isClassGroupError,
    error: classGroupError,
  } = useClassGroupsQuery(classGroupQueryParams)

  const { data: teacherCourses } = useQuery({
    queryKey: ['teacher-courses', user?.nationalId, schoolYearId],
    queryFn: () => {
      if (user?.role !== 'teacher' || !user.nationalId || !schoolYearId) {
        return Promise.resolve([])
      }
      return coursesApi.list({ teacherId: user.nationalId, schoolYearId })
    },
    enabled: user?.role === 'teacher' && Boolean(user?.nationalId) && Boolean(schoolYearId),
  })

  const allowedClassGroupIds = useMemo(() => {
    return new Set((teacherCourses ?? []).map((course) => course.classGroupId))
  }, [teacherCourses])

  const visibleClassGroups = classGroups
    ? classGroups.data.filter((group) =>
        user?.role === 'teacher' ? allowedClassGroupIds.has(group.classGroupId) : true,
      )
    : []

  const groupsByGrade = visibleClassGroups.length > 0
    ? visibleClassGroups.reduce<Record<string, typeof visibleClassGroups>>((acc, group) => {
        if (!acc[group.gradeLevel]) {
          acc[group.gradeLevel] = []
        }
        acc[group.gradeLevel].push(group)
        return acc
      }, {})
    : {}

  const selectedGroup = classGroupId && visibleClassGroups.length > 0
    ? visibleClassGroups.find((group) => group.classGroupId === classGroupId)
    : undefined

  const {
    data: students,
    isLoading: isLoadingStudents,
    isError: isStudentsError,
    error: studentsError,
  } = useStudentsByClassGroup(schoolYearId, classGroupId)

  useEffect(() => {
    setCurrentStudentIndex(0)
  }, [classGroupId])

  useEffect(() => {
    if (user?.role !== 'teacher') {
      return
    }
    if (selectedClassGroupId && !allowedClassGroupIds.has(Number(selectedClassGroupId))) {
      setSelectedClassGroupId('')
    }
  }, [allowedClassGroupIds, selectedClassGroupId, user?.role])

  useEffect(() => {
    if (!students || students.length === 0) {
      setCurrentStudentIndex(0)
      return
    }
    setCurrentStudentIndex((prev) => {
      if (prev >= students.length) {
        return students.length - 1
      }
      return prev
    })
  }, [students])

  const currentStudent = students && students.length > 0 ? students[currentStudentIndex] : undefined

  const {
    data: disciplineRecords,
    isLoading: isLoadingDiscipline,
    isError: isDisciplineError,
    error: disciplineError,
  } = useStudentDiscipline(currentStudent?.studentId)

  const recordList = disciplineRecords?.data ?? []
  const canCreateDiscipline = user?.role === 'admin'

  const createRecordMutation = useMutation({
    mutationFn: async () => {
      if (!currentStudent || !user?.nationalId) {
        throw new Error('Selecciona un estudiante antes de crear un registro.')
      }

      return disciplinaryRecordsApi.create({
        studentId: currentStudent.studentId,
        recordedBy: user.nationalId,
        dateHappened: createDraft.dateHappened,
        category: createDraft.category,
        description: createDraft.description.trim() || undefined,
        expiresAt: createDraft.expiresAt || undefined,
      })
    },
    onSuccess: async () => {
      setIsCreateDialogOpen(false)
      setCreateDraft({
        category: 'yellow',
        dateHappened: new Date().toISOString().slice(0, 10),
        description: '',
        expiresAt: '',
      })
      await queryClient.invalidateQueries({
        queryKey: ['student-discipline', currentStudent?.studentId],
      })
    },
  })

  const categoryCounts = useMemo(() => {
    return recordList.reduce(
      (acc, record) => {
        acc[record.category] = (acc[record.category] || 0) + 1
        return acc
      },
      { green: 0, yellow: 0, red: 0, last_notice: 0 } as Record<string, number>,
    )
  }, [recordList])

  const showDisciplineBook = Boolean(classGroupId)

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5">Discipline</Typography>
      <Typography variant="body2" color="text.secondary">
        Explora los registros disciplinarios por grado y grupo. Selecciona un estudiante para revisar su historial.
      </Typography>

      {isLoadingYears && !schoolYears ? (
        <Box display="flex" justifyContent="center" mt={2}>
          <CircularProgress />
        </Box>
      ) : null}

      {isYearError ? (
        <Alert severity="error">{yearError?.message || 'Error cargando años escolares.'}</Alert>
      ) : null}

      {schoolYears && schoolYears.length === 0 && !isLoadingYears ? (
        <Alert severity="info">No hay años escolares registrados.</Alert>
      ) : null}

      {schoolYears && schoolYears.length > 0 ? (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Años escolares disponibles
          </Typography>
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {schoolYears.map((year) => (
              <Chip
                key={year.schoolYearId}
                label={year.name}
                clickable
                color={String(year.schoolYearId) === selectedSchoolYearId ? 'primary' : 'default'}
                variant={String(year.schoolYearId) === selectedSchoolYearId ? 'filled' : 'outlined'}
                onClick={() => {
                  setSelectedSchoolYearId(String(year.schoolYearId))
                }}
              />
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2 }}>
        {!selectedSchoolYearId ? (
          <Alert severity="info">Selecciona un año escolar para ver los grupos.</Alert>
        ) : !showDisciplineBook ? (
          <>
            <Typography variant="subtitle1" gutterBottom>
              Grupos de aula
            </Typography>
            {isLoadingClassGroups ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress size={24} />
              </Box>
            ) : null}
            {isClassGroupError ? (
              <Alert severity="error">{classGroupError?.message || 'Error cargando grupos.'}</Alert>
            ) : null}
            {visibleClassGroups.length === 0 && !isLoadingClassGroups ? (
              <Alert severity="info">
                {user?.role === 'teacher'
                  ? 'No tienes grupos asignados para este año.'
                  : 'No hay grupos registrados para este año escolar.'}
              </Alert>
            ) : null}
            {visibleClassGroups.length > 0 ? (
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: 'repeat(2, minmax(0, 1fr))',
                    md: 'repeat(3, minmax(0, 1fr))',
                  },
                }}
              >
                {Object.entries(groupsByGrade).map(([gradeLevelKey, groups]) => (
                  <Paper key={gradeLevelKey} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1.5}>
                      <Typography variant="h6">Grado {gradeLevelKey}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Selecciona un grupo para abrir el libro disciplinario
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {groups.map((group) => (
                          <Chip
                            key={group.classGroupId}
                            label={getGroupLabel(group)}
                            clickable
                            onClick={() => {
                              setSelectedClassGroupId(String(group.classGroupId))
                              setCurrentStudentIndex(0)
                            }}
                          />
                        ))}
                      </Stack>
                    </Stack>
                  </Paper>
                ))}
              </Box>
            ) : null}
          </>
        ) : (
          <>
            {isLoadingStudents ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress />
              </Box>
            ) : null}
            {isStudentsError ? (
              <Alert severity="error">{studentsError?.message || 'Error cargando estudiantes del grupo.'}</Alert>
            ) : null}
            {students && students.length === 0 && !isLoadingStudents ? (
              <Alert severity="info">No hay estudiantes matriculados en este grupo.</Alert>
            ) : null}
            {students && students.length > 0 && currentStudent ? (
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <IconButton
                    onClick={() => setCurrentStudentIndex((prev) => Math.max(prev - 1, 0))}
                    disabled={currentStudentIndex === 0}
                    aria-label="Anterior"
                  >
                    <ArrowBackIosNewIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="subtitle1" textAlign="center">
                    Libro disciplinario · {getGroupLabel(selectedGroup, classGroupId)}
                  </Typography>
                  <IconButton
                    onClick={() => setCurrentStudentIndex((prev) => Math.min(prev + 1, students.length - 1))}
                    disabled={currentStudentIndex === students.length - 1}
                    aria-label="Siguiente"
                  >
                    <ArrowForwardIosIcon fontSize="small" />
                  </IconButton>
                </Stack>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack spacing={1}>
                    <Typography variant="h6">
                      {currentStudent.firstName} {currentStudent.lastName}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Documento: {currentStudent.nationalId || 'N/A'} · Fecha de nacimiento: {currentStudent.dob || 'N/A'} · Grupo: {getGroupLabel(selectedGroup, classGroupId)}
                    </Typography>
                  </Stack>
                </Paper>

                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={`Green: ${categoryCounts.green || 0}`} color="success" variant="outlined" />
                  <Chip label={`Yellow: ${categoryCounts.yellow || 0}`} color="warning" variant="outlined" />
                  <Chip label={`Red: ${categoryCounts.red || 0}`} color="error" variant="outlined" />
                  <Chip label={`Last notice: ${categoryCounts.last_notice || 0}`} variant="outlined" />
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Registros</Typography>
                  {isLoadingDiscipline ? (
                    <Box display="flex" justifyContent="center" py={2}>
                      <CircularProgress size={24} />
                    </Box>
                  ) : null}
                  {isDisciplineError ? (
                    <Alert severity="error">{disciplineError?.message || 'Error cargando registros disciplinarios.'}</Alert>
                  ) : null}
                  {!isLoadingDiscipline && recordList.length === 0 ? (
                    <Alert severity="info">Sin registros para este estudiante.</Alert>
                  ) : null}
                  {recordList.map((record) => (
                    <Paper key={record.disciplinaryId} variant="outlined" sx={{ p: 1.5 }}>
                      <Stack spacing={0.5}>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(record.dateHappened).toLocaleDateString('es-CO')} · {record.category}
                        </Typography>
                        <Typography variant="body2">{record.description || 'Sin descripción'}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Creado:{' '}
                          {record.createdAt
                            ? new Date(record.createdAt).toLocaleString('es-CO')
                            : 'Sin fecha de creación'}
                        </Typography>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>

                <Stack spacing={1}>
                  <Typography variant="subtitle2">Reconocimientos</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Awards: (TODO – wire awards endpoint when available)
                  </Typography>
                </Stack>

                <Stack direction="row" spacing={2}>
                  {canCreateDiscipline ? (
                    <Button
                      variant="contained"
                      onClick={() => {
                        setCreateDraft({
                          category: 'yellow',
                          dateHappened: new Date().toISOString().slice(0, 10),
                          description: '',
                          expiresAt: '',
                        })
                        setIsCreateDialogOpen(true)
                      }}
                    >
                      Agregar
                    </Button>
                  ) : null}
                  <Box flexGrow={1} />
                  <Button variant="text" onClick={() => setSelectedClassGroupId('')}>
                    Volver a grupos
                  </Button>
                </Stack>
              </Stack>
            ) : null}
          </>
        )}
      </Paper>

      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Nuevo registro disciplinario</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Estudiante"
            value={
              currentStudent
                ? `${currentStudent.firstName} ${currentStudent.lastName}`.trim()
                : ''
            }
            disabled
          />
          <TextField
            select
            label="Categoría"
            value={createDraft.category}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                category: event.target.value as DisciplinaryCategory,
              }))
            }
          >
            {disciplinaryCategoryOptions.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            type="date"
            label="Fecha del incidente"
            value={createDraft.dateHappened}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                dateHappened: event.target.value,
              }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Descripción"
            value={createDraft.description}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                description: event.target.value,
              }))
            }
            multiline
            minRows={3}
          />
          <TextField
            type="date"
            label="Expira el"
            value={createDraft.expiresAt}
            onChange={(event) =>
              setCreateDraft((current) => ({
                ...current,
                expiresAt: event.target.value,
              }))
            }
            InputLabelProps={{ shrink: true }}
          />

          {createRecordMutation.isError ? (
            <Alert severity="error">
              {createRecordMutation.error instanceof Error
                ? createRecordMutation.error.message
                : 'No se pudo crear el registro disciplinario.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => createRecordMutation.mutate()}
            disabled={
              !currentStudent ||
              !createDraft.dateHappened ||
              createRecordMutation.isPending
            }
          >
            {createRecordMutation.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
