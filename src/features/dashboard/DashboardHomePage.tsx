import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { schoolYearsApi, type CompleteSchoolYearResult } from '../../api/schoolYearsApi'

export const DashboardHomePage = () => {
  const { user } = useAuth()
  const displayName = user?.firstName || user?.username || 'coordinator'
  const queryClient = useQueryClient()
  const [completionResult, setCompletionResult] = useState<CompleteSchoolYearResult | null>(null)
  const [completionError, setCompletionError] = useState<string | null>(null)

  const { data: activeYears, isLoading: isLoadingYear } = useQuery({
    queryKey: ['school-years', { active: true }],
    queryFn: () => schoolYearsApi.list({ active: true }),
  })

  const activeYear = activeYears?.[0] ?? null

  const closingDateLabel = useMemo(() => {
    if (!activeYear) {
      return 'N/A'
    }
    const yearEnd = new Date(activeYear.yearEnd)
    if (Number.isNaN(yearEnd.getTime())) {
      return activeYear.yearEnd
    }
    const closeDate = new Date(Date.UTC(yearEnd.getUTCFullYear(), 11, 31))
    return closeDate.toLocaleDateString()
  }, [activeYear])

  const completeMutation = useMutation({
    mutationFn: (payload: { schoolYearId: number; force: boolean }) =>
      schoolYearsApi.complete(payload.schoolYearId, { force: payload.force }),
    onSuccess: (result) => {
      setCompletionResult(result)
      setCompletionError(null)
      queryClient.invalidateQueries({ queryKey: ['school-years'] })
    },
    onError: (error) => {
      setCompletionError(error instanceof Error ? error.message : 'No se pudo cerrar el año escolar.')
    },
  })

  const handleCompleteYear = () => {
    if (!activeYear) {
      return
    }
    const confirmed = window.confirm(`¿Seguro que deseas finalizar el año escolar ${activeYear.name}?`)
    if (!confirmed) {
      return
    }
    // testing override: force completion regardless of date
    completeMutation.mutate({ schoolYearId: activeYear.schoolYearId, force: true })
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="h4">Welcome, {displayName}</Typography>
      <Typography variant="subtitle1">Role: {user?.role ?? 'N/A'}</Typography>
      <Typography>
        Coordinators and teachers are the primary users of this dashboard. Soon we will extend dedicated views for registrar and admin roles with deeper insights.
      </Typography>
      <Typography>
        Use the navigation menu to review students, enrollments, class groups, and discipline records. Additional widgets and alerts will land here as the SchoolMan project grows.
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Stack spacing={2}>
          <Typography variant="h6">Cierre de año escolar</Typography>
          <Typography color="text.secondary">
            Año activo: {activeYear ? activeYear.name : isLoadingYear ? 'Cargando…' : 'No hay año activo'}
          </Typography>
          <Typography color="text.secondary">
            Fecha de cierre (calendario): {closingDateLabel}
          </Typography>
          <Button
            variant="contained"
            onClick={handleCompleteYear}
            disabled={!activeYear || user?.role !== 'admin' || completeMutation.isPending}
          >
            Finalizar año escolar
          </Button>
          {user?.role !== 'admin' ? (
            <Alert severity="info">Solo administradores pueden cerrar el año escolar.</Alert>
          ) : null}
          {completionError ? <Alert severity="error">{completionError}</Alert> : null}
          {completionResult ? (
            <Alert severity="success">
              Año cerrado. Promovidos: {completionResult.studentsPromoted}. Graduados: {completionResult.studentsGraduated}.
            </Alert>
          ) : null}
        </Stack>
      </Paper>
    </Box>
  )
}
