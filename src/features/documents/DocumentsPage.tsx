import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Divider,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { useMutation, useQuery } from '@tanstack/react-query'
import { studentsApi, type Student } from '../../api/studentsApi'
import { classGroupsApi } from '../../api/classGroupsApi'
import { reportsApi, type RecordPeriod } from '../../api/reportsApi'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'

const ALL_PERIODS: RecordPeriod[] = [1, 2, 3, 4]

const formatSelectedPeriods = (periods: RecordPeriod[]) =>
  periods.length === ALL_PERIODS.length ? 'Todos los periodos' : periods.map((period) => `P${period}`).join(', ')

const DocumentsPage = () => {
  const [tab, setTab] = useState(0)
  const [recordYear, setRecordYear] = useState('')
  const [recordSearch, setRecordSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedPeriods, setSelectedPeriods] = useState<RecordPeriod[]>(ALL_PERIODS)
  const [eligibilityYear, setEligibilityYear] = useState('')
  const [eligibilityGrade, setEligibilityGrade] = useState('11')
  const [eligibilityGroupId, setEligibilityGroupId] = useState('')

  const deferredRecordSearch = useDeferredValue(recordSearch)

  const { data: schoolYears = [] } = useSchoolYearsQuery()

  const sortedSchoolYears = useMemo(
    () =>
      [...schoolYears].sort((left, right) => {
        if (left.isActive !== right.isActive) {
          return left.isActive ? -1 : 1
        }
        return right.yearStart.localeCompare(left.yearStart)
      }),
    [schoolYears],
  )

  const activeSchoolYear = sortedSchoolYears.find((schoolYear) => schoolYear.isActive) ?? null

  useEffect(() => {
    if (!recordYear && activeSchoolYear) {
      setRecordYear(String(activeSchoolYear.schoolYearId))
    }
    if (!eligibilityYear && activeSchoolYear) {
      setEligibilityYear(String(activeSchoolYear.schoolYearId))
    }
  }, [activeSchoolYear, eligibilityYear, recordYear])

  const parsedRecordYear = recordYear ? Number(recordYear) || undefined : undefined
  const parsedEligibilityYear = eligibilityYear ? Number(eligibilityYear) || undefined : undefined
  const parsedEligibilityGrade = Number(eligibilityGrade) || 11
  const parsedEligibilityGroupId = eligibilityGroupId ? Number(eligibilityGroupId) || undefined : undefined

  const studentOptionsQuery = useQuery({
    queryKey: ['document-student-search', deferredRecordSearch, parsedRecordYear],
    queryFn: () =>
      studentsApi.list({
        q: deferredRecordSearch.trim(),
        year: parsedRecordYear,
        page: 1,
        pageSize: 20,
      }),
    enabled: deferredRecordSearch.trim().length >= 2,
    staleTime: 60_000,
  })

  const classGroupsQuery = useQuery({
    queryKey: ['document-class-groups', parsedEligibilityYear, parsedEligibilityGrade],
    queryFn: () =>
      classGroupsApi.list({
        schoolYearId: parsedEligibilityYear,
        gradeLevel: parsedEligibilityGrade,
        page: 1,
        pageSize: 100,
      }),
    enabled: Boolean(parsedEligibilityYear && parsedEligibilityGrade),
    staleTime: 60_000,
  })

  const studentRecordMutation = useMutation({
    mutationFn: () => {
      if (!selectedStudent || !parsedRecordYear) {
        throw new Error('Selecciona el año escolar y el estudiante.')
      }

      return reportsApi.getStudentRecord({
        studentId: selectedStudent.studentId,
        schoolYearId: parsedRecordYear,
        periods:
          selectedPeriods.length === ALL_PERIODS.length
            ? 'all'
            : selectedPeriods.join(','),
      })
    },
  })

  const eligibilityMutation = useMutation({
    mutationFn: () => {
      if (!parsedEligibilityYear) {
        throw new Error('Selecciona el año escolar.')
      }

      return reportsApi.getEligibility({
        schoolYearId: parsedEligibilityYear,
        gradeLevel: parsedEligibilityGrade,
        classGroupId: parsedEligibilityGroupId,
      })
    },
  })

  const studentOptions = studentOptionsQuery.data?.data ?? []
  const classGroupOptions = classGroupsQuery.data?.data ?? []

  const handleTogglePeriod = (period: RecordPeriod) => {
    setSelectedPeriods((current) => {
      if (current.includes(period)) {
        return current.length > 1 ? current.filter((value) => value !== period) as RecordPeriod[] : current
      }
      return [...current, period].sort((left, right) => left - right) as RecordPeriod[]
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" component="h1">
          Documentos
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Consulta y prepara los datos imprimibles para boletines, promoción y graduación.
        </Typography>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)}>
          <Tab label="Boletín / récord" />
          <Tab label="Promoción / graduación" />
        </Tabs>
      </Paper>

      {tab === 0 ? (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Consulta de boletín</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Año escolar"
                  value={recordYear}
                  onChange={(event) => setRecordYear(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 220 } }}
                >
                  {sortedSchoolYears.map((schoolYear) => (
                    <MenuItem key={schoolYear.schoolYearId} value={String(schoolYear.schoolYearId)}>
                      {schoolYear.name}
                    </MenuItem>
                  ))}
                </TextField>
                <Autocomplete
                  fullWidth
                  options={studentOptions}
                  value={selectedStudent}
                  inputValue={recordSearch}
                  onInputChange={(_event, value) => setRecordSearch(value)}
                  onChange={(_event, value) => setSelectedStudent(value)}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName} · ${option.nationalId}`}
                  isOptionEqualToValue={(option, value) => option.studentId === value.studentId}
                  loading={studentOptionsQuery.isFetching}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Buscar estudiante"
                      helperText="Escribe nombre o documento"
                    />
                  )}
                />
              </Stack>

              <Stack spacing={1}>
                <Typography variant="subtitle2">Periodos a imprimir</Typography>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  <Chip
                    label="Todos"
                    color={selectedPeriods.length === ALL_PERIODS.length ? 'primary' : 'default'}
                    onClick={() => setSelectedPeriods(ALL_PERIODS)}
                    clickable
                  />
                  {ALL_PERIODS.map((period) => (
                    <Chip
                      key={period}
                      label={`P${period}`}
                      color={selectedPeriods.includes(period) ? 'primary' : 'default'}
                      onClick={() => handleTogglePeriod(period)}
                      clickable
                    />
                  ))}
                </Stack>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => studentRecordMutation.mutate()}
                  disabled={!selectedStudent || !parsedRecordYear || studentRecordMutation.isPending}
                >
                  {studentRecordMutation.isPending ? 'Consultando...' : 'Preparar documento'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handlePrint}
                  disabled={!studentRecordMutation.data}
                >
                  Imprimir
                </Button>
              </Stack>

              {studentRecordMutation.isError ? (
                <Alert severity="error">
                  {studentRecordMutation.error instanceof Error
                    ? studentRecordMutation.error.message
                    : 'No se pudo consultar el boletín.'}
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          {studentRecordMutation.data ? (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Documento oficial
                    </Typography>
                    <Typography variant="h5">Boletín académico</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Impresión #{studentRecordMutation.data.printId} · {studentRecordMutation.data.schoolYear.name}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography variant="body2">
                      <strong>Estudiante:</strong> {studentRecordMutation.data.student.fullName}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Documento:</strong> {studentRecordMutation.data.student.nationalId}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Grado / grupo:</strong>{' '}
                      {studentRecordMutation.data.student.gradeLevel ?? 'Sin grado'}
                      {studentRecordMutation.data.student.groupCode ? ` · ${studentRecordMutation.data.student.groupCode}` : ''}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Periodos:</strong> {formatSelectedPeriods(studentRecordMutation.data.periods)}
                    </Typography>
                  </Stack>
                </Stack>

                <Alert severity={studentRecordMutation.data.allSelectedPeriodsComplete ? 'success' : 'warning'}>
                  {studentRecordMutation.data.allSelectedPeriodsComplete
                    ? 'Todas las notas solicitadas están completas.'
                    : 'Hay asignaturas o periodos con notas faltantes en esta vista.'}
                </Alert>

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Asignatura</TableCell>
                        <TableCell>Profesor</TableCell>
                        {studentRecordMutation.data.periods.flatMap((period) => [
                          <TableCell key={`p${period}-proc`} align="center">{`P${period} Proc.`}</TableCell>,
                          <TableCell key={`p${period}-cog`} align="center">{`P${period} Cog.`}</TableCell>,
                          <TableCell key={`p${period}-act`} align="center">{`P${period} Act.`}</TableCell>,
                        ])}
                        <TableCell align="center">Estado</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {studentRecordMutation.data.subjects.map((subject) => (
                        <TableRow key={subject.planillaSheetId}>
                          <TableCell>{subject.subjectName}</TableCell>
                          <TableCell>{subject.teacherName ?? 'Sin registro'}</TableCell>
                          {subject.periods.flatMap((period) => [
                            <TableCell key={`${subject.planillaSheetId}-${period.period}-proc`} align="center">
                              {period.procedural || '—'}
                            </TableCell>,
                            <TableCell key={`${subject.planillaSheetId}-${period.period}-cog`} align="center">
                              {period.cognitive || '—'}
                            </TableCell>,
                            <TableCell key={`${subject.planillaSheetId}-${period.period}-act`} align="center">
                              {period.attitudinal || '—'}
                            </TableCell>,
                          ])}
                          <TableCell align="center">
                            <Chip
                              size="small"
                              color={subject.complete && subject.passing ? 'success' : 'warning'}
                              label={subject.complete && subject.passing ? 'Completo' : 'Revisar'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      ) : (
        <Stack spacing={2}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Typography variant="h6">Consulta de promoción y graduación</Typography>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                <TextField
                  select
                  label="Año escolar"
                  value={eligibilityYear}
                  onChange={(event) => setEligibilityYear(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 220 } }}
                >
                  {sortedSchoolYears.map((schoolYear) => (
                    <MenuItem key={schoolYear.schoolYearId} value={String(schoolYear.schoolYearId)}>
                      {schoolYear.name}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Grado"
                  value={eligibilityGrade}
                  onChange={(event) => {
                    setEligibilityGrade(event.target.value)
                    setEligibilityGroupId('')
                  }}
                  sx={{ minWidth: { xs: '100%', md: 180 } }}
                >
                  {Array.from({ length: 11 }, (_, index) => index + 1).map((grade) => (
                    <MenuItem key={grade} value={String(grade)}>
                      Grado {grade}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Grupo"
                  value={eligibilityGroupId}
                  onChange={(event) => setEligibilityGroupId(event.target.value)}
                  sx={{ minWidth: { xs: '100%', md: 220 } }}
                >
                  <MenuItem value="">Todos los grupos</MenuItem>
                  {classGroupOptions.map((group) => (
                    <MenuItem key={group.classGroupId} value={String(group.classGroupId)}>
                      {group.gradeLevel}
                      {group.section}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>

              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  onClick={() => eligibilityMutation.mutate()}
                  disabled={!parsedEligibilityYear || eligibilityMutation.isPending}
                >
                  {eligibilityMutation.isPending ? 'Consultando...' : 'Preparar documento'}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handlePrint}
                  disabled={!eligibilityMutation.data}
                >
                  Imprimir
                </Button>
              </Stack>

              {eligibilityMutation.isError ? (
                <Alert severity="error">
                  {eligibilityMutation.error instanceof Error
                    ? eligibilityMutation.error.message
                    : 'No se pudo consultar la elegibilidad.'}
                </Alert>
              ) : null}
            </Stack>
          </Paper>

          {eligibilityMutation.data ? (
            <Paper sx={{ p: 3 }}>
              <Stack spacing={2}>
                <Stack
                  direction={{ xs: 'column', md: 'row' }}
                  justifyContent="space-between"
                  spacing={2}
                >
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      Documento oficial
                    </Typography>
                    <Typography variant="h5">
                      {eligibilityMutation.data.documentType === 'graduation'
                        ? 'Constancia de culminación'
                        : 'Constancia de promoción'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Impresión #{eligibilityMutation.data.printId} · {eligibilityMutation.data.schoolYear.name}
                    </Typography>
                  </Box>
                  <Stack spacing={0.5} alignItems={{ xs: 'flex-start', md: 'flex-end' }}>
                    <Typography variant="body2">
                      <strong>Grado:</strong> {eligibilityMutation.data.gradeLevel}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Grupo:</strong> {eligibilityMutation.data.classGroup?.groupCode ?? 'Todos'}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Elegibles:</strong> {eligibilityMutation.data.eligibleCount} / {eligibilityMutation.data.totalStudents}
                    </Typography>
                  </Stack>
                </Stack>

                <Alert severity="info">{eligibilityMutation.data.statement}</Alert>

                <Divider />

                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Documento</TableCell>
                        <TableCell>Estudiante</TableCell>
                        <TableCell>Grupo</TableCell>
                        <TableCell>Estado</TableCell>
                        <TableCell>Observaciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {eligibilityMutation.data.students.map((student) => {
                        const notes = [
                          ...student.failingSubjects.map((subject) => `Nota no aprobada: ${subject}`),
                          ...student.missingSubjects.map((subject) => `Falta asignatura: ${subject}`),
                          ...student.missingGrades,
                        ]

                        return (
                          <TableRow key={student.studentId}>
                            <TableCell>{student.nationalId}</TableCell>
                            <TableCell>{student.fullName}</TableCell>
                            <TableCell>{student.groupCode ?? 'Sin grupo'}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                color={student.eligible ? 'success' : 'warning'}
                                label={student.eligible ? 'Elegible' : 'Pendiente'}
                              />
                            </TableCell>
                            <TableCell>{notes.length > 0 ? notes.join(' · ') : 'Cumple requisitos'}</TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </Paper>
          ) : null}
        </Stack>
      )}
    </Stack>
  )
}

export default DocumentsPage
