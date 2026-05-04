import { Box, Typography } from '@mui/material'

export const ClassGroupsPage = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="h4">Grupos</Typography>
      <Typography>
        Configura grados, secciones y asignaciones de aula para preparar el año escolar antes de abrir horarios y notas.
      </Typography>
    </Box>
  )
}
