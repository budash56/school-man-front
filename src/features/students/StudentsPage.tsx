import { type ChangeEvent, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
} from '@mui/material'
import { Refresh, Search } from '@mui/icons-material'
import { useTheme } from '@mui/material/styles'
import { useQuery } from '@tanstack/react-query'
import { coursesApi } from '../../api/coursesApi'
import { enrollmentsApi } from '../../api/enrollmentsApi'
import { useAuth } from '../auth/AuthContext'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { useStudentsQuery } from './useStudentsQuery'

type TeacherGroupSummary = {
  classGroupId: number
  section: string
}

type TeacherGradeSummary = {
  gradeLevel: number
  groups: TeacherGroupSummary[]
}

const formatDate = (value: string | null) => {
  if (!value) {
    return 'Sin registro'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Sin registro'
  }
  return date.toLocaleDateString('es-CO')
}

const formatGuardian = (name: string | null, relationship: string | null) => {
  if (!name) {
    return 'Sin información'
  }
  return relationship ? `${name} (${relationship})` : name
}

export const StudentsPage = () => {
  const { user } = useAuth()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const [selectedTeacherGrade, setSelectedTeacherGrade] = useState<number | null>(null)
  const [selectedTeacherGroupId, setSelectedTeacherGroupId] = useState<number | null>(null)
  const navigate = useNavigate()

  const isTeacherView = user?.role === 'teacher'
  const parsedYear = year ? Number(year) || undefined : undefined

  const {
    data: schoolYears,
    isLoading: isLoadingYears,
    isError: isYearError,
    error: yearError,
  } = useSchoolYearsQuery()

  const sortedSchoolYears = schoolYears
    ? [...schoolYears].sort((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1
        }
        return b.yearStart.localeCompare(a.yearStart)
      })
    : []

  const activeSchoolYear = sortedSchoolYears.find((schoolYear) => schoolYear.isActive) ?? null
  const selectedSchoolYearId = parsedYear ?? activeSchoolYear?.schoolYearId

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useStudentsQuery({
    page: page + 1,
    pageSize,
    q: search || undefined,
    year: parsedYear,
  })

  const {
    data: teacherCourses,
    isLoading: isLoadingTeacherCourses,
    isError: isTeacherCoursesError,
    error: teacherCoursesError,
    refetch: refetchTeacherCourses,
    isFetching: isFetchingTeacherCourses,
  } = useQuery({
    queryKey: ['teacher-courses', user?.nationalId, selectedSchoolYearId],
    queryFn: () => {
      if (!user?.nationalId || !selectedSchoolYearId) {
        return Promise.resolve([])
      }
      return coursesApi.list({
        teacherId: user.nationalId,
        schoolYearId: selectedSchoolYearId,
      })
    },
    enabled: isTeacherView && Boolean(user?.nationalId) && Boolean(selectedSchoolYearId),
  })

  const teacherGradeSummaries = useMemo<TeacherGradeSummary[]>(() => {
    if (!teacherCourses) {
      return []
    }

    const gradeMap = new Map<number, Map<number, TeacherGroupSummary>>()

    teacherCourses.forEach((course) => {
      const groups = gradeMap.get(course.gradeLevel) ?? new Map<number, TeacherGroupSummary>()
      groups.set(course.classGroupId, {
        classGroupId: course.classGroupId,
        section: course.section,
      })
      gradeMap.set(course.gradeLevel, groups)
    })

    return Array.from(gradeMap.entries())
      .map(([gradeLevel, groups]) => ({
        gradeLevel,
        groups: Array.from(groups.values()).sort((left, right) =>
          left.section.localeCompare(right.section, 'es'),
        ),
      }))
      .sort((left, right) => left.gradeLevel - right.gradeLevel)
  }, [teacherCourses])

  useEffect(() => {
    if (!isTeacherView) {
      setSelectedTeacherGrade(null)
      setSelectedTeacherGroupId(null)
      return
    }

    if (
      selectedTeacherGrade !== null &&
      !teacherGradeSummaries.some((grade) => grade.gradeLevel === selectedTeacherGrade)
    ) {
      setSelectedTeacherGrade(null)
      setSelectedTeacherGroupId(null)
      return
    }

    if (selectedTeacherGrade === null || selectedTeacherGroupId === null) {
      return
    }

    const selectedGrade = teacherGradeSummaries.find(
      (grade) => grade.gradeLevel === selectedTeacherGrade,
    )

    if (!selectedGrade?.groups.some((group) => group.classGroupId === selectedTeacherGroupId)) {
      setSelectedTeacherGroupId(null)
    }
  }, [isTeacherView, selectedTeacherGrade, selectedTeacherGroupId, teacherGradeSummaries])

  const {
    data: teacherEnrollmentsResult,
    isLoading: isLoadingTeacherStudents,
    isError: isTeacherStudentsError,
    error: teacherStudentsError,
    refetch: refetchTeacherStudents,
    isFetching: isFetchingTeacherStudents,
  } = useQuery({
    queryKey: [
      'teacher-students',
      user?.nationalId,
      selectedSchoolYearId,
      selectedTeacherGrade,
      selectedTeacherGroupId,
    ],
    queryFn: () => {
      if (!selectedSchoolYearId || selectedTeacherGrade === null) {
        return Promise.resolve({ data: [], total: 0, page: 1, pageSize: 500 })
      }

      return enrollmentsApi.list({
        schoolYearId: selectedSchoolYearId,
        gradeLevel: selectedTeacherGrade,
        classGroupId: selectedTeacherGroupId ?? undefined,
        active: true,
        page: 1,
        pageSize: 500,
      })
    },
    enabled: isTeacherView && Boolean(selectedSchoolYearId) && selectedTeacherGrade !== null,
  })

  const selectedTeacherGradeSummary = useMemo(
    () =>
      selectedTeacherGrade === null
        ? null
        : teacherGradeSummaries.find((grade) => grade.gradeLevel === selectedTeacherGrade) ?? null,
    [selectedTeacherGrade, teacherGradeSummaries],
  )

  const teacherGroupLabelById = useMemo(() => {
    const map = new Map<number, string>()
    teacherGradeSummaries.forEach((grade) => {
      grade.groups.forEach((group) => {
        map.set(group.classGroupId, group.section)
      })
    })
    return map
  }, [teacherGradeSummaries])

  const filteredTeacherEnrollments = useMemo(() => {
    const enrollments = teacherEnrollmentsResult?.data ?? []
    const needle = search.trim().toLowerCase()

    if (!needle) {
      return enrollments
    }

    return enrollments.filter((enrollment) => {
      const student = enrollment.student
      if (!student) {
        return false
      }

      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase()
      return (
        fullName.includes(needle) ||
        student.nationalId.toLowerCase().includes(needle)
      )
    })
  }, [search, teacherEnrollmentsResult?.data])

  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value)
    setPage(0)
  }

  const handleYearChange = (event: ChangeEvent<HTMLInputElement>) => {
    setYear(event.target.value)
    setPage(0)
    setSelectedTeacherGrade(null)
    setSelectedTeacherGroupId(null)
  }

  const handleRowClick = (studentId: number) => {
    navigate(`/dashboard/students/${studentId}`)
  }

  const hasData = (data?.data?.length ?? 0) > 0

  const handleTeacherRefresh = async () => {
    await Promise.all([
      refetchTeacherCourses(),
      selectedTeacherGrade !== null ? refetchTeacherStudents() : Promise.resolve(),
    ])
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h4" component="h1">
        Estudiantes
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            fullWidth
            label={isTeacherView ? 'Buscar estudiante por documento o nombre' : 'Buscar por documento o nombre'}
            value={search}
            onChange={handleSearchChange}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" alignItems="center" spacing={1} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              select
              fullWidth
              label="Año escolar"
              value={year}
              onChange={handleYearChange}
              sx={{ minWidth: { xs: '100%', sm: 200 } }}
              disabled={isLoadingYears}
              helperText={isYearError ? yearError?.message : undefined}
            >
              {!isTeacherView ? <MenuItem value="">Todos los años</MenuItem> : null}
              {sortedSchoolYears.map((schoolYear) => (
                <MenuItem key={schoolYear.schoolYearId} value={String(schoolYear.schoolYearId)}>
                  {schoolYear.name}
                  {!schoolYear.isActive ? ' (inactivo)' : ''}
                </MenuItem>
              ))}
            </TextField>
            {isLoadingYears ? <CircularProgress size={20} aria-label="Cargando años escolares" /> : null}
          </Stack>
          <IconButton
            onClick={isTeacherView ? handleTeacherRefresh : () => refetch()}
            disabled={isTeacherView ? isFetchingTeacherCourses || isFetchingTeacherStudents : isFetching}
            aria-label="refrescar lista"
          >
            <Refresh />
          </IconButton>
        </Stack>
      </Paper>

      {isTeacherView ? (
        <>
          {isTeacherCoursesError ? (
            <Alert severity="error">
              {teacherCoursesError?.message ?? 'No se pudieron cargar los cursos del profesor.'}
            </Alert>
          ) : null}

          {selectedSchoolYearId ? null : (
            <Alert severity="warning">
              Selecciona un año escolar para ver los grados y grupos asignados.
            </Alert>
          )}

          {selectedTeacherGrade === null ? (
            <Paper sx={{ p: 2 }}>
              {isLoadingTeacherCourses ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={240}>
                  <CircularProgress aria-label="cargando grados del profesor" />
                </Box>
              ) : teacherGradeSummaries.length === 0 ? (
                <Alert severity="info">
                  No tienes grados asignados en el año escolar seleccionado.
                </Alert>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
                    gap: 2,
                  }}
                >
                  {teacherGradeSummaries.map((grade) => (
                    <Paper key={grade.gradeLevel} variant="outlined">
                      <ButtonBase
                        onClick={() => {
                          setSelectedTeacherGrade(grade.gradeLevel)
                          setSelectedTeacherGroupId(null)
                        }}
                        sx={{
                          width: '100%',
                          textAlign: 'left',
                          p: 2,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'flex-start',
                          gap: 1,
                        }}
                      >
                        <Typography variant="h6">Grado {grade.gradeLevel}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Grupos: {grade.groups.map((group) => group.section).join(', ')}
                        </Typography>
                        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                          {grade.groups.map((group) => (
                            <Chip
                              key={group.classGroupId}
                              label={group.section}
                              clickable
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedTeacherGrade(grade.gradeLevel)
                                setSelectedTeacherGroupId(group.classGroupId)
                              }}
                            />
                          ))}
                        </Stack>
                      </ButtonBase>
                    </Paper>
                  ))}
                </Box>
              )}
            </Paper>
          ) : (
            <Paper>
              <Box p={2}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                    <Button
                      variant="text"
                      onClick={() => {
                        setSelectedTeacherGrade(null)
                        setSelectedTeacherGroupId(null)
                      }}
                    >
                      ← Volver a grados
                    </Button>
                    <Box>
                      <Typography variant="h6">
                        Grado {selectedTeacherGrade}
                        {selectedTeacherGroupId
                          ? ` · Grupo ${teacherGroupLabelById.get(selectedTeacherGroupId) ?? ''}`
                          : ''}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {selectedTeacherGroupId
                          ? 'Vista de un grupo específico'
                          : 'Vista consolidada de todos tus grupos en este grado'}
                      </Typography>
                    </Box>
                  </Stack>

                  {selectedTeacherGradeSummary ? (
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      <Chip
                        label="Todos"
                        color={selectedTeacherGroupId === null ? 'primary' : 'default'}
                        onClick={() => setSelectedTeacherGroupId(null)}
                        clickable
                      />
                      {selectedTeacherGradeSummary.groups.map((group) => (
                        <Chip
                          key={group.classGroupId}
                          label={group.section}
                          color={selectedTeacherGroupId === group.classGroupId ? 'primary' : 'default'}
                          onClick={() => setSelectedTeacherGroupId(group.classGroupId)}
                          clickable
                        />
                      ))}
                    </Stack>
                  ) : null}
                </Stack>
              </Box>

              {isTeacherStudentsError ? (
                <Box px={2}>
                  <Alert severity="error">
                    {teacherStudentsError?.message ?? 'No se pudo cargar la lista de estudiantes.'}
                  </Alert>
                </Box>
              ) : null}

              {isLoadingTeacherStudents ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={240}>
                  <CircularProgress aria-label="cargando estudiantes del profesor" />
                </Box>
              ) : isMobile ? (
                <Box px={2} pb={2}>
                  {filteredTeacherEnrollments.length > 0 ? (
                    <Stack spacing={1.5}>
                      {filteredTeacherEnrollments.map((enrollment) => (
                        <Paper
                          key={enrollment.enrollmentId}
                          variant="outlined"
                          sx={{ p: 1.5, cursor: 'pointer' }}
                          onClick={() => handleRowClick(enrollment.studentId)}
                        >
                          <Stack spacing={0.75}>
                            <Typography fontWeight={600}>
                              {enrollment.student
                                ? `${enrollment.student.firstName} ${enrollment.student.lastName}`
                                : 'Sin información'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              Documento: {enrollment.student?.nationalId ?? 'Sin documento'}
                            </Typography>
                            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                              <Chip
                                size="small"
                                label={`Grupo ${
                                  enrollment.classGroupId
                                    ? teacherGroupLabelById.get(enrollment.classGroupId) ?? 'Sin grupo'
                                    : 'Sin grupo'
                                }`}
                              />
                              <Chip
                                size="small"
                                variant="outlined"
                                label={`Género: ${enrollment.student?.gender ?? 'Sin dato'}`}
                              />
                            </Stack>
                          </Stack>
                        </Paper>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">
                      {isFetchingTeacherStudents
                        ? 'Actualizando lista...'
                        : 'No hay estudiantes que coincidan con la búsqueda.'}
                    </Alert>
                  )}
                </Box>
              ) : (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Documento</TableCell>
                        <TableCell>Nombre</TableCell>
                        <TableCell>Grupo</TableCell>
                        <TableCell>Género</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredTeacherEnrollments.length > 0 ? (
                        filteredTeacherEnrollments.map((enrollment) => (
                          <TableRow
                            key={enrollment.enrollmentId}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(enrollment.studentId)}
                          >
                            <TableCell>{enrollment.student?.nationalId ?? 'Sin documento'}</TableCell>
                            <TableCell>
                              {enrollment.student
                                ? `${enrollment.student.firstName} ${enrollment.student.lastName}`
                                : 'Sin información'}
                            </TableCell>
                            <TableCell>
                              {enrollment.classGroupId
                                ? teacherGroupLabelById.get(enrollment.classGroupId) ?? 'Sin grupo'
                                : 'Sin grupo'}
                            </TableCell>
                            <TableCell>{enrollment.student?.gender ?? 'Sin dato'}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} align="center">
                            {isFetchingTeacherStudents
                              ? 'Actualizando lista...'
                              : 'No hay estudiantes que coincidan con la búsqueda.'}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Paper>
          )}
        </>
      ) : (
        <Paper>
          {isError ? (
            <Box p={2}>
              <Alert severity="error">{error?.message ?? 'No se pudo cargar la lista de estudiantes.'}</Alert>
            </Box>
          ) : null}

          {isLoading && !data ? (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight={280}>
              <CircularProgress aria-label="cargando estudiantes" />
            </Box>
          ) : isMobile ? (
            <>
              <Box p={2}>
                {hasData && data ? (
                  <Stack spacing={1.5}>
                    {data.data.map((student) => (
                      <Paper
                        key={student.studentId}
                        variant="outlined"
                        sx={{ p: 1.5, cursor: 'pointer' }}
                        onClick={() => handleRowClick(student.studentId)}
                      >
                        <Stack spacing={0.75}>
                          <Typography fontWeight={600}>
                            {student.firstName} {student.lastName}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Documento: {student.nationalId}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Nacimiento: {formatDate(student.dob)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Acudiente: {formatGuardian(student.guardianName, student.guardianRelationship)}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Teléfono: {student.guardianPhone || 'Sin información'}
                          </Typography>
                          <Chip
                            size="small"
                            color={student.isActive ? 'success' : 'default'}
                            variant={student.isActive ? 'filled' : 'outlined'}
                            label={student.isActive ? 'Activo' : 'Inactivo'}
                            sx={{ alignSelf: 'flex-start' }}
                          />
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Alert severity="info">
                    {isFetching ? 'Actualizando lista...' : 'No hay estudiantes que coincidan con la búsqueda.'}
                  </Alert>
                )}
              </Box>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={data?.total ?? 0}
                rowsPerPage={pageSize}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Filas"
              />
            </>
          ) : (
            <>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Documento</TableCell>
                      <TableCell>Nombre</TableCell>
                      <TableCell>Fecha de nacimiento</TableCell>
                      <TableCell>Acudiente</TableCell>
                      <TableCell>Teléfono acudiente</TableCell>
                      <TableCell align="center">Estado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {hasData && data
                      ? data.data.map((student) => (
                          <TableRow
                            key={student.studentId}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleRowClick(student.studentId)}
                          >
                            <TableCell>{student.nationalId}</TableCell>
                            <TableCell>{`${student.firstName} ${student.lastName}`}</TableCell>
                            <TableCell>{formatDate(student.dob)}</TableCell>
                            <TableCell>{formatGuardian(student.guardianName, student.guardianRelationship)}</TableCell>
                            <TableCell>{student.guardianPhone || 'Sin información'}</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 600, color: student.isActive ? 'success.main' : 'text.secondary' }}>
                              {student.isActive ? 'Activo' : 'Inactivo'}
                            </TableCell>
                          </TableRow>
                        ))
                      : (
                          <TableRow>
                            <TableCell colSpan={6} align="center">
                              {isFetching ? 'Actualizando lista...' : 'No hay estudiantes que coincidan con la búsqueda.'}
                            </TableCell>
                          </TableRow>
                        )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[10, 25, 50]}
                component="div"
                count={data?.total ?? 0}
                rowsPerPage={pageSize}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Filas por página"
              />
            </>
          )}
        </Paper>
      )}
    </Box>
  )
}

export default StudentsPage
