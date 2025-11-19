import { Box, Button, Paper, Stack, Typography } from '@mui/material'
import { useNavigate } from 'react-router-dom'

export const EnrollmentsPage = () => {
  const navigate = useNavigate()

  return (
    <Box display="flex" flexDirection="column" gap={3} alignItems="center">
      <Stack spacing={1} alignItems="center">
        <Typography variant="h4">Matrículas</Typography>
        <Typography color="text.secondary" align="center">
          Usa el asistente para registrar nuevas matrículas o reenrolamientos.
        </Typography>
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
