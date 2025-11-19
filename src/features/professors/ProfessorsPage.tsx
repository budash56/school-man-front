import { useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
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
import { useQuery } from '@tanstack/react-query'
import { professorsApi } from '../../api/professorsApi'
import { coursesApi, type CourseSummary } from '../../api/coursesApi'

const useProfessorsQuery = () => {
  return useQuery({
    queryKey: ['professors'],
    queryFn: () =>
      professorsApi.list({
        page: 1,
        pageSize: 100,
      }),
  })
}

const useProfessorQuery = (professorId: string | null) => {
  return useQuery({
    queryKey: ['professor', professorId],
    queryFn: () => {
      if (!professorId) {
        throw new Error('professorId required')
      }
      return professorsApi.getById(professorId)
    },
    enabled: Boolean(professorId),
  })
}

const useProfessorCourses = (professorId: string | null) => {
  return useQuery({
    queryKey: ['professor-courses', professorId],
    queryFn: () => {
      if (!professorId) {
        throw new Error('professorId required')
      }
      const numericId = Number(professorId)
      if (!Number.isFinite(numericId)) {
        return Promise.resolve([] as CourseSummary[])
      }
      return coursesApi.list({ teacherId: numericId })
    },
    enabled: Boolean(professorId),
  })
}

export const ProfessorsPage = () => {
  const [search, setSearch] = useState('')
  const [selectedProfessorId, setSelectedProfessorId] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useProfessorsQuery()
  const {
    data: professor,
    isLoading: isLoadingProfessor,
    isError: isProfessorError,
    error: professorError,
  } = useProfessorQuery(selectedProfessorId)
  const {
    data: courses,
    isLoading: isLoadingCourses,
    isError: isCoursesError,
    error: coursesError,
  } = useProfessorCourses(selectedProfessorId)

  const professorList = data?.data ?? []
  const filteredProfessors = useMemo(() => {
    if (!search.trim()) {
      return professorList
    }
    const needle = search.trim().toLowerCase()
    return professorList.filter((prof) => {
      const fullName = `${prof.firstName ?? ''} ${prof.lastName ?? ''}`.toLowerCase()
      return fullName.includes(needle)
    })
  }, [professorList, search])

  const subjects = useMemo(() => {
    if (!courses) {
      return []
    }
    const labels = new Set<string>()
    courses.forEach((course) => {
      labels.add(course.subjectName)
    })
    return Array.from(labels)
  }, [courses])

  const homerooms = useMemo(() => {
    if (!courses) {
      return []
    }
    const labels = new Set<string>()
    courses.forEach((course) => {
      labels.add(`${course.gradeLevel}° ${course.section}`)
    })
    return Array.from(labels)
  }, [courses])

  if (selectedProfessorId) {
    return (
      <Box display="flex" flexDirection="column" gap={2}>
        <Stack direction="row" spacing={2} alignItems="center">
          <Button variant="text" onClick={() => setSelectedProfessorId(null)}>
            ← Back to list
          </Button>
          <Typography variant="h5">Professor profile</Typography>
        </Stack>

        {isLoadingProfessor ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : null}
        {isProfessorError ? (
          <Alert severity="error">{professorError?.message || 'Error loading professor.'}</Alert>
        ) : null}
        {professor ? (
          <Paper sx={{ p: 3 }}>
            <Stack spacing={2}>
              <Typography variant="h4">
                {professor.lastName ?? ''} {professor.firstName ?? ''}
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Documento: {professor.nationalId} · Usuario: {professor.username}
              </Typography>
              <Typography variant="body1">
                Contacto: {professor.email ?? 'Sin correo'} · {professor.phone ?? 'Sin teléfono'}
              </Typography>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Asignaturas principales</Typography>
                {isLoadingCourses ? (
                  <CircularProgress size={20} />
                ) : isCoursesError ? (
                  <Alert severity="error">{coursesError?.message || 'Error loading courses.'}</Alert>
                ) : subjects.length > 0 ? (
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {subjects.map((subject) => (
                      <Chip key={subject} label={subject} />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sin asignaturas asignadas actualmente.
                  </Typography>
                )}
              </Stack>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Grupos asignados</Typography>
                {homerooms.length > 0 ? (
                  <Stack direction="row" flexWrap="wrap" gap={1}>
                    {homerooms.map((group) => (
                      <Chip key={group} color="primary" variant="outlined" label={group} />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    Sin grupos principales asignados.
                  </Typography>
                )}
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // TODO: open timetable view for this professor
                  }}
                >
                  Ver horario
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => {
                    // TODO: show discipline summary for this professor's homeroom
                  }}
                >
                  Disciplina asociada
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ) : null}
      </Box>
    )
  }

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5">Professors</Typography>
      <TextField
        label="Search by name"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="e.g. Juan Pérez"
        sx={{ maxWidth: 360 }}
      />
      {isLoading ? (
        <Box display="flex" justifyContent="center" py={4}>
          <CircularProgress />
        </Box>
      ) : null}
      {isError ? (
        <Alert severity="error">{error?.message || 'Error loading professors.'}</Alert>
      ) : null}
      {professorList.length === 0 && !isLoading ? (
        <Alert severity="info">No professors found.</Alert>
      ) : null}
      {professorList.length > 0 ? (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Nombre</TableCell>
                <TableCell>Correo</TableCell>
                <TableCell>Estado</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProfessors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3}>
                    <Typography variant="body2" color="text.secondary">
                      No hay coincidencias para &quot;{search}&quot;.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProfessors.map((prof) => (
                  <TableRow
                    key={prof.nationalId}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setSelectedProfessorId(prof.nationalId)}
                  >
                    <TableCell>{prof.lastName ?? ''} {prof.firstName ?? ''}</TableCell>
                    <TableCell>{prof.email ?? 'Sin correo'}</TableCell>
                    <TableCell>{prof.isActive ? 'Activo' : 'Inactivo'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      ) : null}
    </Box>
  )
}

export default ProfessorsPage
