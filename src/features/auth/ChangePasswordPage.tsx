import { useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { Navigate, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/authApi'
import { useAuth } from './AuthContext'

export const ChangePasswordPage = () => {
  const { user, refreshUser, logout } = useAuth()
  const navigate = useNavigate()

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [localError, setLocalError] = useState('')

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      await refreshUser()
      navigate('/dashboard', { replace: true })
    },
  })

  if (!user) {
    return null
  }

  if (user.role === 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  const handleSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setLocalError('Completa todos los campos.')
      return
    }
    if (newPassword.length < 8) {
      setLocalError('La nueva contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setLocalError('Las contraseñas no coinciden.')
      return
    }
    setLocalError('')
    mutation.mutate()
  }

  return (
    <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
      <Paper sx={{ p: 4, width: '100%', maxWidth: 420 }}>
        <Stack spacing={2}>
          <Typography variant="h5">Cambiar contraseña</Typography>
          <Typography variant="body2" color="text.secondary">
            Por seguridad, debes actualizar tu contraseña antes de continuar.
          </Typography>
          {localError ? <Alert severity="error">{localError}</Alert> : null}
          {mutation.isError ? (
            <Alert severity="error">No se pudo actualizar la contraseña.</Alert>
          ) : null}
          <TextField
            label="Contraseña actual"
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            fullWidth
          />
          <TextField
            label="Nueva contraseña"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            fullWidth
          />
          <TextField
            label="Confirmar nueva contraseña"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            fullWidth
          />
          <Stack direction="row" spacing={2} justifyContent="flex-end">
            <Button variant="text" onClick={logout} disabled={mutation.isPending}>
              Salir
            </Button>
            <Button variant="contained" onClick={handleSubmit} disabled={mutation.isPending}>
              Guardar
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </Box>
  )
}
