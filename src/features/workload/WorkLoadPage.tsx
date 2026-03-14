import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
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
  Typography,
} from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthContext'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { classGroupsApi } from '../../api/classGroupsApi'
import { curriculaApi, type Curriculum, type CurriculumItem } from '../../api/curriculaApi'
import { courseInstancesApi, type CourseInstance } from '../../api/courseInstancesApi'
import { coursesApi } from '../../api/coursesApi'
import { usersApi, type User } from '../../api/usersApi'
import { teacherSubjectsApi, type TeacherSubject } from '../../api/teacherSubjectsApi'

type SubjectRow = {
  subjectId: number
  subjectName: string
  subjectCode: string
  weeklyHours: number
  doubleSessionRequired: boolean
}

type ExistingAssignment = {
  courseId: number
  teacherId: string
}

const cellKey = (subjectId: number, classGroupId: number) => `${subjectId}:${classGroupId}`

const buildCourseName = (subjectName: string, gradeLevel: number) =>
  `${subjectName} Grado ${gradeLevel}`

const parseCellKey = (value: string) => {
  const [subjectId, classGroupId] = value.split(':').map((item) => Number(item))
  return { subjectId, classGroupId }
}

const sortByName = (left: User, right: User) => {
  const leftName = `${left.firstName ?? ''} ${left.lastName ?? ''}`.trim()
  const rightName = `${right.firstName ?? ''} ${right.lastName ?? ''}`.trim()
  return leftName.localeCompare(rightName, 'es')
}

const teacherLabel = (teacher: User) => {
  const fullName = `${teacher.firstName ?? ''} ${teacher.lastName ?? ''}`.trim()
  return fullName || teacher.nationalId
}

const pickRandomItem = <T,>(items: T[]) => {
  if (items.length === 0) {
    return null
  }
  const index = Math.floor(Math.random() * items.length)
  return items[index] ?? null
}

const resolveGradeCurriculum = (curricula: Curriculum[], gradeLevel: number) => {
  const gradeCurricula = curricula.filter((curriculum) => curriculum.gradeLevel === gradeLevel)
  const baseCurriculum = gradeCurricula.find((curriculum) => !curriculum.trackName)

  if (baseCurriculum) {
    return {
      curriculum: baseCurriculum,
      items: baseCurriculum.items ?? [],
      hasSpecializations: gradeCurricula.some((curriculum) => Boolean(curriculum.trackName)),
      isSupported: true,
    }
  }

  if (gradeCurricula.length === 1) {
    return {
      curriculum: gradeCurricula[0],
      items: gradeCurricula[0].items ?? [],
      hasSpecializations: false,
      isSupported: true,
    }
  }

  return {
    curriculum: null,
    items: [] as CurriculumItem[],
    hasSpecializations: false,
    isSupported: false,
  }
}

export const WorkLoadPage = () => {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const canManage = user?.role === 'admin' || user?.role === 'coordinator'
  const [selectedGrade, setSelectedGrade] = useState<number | ''>('')
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  const {
    data: schoolYears,
    isLoading: isLoadingYears,
    isError: isYearError,
    error: yearError,
  } = useSchoolYearsQuery({ active: true })

  const activeYear = schoolYears?.[0] ?? null
  const schoolYearId = activeYear?.schoolYearId

  const {
    data: classGroupsResult,
    isLoading: isLoadingGroups,
    isError: isGroupsError,
    error: groupsError,
  } = useQuery({
    queryKey: ['class-groups', 'workload', schoolYearId],
    queryFn: () =>
      classGroupsApi.list({
        schoolYearId,
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(schoolYearId),
  })

  const { data: curricula, isLoading: isLoadingCurricula } = useQuery({
    queryKey: ['curricula', 'workload'],
    queryFn: () => curriculaApi.list({ active: true }),
    enabled: canManage,
  })

  const { data: courseInstances, isLoading: isLoadingInstances } = useQuery({
    queryKey: ['course-instances', 'workload', schoolYearId],
    queryFn: () => courseInstancesApi.list({ schoolYearId }),
    enabled: Boolean(schoolYearId) && canManage,
  })

  const { data: courses, isLoading: isLoadingCourses } = useQuery({
    queryKey: ['courses', 'workload', schoolYearId],
    queryFn: () => coursesApi.list({ schoolYearId }),
    enabled: Boolean(schoolYearId) && canManage,
  })

  const { data: teachersResult, isLoading: isLoadingTeachers } = useQuery({
    queryKey: ['users', 'teachers', 'workload'],
    queryFn: () =>
      usersApi.list({
        role: 'teacher',
        isActive: true,
        page: 1,
        pageSize: 100,
      }),
    enabled: canManage,
  })

  const { data: teacherSubjects, isLoading: isLoadingTeacherSubjects } = useQuery({
    queryKey: ['teacher-subjects', 'workload'],
    queryFn: () => teacherSubjectsApi.list(),
    enabled: canManage,
  })

  const classGroups = classGroupsResult?.data ?? []
  const teachers = useMemo(() => (teachersResult?.data ?? []).slice().sort(sortByName), [teachersResult?.data])
  const allCurricula = curricula ?? []
  const allCourseInstances = courseInstances ?? []
  const allCourses = courses ?? []
  const allTeacherSubjects = teacherSubjects ?? []

  const groupsByGrade = useMemo(() => {
    const map = new Map<number, typeof classGroups>()
    classGroups.forEach((group) => {
      const list = map.get(group.gradeLevel) ?? []
      list.push(group)
      map.set(group.gradeLevel, list)
    })
    Array.from(map.values()).forEach((groups) =>
      groups.sort((left, right) => left.section.localeCompare(right.section, 'es')),
    )
    return map
  }, [classGroups])

  const gradeConfigurations = useMemo(() => {
    return Array.from(groupsByGrade.keys())
      .sort((left, right) => left - right)
      .map((gradeLevel) => {
        const config = resolveGradeCurriculum(allCurricula, gradeLevel)
        return {
          gradeLevel,
          groups: groupsByGrade.get(gradeLevel) ?? [],
          ...config,
        }
      })
      .filter((config) => config.isSupported && config.groups.length > 0 && config.items.length > 0)
  }, [groupsByGrade, allCurricula])

  useEffect(() => {
    if (gradeConfigurations.length === 0) {
      setSelectedGrade('')
      return
    }
    if (
      selectedGrade === '' ||
      !gradeConfigurations.some((config) => config.gradeLevel === selectedGrade)
    ) {
      setSelectedGrade(gradeConfigurations[0]?.gradeLevel ?? '')
    }
  }, [gradeConfigurations, selectedGrade])

  const selectedConfiguration = useMemo(
    () => gradeConfigurations.find((config) => config.gradeLevel === selectedGrade) ?? null,
    [gradeConfigurations, selectedGrade],
  )

  const selectedGroups = selectedConfiguration?.groups ?? []

  const subjectRows = useMemo<SubjectRow[]>(() => {
    const items = selectedConfiguration?.items ?? []
    return items
      .map((item) => ({
        subjectId: Number(item.subjectId),
        subjectName: item.subject?.name ?? `Asignatura ${item.subjectId}`,
        subjectCode: item.subject?.subjectCode ?? '',
        weeklyHours: item.weeklyHours,
        doubleSessionRequired: item.doubleSessionRequired,
      }))
      .filter((row) => Number.isFinite(row.subjectId) && row.subjectId > 0)
      .sort((left, right) => {
        const codeCompare = left.subjectCode.localeCompare(right.subjectCode, 'es')
        if (codeCompare !== 0) {
          return codeCompare
        }
        return left.subjectName.localeCompare(right.subjectName, 'es')
      })
  }, [selectedConfiguration])

  const subjectRowById = useMemo(() => {
    return new Map(subjectRows.map((row) => [row.subjectId, row]))
  }, [subjectRows])

  const courseInstanceBySubjectId = useMemo(() => {
    const map = new Map<number, CourseInstance>()
    allCourseInstances.forEach((courseInstance) => {
      if (selectedGrade !== '' && courseInstance.gradeLevel !== selectedGrade) {
        return
      }
      if (!map.has(courseInstance.subjectId)) {
        map.set(courseInstance.subjectId, courseInstance)
      }
    })
    return map
  }, [allCourseInstances, selectedGrade])

  const courseInstanceById = useMemo(() => {
    return new Map(allCourseInstances.map((courseInstance) => [courseInstance.courseInstanceId, courseInstance]))
  }, [allCourseInstances])

  const assignmentState = useMemo(() => {
    const assignments = new Map<string, ExistingAssignment>()
    const duplicates: string[] = []

    allCourses.forEach((course) => {
      if (selectedGrade !== '' && course.gradeLevel !== selectedGrade) {
        return
      }
      const courseInstance = courseInstanceById.get(course.courseInstanceId)
      if (!courseInstance) {
        return
      }
      const key = cellKey(courseInstance.subjectId, course.classGroupId)
      if (assignments.has(key)) {
        duplicates.push(key)
        return
      }
      assignments.set(key, {
        courseId: course.courseId,
        teacherId: String(course.teacherId),
      })
    })

    return { assignments, duplicates }
  }, [allCourses, courseInstanceById, selectedGrade])

  useEffect(() => {
    setDraftAssignments({})
    setSaveError(null)
    setSaveSuccess(null)
  }, [selectedGrade, schoolYearId])

  const teacherIdsBySubject = useMemo(() => {
    const map = new Map<number, Set<string>>()
    allTeacherSubjects.forEach((item: TeacherSubject) => {
      const list = map.get(item.subjectId) ?? new Set<string>()
      list.add(item.teacherId)
      map.set(item.subjectId, list)
    })
    return map
  }, [allTeacherSubjects])

  const teacherById = useMemo(() => {
    return new Map(teachers.map((teacher) => [teacher.nationalId, teacher]))
  }, [teachers])

  const teachersForSubject = (subjectId: number) => {
    const allowed = teacherIdsBySubject.get(subjectId)
    if (!allowed || allowed.size === 0) {
      return []
    }
    return teachers.filter((teacher) => allowed.has(teacher.nationalId))
  }

  const subjectsWithoutEligibleTeachers = useMemo(() => {
    return subjectRows
      .filter((row) => teachersForSubject(row.subjectId).length === 0)
      .map((row) => row.subjectName)
  }, [subjectRows, teacherIdsBySubject, teachers])

  const getAssignedTeacherId = (subjectId: number, classGroupId: number) => {
    const key = cellKey(subjectId, classGroupId)
    return draftAssignments[key] ?? assignmentState.assignments.get(key)?.teacherId ?? ''
  }

  const pendingChanges = Object.keys(draftAssignments).length

  const handleRandomTestingSelection = () => {
    if (teachers.length === 0) {
      setSaveError('No hay profesores disponibles para la selección aleatoria de prueba.')
      setSaveSuccess(null)
      return
    }

    const nextAssignments: Record<string, string> = {}
    const skippedSubjects = new Set<string>()

    subjectRows.forEach((row) => {
      const availableTeachers = teachersForSubject(row.subjectId)
      if (availableTeachers.length === 0) {
        skippedSubjects.add(row.subjectName)
        return
      }

      selectedGroups.forEach((group) => {
        const key = cellKey(row.subjectId, group.classGroupId)
        const randomTeacher = pickRandomItem(availableTeachers)
        const randomTeacherId = randomTeacher?.nationalId ?? ''
        const originalValue = assignmentState.assignments.get(key)?.teacherId ?? ''

        if (randomTeacherId && randomTeacherId !== originalValue) {
          nextAssignments[key] = randomTeacherId
        }
      })
    })

    setDraftAssignments(nextAssignments)
    setSaveError(
      skippedSubjects.size > 0
        ? `Testing only: no hay profesores elegibles para ${Array.from(skippedSubjects).join(', ')}.`
        : null,
    )
    setSaveSuccess(null)
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: Record<string, string>) => {
      if (!schoolYearId || selectedGrade === '') {
        throw new Error('Selecciona un grado válido.')
      }

      const courseInstanceCache = new Map(courseInstanceBySubjectId)

      const ensureCourseInstance = async (subjectId: number) => {
        const existing = courseInstanceCache.get(subjectId)
        if (existing) {
          return existing.courseInstanceId
        }

        const row = subjectRowById.get(subjectId)
        if (!row) {
          throw new Error('No se encontró la asignatura para crear la instancia.')
        }

        const created = await courseInstancesApi.create({
          subjectId,
          gradeLevel: selectedGrade,
          schoolYearId,
          courseName: buildCourseName(row.subjectName, selectedGrade),
          weeklyHours: row.weeklyHours,
          isActive: true,
        })

        courseInstanceCache.set(subjectId, created)
        return created.courseInstanceId
      }

      for (const [key, teacherIdValue] of Object.entries(payload)) {
        const { subjectId, classGroupId } = parseCellKey(key)
        const existing = assignmentState.assignments.get(key)

        if (!teacherIdValue) {
          if (existing) {
            await coursesApi.remove(existing.courseId)
          }
          continue
        }

        const teacherId = Number(teacherIdValue)
        if (!Number.isFinite(teacherId)) {
          throw new Error('El profesor seleccionado no tiene un identificador válido.')
        }

        const eligibleTeachers = teachersForSubject(subjectId)
        if (eligibleTeachers.length === 0) {
          throw new Error(`No hay profesores elegibles para la asignatura ${subjectRowById.get(subjectId)?.subjectName ?? subjectId}.`)
        }

        const isEligible = eligibleTeachers.some(
          (eligibleTeacher) => eligibleTeacher.nationalId === teacherIdValue,
        )
        if (!isEligible) {
          throw new Error(`El profesor seleccionado no está habilitado para la asignatura ${subjectRowById.get(subjectId)?.subjectName ?? subjectId}.`)
        }

        if (existing) {
          await coursesApi.update(existing.courseId, { teacherId })
          continue
        }

        const courseInstanceId = await ensureCourseInstance(subjectId)
        await coursesApi.create({
          courseInstanceId,
          classGroupId,
          teacherId,
        })
      }
    },
    onSuccess: () => {
      setDraftAssignments({})
      setSaveError(null)
      setSaveSuccess('Carga académica actualizada.')
      queryClient.invalidateQueries({ queryKey: ['courses', 'workload', schoolYearId] })
      queryClient.invalidateQueries({ queryKey: ['course-instances', 'workload', schoolYearId] })
    },
    onError: (error: Error) => {
      setSaveSuccess(null)
      setSaveError(error.message || 'No se pudo guardar la carga académica.')
    },
  })

  if (!canManage) {
    return <Alert severity="error">No tienes permisos para configurar la carga académica.</Alert>
  }

  if (isLoadingYears || isLoadingGroups || isLoadingCurricula || isLoadingInstances || isLoadingCourses || isLoadingTeachers || isLoadingTeacherSubjects) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress aria-label="Cargando configuración de carga académica" />
      </Box>
    )
  }

  if (isYearError) {
    return <Alert severity="error">{yearError?.message ?? 'No se pudo cargar el año escolar.'}</Alert>
  }

  if (isGroupsError) {
    return <Alert severity="error">{groupsError instanceof Error ? groupsError.message : 'No se pudieron cargar los grupos.'}</Alert>
  }

  if (!activeYear) {
    return <Alert severity="info">No hay un año escolar activo para configurar la carga académica.</Alert>
  }

  if (gradeConfigurations.length === 0) {
    return (
      <Alert severity="info">
        No hay grados con grupos creados y currículo listo para configurar.
      </Alert>
    )
  }

  const duplicateLabels = assignmentState.duplicates
    .map((key) => {
      const { subjectId, classGroupId } = parseCellKey(key)
      const row = subjectRowById.get(subjectId)
      const group = selectedGroups.find((item) => item.classGroupId === classGroupId)
      if (!row || !group) {
        return null
      }
      return `${row.subjectName} · ${group.gradeLevel}${group.section}`
    })
    .filter(Boolean) as string[]

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h4">WorkLoad</Typography>
          <Typography color="text.secondary">
            Asigna un profesor por asignatura y grupo. Solo aparecen grados que ya tienen grupos creados y un currículo utilizable.
          </Typography>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box sx={{ minWidth: 220 }}>
              <Typography variant="body2" color="text.secondary">
                Año escolar activo
              </Typography>
              <Typography variant="h6">{activeYear.name}</Typography>
            </Box>
            <FormControl sx={{ minWidth: 220 }}>
              <Select
                value={selectedGrade}
                displayEmpty
                onChange={(event) => setSelectedGrade(Number(event.target.value))}
              >
                {gradeConfigurations.map((config) => (
                  <MenuItem key={config.gradeLevel} value={config.gradeLevel}>
                    Grado {config.gradeLevel}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip label={`${selectedGroups.length} grupos`} />
            <Chip label={`${subjectRows.length} asignaturas`} />
            <Chip label={`${pendingChanges} cambios pendientes`} color={pendingChanges > 0 ? 'warning' : 'default'} />
          </Stack>
          {selectedConfiguration?.hasSpecializations ? (
            <Alert severity="info">
              Este grado tiene especializaciones. Aquí solo se muestra el currículo base porque los grupos aún no están vinculados a un track.
            </Alert>
          ) : null}
          {duplicateLabels.length > 0 ? (
            <Alert severity="error">
              Hay asignaciones duplicadas para: {duplicateLabels.join(', ')}. Corrige esos cursos antes de editar esta vista.
            </Alert>
          ) : null}
          {subjectsWithoutEligibleTeachers.length > 0 ? (
            <Alert severity="warning">
              No hay profesores habilitados para: {subjectsWithoutEligibleTeachers.join(', ')}.
            </Alert>
          ) : null}
          {saveError ? <Alert severity="error">{saveError}</Alert> : null}
          {saveSuccess ? <Alert severity="success">{saveSuccess}</Alert> : null}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
            <Button
              variant="contained"
              onClick={() => saveMutation.mutate(draftAssignments)}
              disabled={pendingChanges === 0 || saveMutation.isPending || duplicateLabels.length > 0}
            >
              {saveMutation.isPending ? 'Guardando...' : 'Guardar WorkLoad'}
            </Button>
            <Button
              variant="outlined"
              color="warning"
              onClick={handleRandomTestingSelection}
              disabled={teachers.length === 0 || saveMutation.isPending || duplicateLabels.length > 0}
            >
              Selección aleatoria
            </Button>
            <Button
              variant="outlined"
              onClick={() => {
                setDraftAssignments({})
                setSaveError(null)
                setSaveSuccess(null)
              }}
              disabled={pendingChanges === 0 || saveMutation.isPending}
            >
              Limpiar cambios
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Testing only: la selección aleatoria asigna profesores visibles sin validar balance o repetición.
          </Typography>
        </Stack>
      </Paper>

      <Paper sx={{ p: 0 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell
                  sx={{
                    minWidth: 240,
                    position: 'sticky',
                    left: 0,
                    zIndex: 3,
                    backgroundColor: 'background.paper',
                    boxShadow: (theme) => `1px 0 0 ${theme.palette.divider}`,
                  }}
                >
                  Asignatura
                </TableCell>
                <TableCell sx={{ minWidth: 110 }}>Horas</TableCell>
                {selectedGroups.map((group) => (
                  <TableCell key={group.classGroupId} sx={{ minWidth: 220 }}>
                    {group.gradeLevel}
                    {group.section}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {subjectRows.map((row) => (
                <TableRow key={row.subjectId} hover>
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: 'background.paper',
                      boxShadow: (theme) => `1px 0 0 ${theme.palette.divider}`,
                    }}
                  >
                    <Stack spacing={0.5}>
                      <Typography fontWeight={600}>
                        {row.subjectName}
                      </Typography>
                      {row.doubleSessionRequired ? (
                        <Typography variant="body2" color="text.secondary">
                          Requiere bloque doble
                        </Typography>
                      ) : null}
                    </Stack>
                  </TableCell>
                  <TableCell>{row.weeklyHours}</TableCell>
                  {selectedGroups.map((group) => {
                    const key = cellKey(row.subjectId, group.classGroupId)
                    const availableTeachers = teachersForSubject(row.subjectId)
                    const currentValue = getAssignedTeacherId(row.subjectId, group.classGroupId)
                    const hasChanged = key in draftAssignments
                    const currentTeacher = currentValue ? teacherById.get(currentValue) ?? null : null
                    const shouldShowCurrentTeacher =
                      Boolean(currentTeacher) &&
                      !availableTeachers.some((teacher) => teacher.nationalId === currentValue)
                    return (
                      <TableCell
                        key={key}
                        sx={{
                          backgroundColor: hasChanged ? 'action.hover' : 'inherit',
                        }}
                      >
                        <FormControl fullWidth size="small">
                          <Select
                            value={currentValue}
                            displayEmpty
                            onChange={(event) => {
                              const nextValue = String(event.target.value)
                              const originalValue = assignmentState.assignments.get(key)?.teacherId ?? ''
                              setDraftAssignments((previous) => {
                                const next = { ...previous }
                                if (nextValue === originalValue) {
                                  delete next[key]
                                } else {
                                  next[key] = nextValue
                                }
                                return next
                              })
                              setSaveError(null)
                              setSaveSuccess(null)
                            }}
                            disabled={duplicateLabels.length > 0}
                          >
                            <MenuItem value="">Sin asignar</MenuItem>
                            {shouldShowCurrentTeacher ? (
                              <MenuItem value={currentValue}>
                                {teacherLabel(currentTeacher as User)} (actual)
                              </MenuItem>
                            ) : null}
                            {availableTeachers.map((teacher) => (
                              <MenuItem key={teacher.nationalId} value={teacher.nationalId}>
                                {teacherLabel(teacher)}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  )
}

export default WorkLoadPage
