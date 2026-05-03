import { useEffect, useState } from 'react'
import { Alert, Box, Button, Divider, Paper, Stack, TextField, Typography } from '@mui/material'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../api/authApi'
import { useAuth } from '../auth/AuthContext'

const isValidEmail = (value: string) =>
  value.length === 0 || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  teacher: 'Profesor',
  registrar: 'Secretaria',
  student: 'Estudiante',
}

export const AccountPage = () => {
  const { user, refreshUser } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileMessage, setProfileMessage] = useState('')
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMessage, setPasswordMessage] = useState('')
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    setEmail(user?.email ?? '')
  }, [user?.email])

  const profileMutation = useMutation({
    mutationFn: () => authApi.updateProfile({ email: email.trim() || null }),
    onSuccess: async () => {
      await refreshUser()
      setProfileError('')
      setProfileMessage('Información actualizada.')
    },
    onError: (error) => {
      setProfileMessage('')
      setProfileError(error instanceof Error ? error.message : 'No se pudo actualizar la información.')
    },
  })

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword({ currentPassword, newPassword }),
    onSuccess: async () => {
      await refreshUser()
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordError('')
      setPasswordMessage('Contraseña actualizada.')
    },
    onError: (error) => {
      setPasswordMessage('')
      setPasswordError(error instanceof Error ? error.message : 'No se pudo actualizar la contraseña.')
    },
  })

  if (!user) {
    return null
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || 'Sin nombre registrado'

  const handleProfileSubmit = () => {
    if (!isValidEmail(email.trim())) {
      setProfileError('Escribe un correo electrónico válido.')
      setProfileMessage('')
      return
    }
    setProfileError('')
    profileMutation.mutate()
  }

  const handlePasswordSubmit = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Completa todos los campos de contraseña.')
      setPasswordMessage('')
      return
    }
    if (newPassword.length < 8) {
      setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.')
      setPasswordMessage('')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Las contraseñas no coinciden.')
      setPasswordMessage('')
      return
    }
    setPasswordError('')
    passwordMutation.mutate()
  }

  return (
    <Box sx={{ maxWidth: 900 }}>
      <Stack spacing={3}>
        <Stack spacing={0.5}>
          <Typography variant="h4">Mi cuenta</Typography>
          <Typography color="text.secondary">
            Consulta tus datos de usuario y actualiza tu información de contacto.
          </Typography>
        </Stack>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="overline" color="text.secondary">
                Información personal
              </Typography>
              <Typography variant="h6">{fullName}</Typography>
            </Stack>

            {profileError ? <Alert severity="error">{profileError}</Alert> : null}
            {profileMessage ? <Alert severity="success">{profileMessage}</Alert> : null}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2,
              }}
            >
              <TextField label="Nombre" value={fullName} disabled fullWidth />
              <TextField label="Documento / ID nacional" value={user.nationalId} disabled fullWidth />
              <TextField label="Usuario" value={user.username} disabled fullWidth />
              <TextField label="Rol" value={roleLabels[user.role] ?? user.role} disabled fullWidth />
              <TextField
                label="Correo electrónico"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value)
                  setProfileMessage('')
                  setProfileError('')
                }}
                error={!isValidEmail(email.trim())}
                helperText={!isValidEmail(email.trim()) ? 'Correo inválido' : ' '}
                fullWidth
              />
            </Box>

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={handleProfileSubmit}
                disabled={profileMutation.isPending}
              >
                Guardar información
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}>
          <Stack spacing={2.5}>
            <Stack spacing={0.5}>
              <Typography variant="overline" color="text.secondary">
                Seguridad
              </Typography>
              <Typography variant="h6">Cambiar contraseña</Typography>
            </Stack>

            {passwordError ? <Alert severity="error">{passwordError}</Alert> : null}
            {passwordMessage ? <Alert severity="success">{passwordMessage}</Alert> : null}

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' },
                gap: 2,
              }}
            >
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
                label="Confirmar contraseña"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                fullWidth
              />
            </Box>

            <Divider />

            <Stack direction="row" justifyContent="flex-end">
              <Button
                variant="contained"
                onClick={handlePasswordSubmit}
                disabled={passwordMutation.isPending}
              >
                Cambiar contraseña
              </Button>
            </Stack>
          </Stack>
        </Paper>
      </Stack>
    </Box>
  )
}
