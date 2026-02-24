import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
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
import { Add as AddIcon, ArrowBack as ArrowBackIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  subjectAreasApi,
  type CreateSubjectAreaPayload,
} from '../../api/subjectAreasApi'
import { subjectsApi, type CreateSubjectPayload, type Subject } from '../../api/subjectsApi'
import { professorsApi, type Professor } from '../../api/professorsApi'
import { teacherSubjectsApi } from '../../api/teacherSubjectsApi'
import { coursesApi } from '../../api/coursesApi'
import { useAuth } from '../auth/AuthContext'
import { ApiError } from '../../api/apiClient'

const useAreasQuery = () => {
  return useQuery({
    queryKey: ['subject-areas', 'with-subjects'],
    queryFn: () => subjectAreasApi.list({ pageSize: 100, includeSubjects: true }),
  })
}

const CODE_REGEX = /^[A-Z0-9_]{2,16}$/

const sanitizeCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9_]/g, '')

const normalizeInput = (value: string) => {
  if (!value) {
    return ''
  }
  return typeof value.normalize === 'function' ? value.normalize('NFD') : value
}

const buildCodeFromName = (value: string, minLength: number) => {
  const normalized = normalizeInput(value)
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()

  if (!normalized) {
    return ''
  }

  const parts = normalized.split(/\s+/).filter(Boolean)
  let code = parts.map((part) => part[0]).join('')

  if (code.length < minLength && parts.length > 0) {
    const first = parts[0]
    code += first.slice(1, minLength - code.length + 1)
  }

  const cleaned = sanitizeCode(code)

  if (cleaned.length < minLength) {
    return ''
  }

  return cleaned
}

const generateAreaCode = (value: string) => {
  return buildCodeFromName(value, 2).slice(0, 16)
}

const generateSubjectCode = (areaCode: string | null | undefined, subjectName: string) => {
  const prefix = areaCode ? sanitizeCode(areaCode) : ''
  const suffixMin = prefix ? 1 : 2
  const suffix = buildCodeFromName(subjectName, suffixMin)

  if (!prefix) {
    return suffix.slice(0, 16)
  }

  const maxSuffix = 16 - prefix.length - 1
  if (maxSuffix <= 0) {
    return prefix.slice(0, 16)
  }

  const trimmedSuffix = suffix ? suffix.slice(0, maxSuffix) : ''
  return trimmedSuffix ? `${prefix}_${trimmedSuffix}` : prefix.slice(0, 16)
}

const emptyArea: CreateSubjectAreaPayload = { code: '', name: '' }
const emptySubject: CreateSubjectPayload = { areaId: 0, code: '', name: '', description: '' }

type TeacherProfile = Professor

type TeacherDialogState = {
  teacher: TeacherProfile
  courses: string[]
  groups: string[]
  areaSubjects: string[]
  canLoadCourses: boolean
}

export const SubjectsPage = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'coordinator'

  const [search, setSearch] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null)
  const [isAreaDialogOpen, setIsAreaDialogOpen] = useState(false)
  const [isSubjectDialogOpen, setIsSubjectDialogOpen] = useState(false)
  const [isAssignTeacherOpen, setIsAssignTeacherOpen] = useState(false)
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null)
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null)
  const [assignTeacherId, setAssignTeacherId] = useState('')
  const [assignSubjectIds, setAssignSubjectIds] = useState<number[]>([])
  const [newArea, setNewArea] = useState<CreateSubjectAreaPayload>(emptyArea)
  const [newSubject, setNewSubject] = useState<CreateSubjectPayload>(emptySubject)

  const areaCode = generateAreaCode(newArea.name)

  const { data, isLoading, isError, error, refetch } = useAreasQuery()
  const areas = data?.data ?? []

  const { data: professorsResult } = useQuery({
    queryKey: ['professors', 'all'],
    queryFn: () => professorsApi.list({ pageSize: 100 }),
  })
  const professors = professorsResult?.data ?? []

  const filteredAreas = useMemo(() => {
    if (!search.trim()) {
      return areas
    }
    const needle = search.trim().toLowerCase()
    return areas.filter((area) =>
      `${area.name} ${area.code ?? ''}`.toLowerCase().includes(needle),
    )
  }, [areas, search])

  const selectedArea = areas.find((area) => area.areaId === selectedAreaId) ?? null

  const {
    data: areaTeacherSubjects,
    isLoading: isLoadingAreaTeachers,
    isError: isAreaTeachersError,
    error: areaTeachersError,
  } = useQuery({
    queryKey: [
      'area-teacher-subjects',
      selectedArea?.areaId,
      selectedArea?.subjects?.map((subject) => subject.subjectId).join(','),
    ],
    queryFn: async () => {
      if (!selectedArea?.subjects?.length) {
        return []
      }
      const responses = await Promise.all(
        selectedArea.subjects.map((subject) =>
          teacherSubjectsApi.list({ subjectId: subject.subjectId }),
        ),
      )
      return responses.flat()
    },
    enabled: Boolean(selectedArea),
  })

  const areaTeacherIds = useMemo(() => {
    return new Set((areaTeacherSubjects ?? []).map((entry) => entry.teacherId))
  }, [areaTeacherSubjects])

  const areaTeachers = useMemo(() => {
    if (areaTeacherIds.size === 0) {
      return []
    }
    return professors.filter((professor) => areaTeacherIds.has(professor.nationalId))
  }, [areaTeacherIds, professors])

  const subjectTeacherMap = useMemo(() => {
    const map = new Map<number, TeacherProfile[]>()
    if (!areaTeacherSubjects?.length) {
      return map
    }

    areaTeacherSubjects.forEach((entry) => {
      const list = map.get(entry.subjectId) ?? []
      const professor = professors.find((item) => item.nationalId === entry.teacherId)
      if (professor) {
        list.push(professor)
      }
      map.set(entry.subjectId, list)
    })

    return map
  }, [areaTeacherSubjects, professors])

  const selectedSubjectTeachers = useMemo(() => {
    if (!selectedSubject) {
      return []
    }
    return subjectTeacherMap.get(selectedSubject.subjectId) ?? []
  }, [selectedSubject, subjectTeacherMap])

  const subjectCode = generateSubjectCode(selectedArea?.code, newSubject.name)

  const createAreaMutation = useMutation({
    mutationFn: subjectAreasApi.create,
    onSuccess: () => {
      setIsAreaDialogOpen(false)
      setNewArea(emptyArea)
      refetch()
    },
  })

  const createSubjectMutation = useMutation({
    mutationFn: subjectsApi.create,
    onSuccess: () => {
      setIsSubjectDialogOpen(false)
      setNewSubject(emptySubject)
      refetch()
    },
  })

  const deleteSubjectMutation = useMutation({
    mutationFn: subjectsApi.remove,
    onSuccess: () => {
      refetch()
    },
  })

  const assignTeacherMutation = useMutation({
    mutationFn: async (payload: { teacherId: string; subjectIds: number[] }) => {
      const existingAssignments = await teacherSubjectsApi.list({ teacherId: payload.teacherId })
      const existing = new Set(existingAssignments.map((entry) => entry.subjectId))
      const uniqueIds = Array.from(new Set(payload.subjectIds))
      const tasks = uniqueIds
        .filter((subjectId) => !existing.has(subjectId))
        .map((subjectId) =>
          teacherSubjectsApi.create({ teacherId: payload.teacherId, subjectId }).catch((err) => {
            if (err instanceof ApiError && err.status === 409) {
              return null
            }
            throw err
          }),
        )
      await Promise.all(tasks)
    },
    onSuccess: () => {
      setIsAssignTeacherOpen(false)
      setAssignTeacherId('')
      setAssignSubjectIds([])
      queryClient.invalidateQueries({
        queryKey: ['area-teacher-subjects', selectedArea?.areaId],
      })
    },
  })

  const { data: teacherCourses, isLoading: isLoadingTeacherCourses } = useQuery({
    queryKey: ['teacher-courses', selectedTeacher?.nationalId],
    queryFn: () => {
      if (!selectedTeacher) {
        return Promise.resolve([])
      }
      const numericId = Number(selectedTeacher.nationalId)
      if (!Number.isFinite(numericId)) {
        return Promise.resolve([])
      }
      return coursesApi.list({ teacherId: numericId })
    },
    enabled: Boolean(selectedTeacher),
  })

  const teacherDialogState: TeacherDialogState | null = useMemo(() => {
    if (!selectedTeacher) {
      return null
    }
    const courses = (teacherCourses ?? []).map(
      (course) => `${course.subjectName} · ${course.gradeLevel}° ${course.section}`,
    )
    const groups = Array.from(
      new Set((teacherCourses ?? []).map((course) => `${course.gradeLevel}° ${course.section}`)),
    )
    const areaSubjects = (areaTeacherSubjects ?? [])
      .filter((entry) => entry.teacherId === selectedTeacher.nationalId)
      .map((entry) => entry.subject?.name ?? `Asignatura ${entry.subjectId}`)

    return {
      teacher: selectedTeacher,
      courses,
      groups,
      areaSubjects,
      canLoadCourses: Number.isFinite(Number(selectedTeacher.nationalId)),
    }
  }, [selectedTeacher, teacherCourses, areaTeacherSubjects])

  const handleOpenSubjectDialog = () => {
    if (!selectedArea) {
      return
    }
    setNewSubject({ areaId: selectedArea.areaId, code: '', name: '', description: '' })
    setIsSubjectDialogOpen(true)
  }

  const handleDeleteSubject = (subjectId: number) => {
    if (!canManage) {
      return
    }
    const confirmed = window.confirm('¿Seguro que deseas eliminar esta asignatura?')
    if (!confirmed) {
      return
    }
    deleteSubjectMutation.mutate(subjectId)
  }

  if (!canManage) {
    return <Alert severity="info">Esta vista se habilitará para tu rol más adelante.</Alert>
  }

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} gap={2}>
        <Typography variant="h4">Áreas</Typography>
        <Box sx={{ flexGrow: 1 }} />
        {!selectedArea ? (
          <Button variant="contained" onClick={() => setIsAreaDialogOpen(true)} startIcon={<AddIcon />}>
            Crear área
          </Button>
        ) : null}
      </Stack>

      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : null}

      {isError ? (
        <Alert severity="error">{error?.message || 'Error cargando áreas.'}</Alert>
      ) : null}

      {!selectedArea ? (
        <>
          <TextField
            label="Buscar área"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ej. Matemáticas"
            sx={{ maxWidth: 360 }}
          />

          {filteredAreas.length === 0 ? (
            <Alert severity="info">No hay áreas registradas.</Alert>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
                gap: 2,
              }}
            >
              {filteredAreas.map((area) => (
                <Paper key={area.areaId} variant="outlined">
                  <ButtonBase
                    onClick={() => {
                      setSelectedAreaId(area.areaId)
                    }}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      p: 2,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 0.5,
                    }}
                  >
                    <Typography variant="h6">{area.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {area.subjects?.length ?? 0} asignaturas
                    </Typography>
                  </ButtonBase>
                </Paper>
              ))}
            </Box>
          )}
        </>
      ) : (
        <Box display="flex" flexDirection="column" gap={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton onClick={() => setSelectedAreaId(null)}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h5">{selectedArea.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Código: {selectedArea.code ?? 'Sin código'}
              </Typography>
            </Box>
            <Box sx={{ flexGrow: 1 }} />
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                onClick={() => setIsAssignTeacherOpen(true)}
              >
                Agregar profesor
              </Button>
              <Button variant="contained" onClick={handleOpenSubjectDialog} startIcon={<AddIcon />}>
                Crear asignatura
              </Button>
            </Stack>
          </Stack>

          <Divider />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.3fr 1fr' },
              gap: 3,
              alignItems: 'start',
            }}
          >
            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="subtitle1">Profesores del área</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {areaTeachers.length} profesores
                  </Typography>
                </Stack>

                {isLoadingAreaTeachers ? (
                  <Box display="flex" alignItems="center" gap={1}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">
                      Cargando profesores...
                    </Typography>
                  </Box>
                ) : null}

                {isAreaTeachersError ? (
                  <Alert severity="error">
                    {areaTeachersError instanceof Error
                      ? areaTeachersError.message
                      : 'Error cargando profesores del área.'}
                  </Alert>
                ) : null}

                {!isLoadingAreaTeachers && !isAreaTeachersError && areaTeacherIds.size === 0 ? (
                  <Alert severity="info">
                    Aún no hay profesores asociados a esta área.
                  </Alert>
                ) : null}

                {areaTeachers.length > 0 ? (
                  <List dense>
                    {areaTeachers.map((professor) => (
                      <ListItemButton
                        key={professor.nationalId}
                        onClick={() => setSelectedTeacher(professor)}
                      >
                        <ListItemText
                          primary={`${professor.firstName ?? ''} ${professor.lastName ?? ''}`.trim() || professor.nationalId}
                          secondary={professor.phone ?? 'Sin teléfono'}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                ) : null}
              </Stack>
            </Paper>

            <Paper sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Typography variant="subtitle1">Asignaturas</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedArea.subjects?.length ?? 0} asignaturas
                  </Typography>
                </Stack>

                {selectedArea.subjects?.length ? (
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Asignatura</TableCell>
                          <TableCell>Código</TableCell>
                          <TableCell align="right">Acciones</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedArea.subjects.map((subject) => (
                          <TableRow key={subject.subjectId} hover>
                            <TableCell>
                              <ButtonBase
                                onClick={() => setSelectedSubject(subject)}
                                sx={{ justifyContent: 'flex-start', textAlign: 'left' }}
                              >
                                <Typography>{subject.name}</Typography>
                              </ButtonBase>
                            </TableCell>
                            <TableCell>{subject.subjectCode}</TableCell>
                            <TableCell align="right">
                              <IconButton
                                color="error"
                                onClick={() => handleDeleteSubject(subject.subjectId)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="warning">
                    Esta área aún no tiene asignaturas. Crea la primera para continuar.
                  </Alert>
                )}
              </Stack>
            </Paper>
          </Box>
        </Box>
      )}

      <Dialog open={isAreaDialogOpen} onClose={() => setIsAreaDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva área</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="Nombre"
            value={newArea.name}
            onChange={(event) => {
              const name = event.target.value
              setNewArea((prev) => ({ ...prev, name, code: generateAreaCode(name) }))
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Código automático: {areaCode ? areaCode : '—'}
          </Typography>
          {newArea.name.trim() && !CODE_REGEX.test(areaCode) ? (
            <Typography variant="caption" color="error">
              El código debe tener 2-16 caracteres A-Z, 0-9 o guion bajo.
            </Typography>
          ) : null}

          {createAreaMutation.isError ? (
            <Alert severity="error">
              {createAreaMutation.error instanceof Error
                ? createAreaMutation.error.message
                : 'No se pudo crear el área.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAreaDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() =>
              createAreaMutation.mutate({
                ...newArea,
                code: areaCode,
              })
            }
            disabled={!newArea.name.trim() || !CODE_REGEX.test(areaCode) || createAreaMutation.isPending}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isSubjectDialogOpen} onClose={() => setIsSubjectDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Nueva asignatura</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Área" value={selectedArea?.name ?? ''} disabled />
          <TextField
            label="Nombre"
            value={newSubject.name}
            onChange={(event) => {
              const name = event.target.value
              const code = generateSubjectCode(selectedArea?.code, name)
              setNewSubject((prev) => ({ ...prev, name, code }))
            }}
          />
          <Typography variant="body2" color="text.secondary">
            Código automático: {subjectCode ? subjectCode : '—'}
          </Typography>
          {newSubject.name.trim() && !CODE_REGEX.test(subjectCode) ? (
            <Typography variant="caption" color="error">
              El código debe tener 2-16 caracteres A-Z, 0-9 o guion bajo.
            </Typography>
          ) : null}
          <TextField
            label="Descripción"
            value={newSubject.description ?? ''}
            onChange={(event) => setNewSubject((prev) => ({ ...prev, description: event.target.value }))}
            multiline
            rows={3}
          />

          {createSubjectMutation.isError ? (
            <Alert severity="error">
              {createSubjectMutation.error instanceof Error
                ? createSubjectMutation.error.message
                : 'No se pudo crear la asignatura.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsSubjectDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!selectedArea) {
                return
              }
              createSubjectMutation.mutate({
                ...newSubject,
                areaId: selectedArea.areaId,
                code: subjectCode,
                description: newSubject.description?.trim() || undefined,
              })
            }}
            disabled={!newSubject.name.trim() || !CODE_REGEX.test(subjectCode) || createSubjectMutation.isPending}
          >
            Crear
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={isAssignTeacherOpen} onClose={() => setIsAssignTeacherOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Agregar profesor al área</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            select
            label="Profesor"
            value={assignTeacherId}
            onChange={(event) => setAssignTeacherId(event.target.value)}
          >
            {professors.map((professor) => (
              <MenuItem key={professor.nationalId} value={professor.nationalId}>
                {`${professor.firstName ?? ''} ${professor.lastName ?? ''}`.trim() || professor.nationalId}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            SelectProps={{ multiple: true }}
            label="Asignaturas del área"
            value={assignSubjectIds}
            onChange={(event) => setAssignSubjectIds(event.target.value as number[])}
            disabled={!selectedArea?.subjects?.length}
          >
            {(selectedArea?.subjects ?? []).map((subject) => (
              <MenuItem key={subject.subjectId} value={subject.subjectId}>
                {subject.name}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" color="text.secondary">
            Esto asigna al profesor a una o más asignaturas del área.
          </Typography>
          {assignTeacherMutation.isError ? (
            <Alert severity="error">
              {assignTeacherMutation.error instanceof Error
                ? assignTeacherMutation.error.message
                : 'No se pudo asignar el profesor.'}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsAssignTeacherOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={() => {
              if (!assignTeacherId || assignSubjectIds.length === 0) {
                return
              }
              assignTeacherMutation.mutate({
                teacherId: assignTeacherId,
                subjectIds: assignSubjectIds,
              })
            }}
            disabled={!assignTeacherId || assignSubjectIds.length === 0 || assignTeacherMutation.isPending}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(teacherDialogState)}
        onClose={() => setSelectedTeacher(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Profesor</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {teacherDialogState ? (
            <>
              <Box>
                <Typography variant="h6">
                  {teacherDialogState.teacher.firstName ?? ''} {teacherDialogState.teacher.lastName ?? ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Documento: {teacherDialogState.teacher.nationalId}
                </Typography>
              </Box>

              <Typography variant="body2">
                Teléfono: {teacherDialogState.teacher.phone ?? 'Sin teléfono'}
              </Typography>

              <Divider />

              <Typography variant="subtitle2">Clases actuales</Typography>
              {isLoadingTeacherCourses ? (
                <CircularProgress size={18} />
              ) : teacherDialogState.canLoadCourses ? (
                teacherDialogState.courses.length > 0 ? (
                  <List dense>
                    {teacherDialogState.courses.map((course) => (
                      <ListItemButton key={course} disabled>
                        <ListItemText primary={course} />
                      </ListItemButton>
                    ))}
                  </List>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sin clases asignadas.
                  </Typography>
                )
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No se pudo consultar cursos (documento no numérico).
                </Typography>
              )}

              <Typography variant="subtitle2">Grupos asignados</Typography>
              {teacherDialogState.groups.length > 0 ? (
                <Typography variant="body2">{teacherDialogState.groups.join(', ')}</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin grupos principales.
                </Typography>
              )}

              <Typography variant="subtitle2">Asignaturas en esta área</Typography>
              {teacherDialogState.areaSubjects.length > 0 ? (
                <Typography variant="body2">{teacherDialogState.areaSubjects.join(', ')}</Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Sin asignaturas declaradas en esta área.
                </Typography>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedTeacher(null)}>Cerrar</Button>
          {teacherDialogState ? (
            <Button
              variant="contained"
              onClick={() => {
                navigate('/dashboard/users', { state: { userId: teacherDialogState.teacher.nationalId } })
              }}
            >
              Ver perfil completo
            </Button>
          ) : null}
        </DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(selectedSubject)}
        onClose={() => setSelectedSubject(null)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Asignatura</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          {selectedSubject ? (
            <>
              <Typography variant="h6">{selectedSubject.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                Código: {selectedSubject.subjectCode}
              </Typography>
              <Typography variant="body2">
                {selectedSubject.description ?? 'Sin descripción'}
              </Typography>

              <Divider />

              <Typography variant="subtitle2">Profesores habilitados</Typography>
              {selectedSubjectTeachers.length > 0 ? (
                <Typography variant="body2">
                  {selectedSubjectTeachers
                    .map((teacher) => {
                      const name = `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim()
                      return name || teacher.nationalId
                    })
                    .join(', ')}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No hay profesores asociados a esta asignatura.
                </Typography>
              )}
            </>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedSubject(null)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default SubjectsPage
