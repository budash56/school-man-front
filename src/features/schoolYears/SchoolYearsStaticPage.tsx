import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'
import { useClassGroupsQuery } from '../classGroups/useClassGroupsQuery'
import { useStudentsByClassGroup } from './useStudentsByClassGroup'

const SchoolYearsStaticPage = () => {
  const navigate = useNavigate()
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState('')
  const [selectedClassGroupId, setSelectedClassGroupId] = useState('')

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

  const groupsByGrade = classGroups
    ? classGroups.data.reduce<Record<string, typeof classGroups.data>>((acc, group) => {
        if (!acc[group.gradeLevel]) {
          acc[group.gradeLevel] = []
        }
        acc[group.gradeLevel].push(group)
        return acc
      }, {})
    : {}

  const selectedGroup = classGroupId && classGroups
    ? classGroups.data.find((group) => group.classGroupId === classGroupId)
    : undefined

  const {
    data: students,
    isLoading: isLoadingStudents,
    isError: isStudentsError,
    error: studentsError,
  } = useStudentsByClassGroup(schoolYearId, classGroupId)

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h5">School years</Typography>
      <Typography variant="body2" color="text.secondary">
        Selecciona un año escolar para ver sus grupos y los estudiantes realmente matriculados.
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
                  setSelectedClassGroupId('')
                }}
              />
            ))}
          </Stack>
        </Paper>
      ) : null}

      <Paper sx={{ p: 2 }}>
        {!selectedSchoolYearId ? (
          <Alert severity="info">Selecciona un año escolar para ver los grupos.</Alert>
        ) : selectedClassGroupId === '' ? (
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
            {classGroups && classGroups.data.length === 0 && !isLoadingClassGroups ? (
              <Alert severity="info">No hay grupos registrados para este año escolar.</Alert>
            ) : null}
            {classGroups && classGroups.data.length > 0 ? (
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
                        Selecciona un grupo de este grado
                      </Typography>
                      <Stack direction="row" flexWrap="wrap" gap={1}>
                        {groups.map((group) => (
                          <Chip
                            key={group.classGroupId}
                            label={group.section}
                            clickable
                            color={String(group.classGroupId) === selectedClassGroupId ? 'primary' : 'default'}
                            variant={String(group.classGroupId) === selectedClassGroupId ? 'filled' : 'outlined'}
                            onClick={() => setSelectedClassGroupId(String(group.classGroupId))}
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
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} mb={2} gap={1}>
              <Typography variant="subtitle1">
                {selectedGroup ? `Estudiantes en el grupo ${selectedGroup.section}` : 'Estudiantes'}
              </Typography>
              <Button
                variant="outlined"
                onClick={() => setSelectedClassGroupId('')}
              >
                Volver a grupos
              </Button>
            </Stack>
            {isLoadingStudents ? (
              <Box display="flex" justifyContent="center" py={2}>
                <CircularProgress />
              </Box>
            ) : null}
            {isStudentsError ? (
              <Alert severity="error">{studentsError?.message || 'Error cargando estudiantes.'}</Alert>
            ) : null}
            {students && students.length === 0 && !isLoadingStudents ? (
              <Alert severity="info">No hay estudiantes matriculados en este grupo.</Alert>
            ) : null}
            {students && students.length > 0 ? (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Grupo</TableCell>
                      <TableCell>Estudiante</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {students.map((student) => (
                      <TableRow
                        key={student.studentId}
                        hover
                        sx={{ cursor: 'pointer' }}
                        onClick={() => navigate(`/dashboard/students/${student.studentId}`)}
                      >
                        <TableCell>{selectedGroup ? selectedGroup.section : classGroupId}</TableCell>
                        <TableCell>{student.firstName} {student.lastName}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : null}
          </>
        )}
      </Paper>
    </Box>
  )
}

export default SchoolYearsStaticPage
