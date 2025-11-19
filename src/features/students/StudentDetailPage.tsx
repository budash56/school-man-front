import Grid from '@mui/material/Grid'
import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useStudent } from './useStudent'
import { useStudentEnrollments } from './useStudentEnrollments'
import { useStudentDiscipline } from './useStudentDiscipline'

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

const StudentDetailPage = () => {
  const params = useParams()
  const studentId = useMemo(() => {
    if (!params.studentId) {
      return undefined
    }
    const parsed = Number(params.studentId)
    return Number.isNaN(parsed) ? undefined : parsed
  }, [params.studentId])

  const { data: student, isLoading, isError, error } = useStudent(studentId)
  const {
    data: enrollments,
    isLoading: isLoadingEnrollments,
    isError: isEnrollmentsError,
    error: enrollmentsError,
  } = useStudentEnrollments(studentId)
  const {
    data: discipline,
    isLoading: isLoadingDiscipline,
    isError: isDisciplineError,
    error: disciplineError,
  } = useStudentDiscipline(studentId)

  if (studentId === undefined) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">Identificador de estudiante inválido.</Alert>
      </Paper>
    )
  }

  if (isLoading && !student) {
    return (
      <Box display="flex" alignItems="center" justifyContent="center" minHeight={240}>
        <CircularProgress aria-label="Cargando estudiante" />
      </Box>
    )
  }

  if (isError) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error">{error?.message ?? 'No se pudo cargar el estudiante.'}</Alert>
      </Paper>
    )
  }

  if (!student) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="warning">Estudiante no encontrado.</Alert>
      </Paper>
    )
  }

  return (
    <Stack spacing={3}>
      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Typography variant="h4" component="h1">
              {student.firstName} {student.lastName}
            </Typography>
            <Chip
              label={student.isActive ? 'Activo' : 'Inactivo'}
              color={student.isActive ? 'success' : 'default'}
              variant={student.isActive ? 'filled' : 'outlined'}
            />
          </Stack>
          <Divider />
          <Stack spacing={1}>
            <Typography variant="body1">
              <strong>Documento:</strong> {student.nationalId}
            </Typography>
            <Typography variant="body1">
              <strong>Fecha de nacimiento:</strong> {formatDate(student.dob)}
            </Typography>
            {student.address ? (
              <Typography variant="body1">
                <strong>Dirección:</strong> {student.address}
              </Typography>
            ) : null}
            <Typography variant="body1">
              <strong>Acudiente:</strong> {student.guardianName || 'Sin información'}
              {student.guardianRelationship ? ` (${student.guardianRelationship})` : ''}
            </Typography>
            <Typography variant="body1">
              <strong>Teléfono acudiente:</strong> {student.guardianPhone || 'Sin información'}
            </Typography>
          </Stack>
        </Stack>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack spacing={2}>
              <Typography variant="h6">Últimas matrículas</Typography>
              {isLoadingEnrollments ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} aria-label="Cargando matrículas" />
                </Box>
              ) : isEnrollmentsError ? (
                <Alert severity="error">{enrollmentsError?.message ?? 'Error al cargar matrículas.'}</Alert>
              ) : (enrollments?.data?.length ?? 0) > 0 ? (
                <List>
                  {enrollments?.data.map((enrollment) => (
                    <ListItem key={enrollment.enrollmentId} divider>
                      <ListItemText
                        primary={`Matrícula #${enrollment.enrollmentId}`}
                        secondary={`Grupo: ${enrollment.classGroupId} · Año escolar: ${enrollment.schoolYearId} · ${enrollment.active ? 'Activa' : 'Inactiva'}`}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No hay matrículas recientes.</Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack spacing={2}>
              <Typography variant="h6">Registros disciplinarios recientes</Typography>
              {isLoadingDiscipline ? (
                <Box display="flex" justifyContent="center" py={4}>
                  <CircularProgress size={24} aria-label="Cargando disciplina" />
                </Box>
              ) : isDisciplineError ? (
                <Alert severity="error">{disciplineError?.message ?? 'Error al cargar disciplina.'}</Alert>
              ) : (discipline?.data?.length ?? 0) > 0 ? (
                <List>
                  {discipline?.data.map((record) => (
                    <ListItem key={record.disciplinaryId} alignItems="flex-start" divider>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={record.category} size="small" />
                            <Typography variant="body2">{new Date(record.dateHappened).toLocaleDateString('es-CO')}</Typography>
                          </Stack>
                        }
                        secondary={record.description || 'Sin descripción'}
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Typography color="text.secondary">No hay registros disciplinares recientes.</Typography>
              )}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  )
}

export default StudentDetailPage
