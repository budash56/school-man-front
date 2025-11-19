import { type ChangeEvent, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
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
} from '@mui/material'
import { Refresh, Search } from '@mui/icons-material'
import { useStudentsQuery } from './useStudentsQuery'
import { useSchoolYearsQuery } from '../schoolYears/useSchoolYearsQuery'

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
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState('')
  const [year, setYear] = useState('')
  const navigate = useNavigate()

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

  const { data, isLoading, isError, error, refetch, isFetching } = useStudentsQuery({
    page: page + 1,
    pageSize,
    q: search || undefined,
    year: parsedYear,
  })

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
  }

  const handleRowClick = (studentId: number) => {
    navigate(`/dashboard/students/${studentId}`)
  }

  const hasData = (data?.data?.length ?? 0) > 0

  return (
    <Box display="flex" flexDirection="column" gap={2}>
      <Typography variant="h4" component="h1">
        Estudiantes
      </Typography>

      <Paper sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            fullWidth
            label="Buscar por documento o nombre"
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
              <MenuItem value="">Todos los años</MenuItem>
              {sortedSchoolYears.map((schoolYear) => (
                <MenuItem key={schoolYear.schoolYearId} value={String(schoolYear.schoolYearId)}>
                  {schoolYear.name}
                  {!schoolYear.isActive ? ' (inactivo)' : ''}
                </MenuItem>
              ))}
            </TextField>
            {isLoadingYears ? <CircularProgress size={20} aria-label="Cargando años escolares" /> : null}
          </Stack>
          <IconButton onClick={() => refetch()} disabled={isFetching} aria-label="refrescar lista">
            <Refresh />
          </IconButton>
        </Stack>
      </Paper>

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
    </Box>
  )
}

export default StudentsPage
