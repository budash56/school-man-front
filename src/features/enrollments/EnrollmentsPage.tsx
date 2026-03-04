import { Box, Button, Chip, FormControlLabel, Paper, Stack, Switch, Typography } from '@mui/material'
import { CheckCircle as CheckCircleIcon, Lock as LockIcon } from '@mui/icons-material'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

export const EnrollmentsPage = () => {
  const navigate = useNavigate()
  const [isEnrollmentClosed, setIsEnrollmentClosed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem('enrollmentPeriodClosed') === 'true'
  })

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem('enrollmentPeriodClosed', String(isEnrollmentClosed))
  }, [isEnrollmentClosed])

  return (
    <Box display="flex" flexDirection="column" gap={3} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4">Matrículas</Typography>
        <Typography color="text.secondary" align="center">
          Usa el asistente para registrar nuevas matrículas o reenrolamientos.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Switch
                checked={isEnrollmentClosed}
                onChange={(event) => setIsEnrollmentClosed(event.target.checked)}
              />
            }
            label="Periodo de matrícula finalizado"
          />
          <Chip
            icon={isEnrollmentClosed ? <LockIcon /> : <CheckCircleIcon />}
            label={isEnrollmentClosed ? 'Periodo cerrado' : 'Periodo abierto'}
            color={isEnrollmentClosed ? 'default' : 'success'}
            variant="outlined"
          />
        </Stack>
      </Stack>

      <Paper sx={{ p: 4, width: '100%', maxWidth: 480 }}>
        <Stack spacing={2} alignItems="center">
          <Typography align="center">
            Presiona el botón para iniciar el proceso de matrícula. El asistente te guiará paso a paso.
          </Typography>
          <Button variant="contained" onClick={() => navigate('/dashboard/enrollments/new')}>
            Iniciar matrícula
          </Button>
        </Stack>
      </Paper>
    </Box>
  )
}
