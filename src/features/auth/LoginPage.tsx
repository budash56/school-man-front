import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/apiClient'
import { useAuth } from './AuthContext'

type LocationState = {
  from?: {
    pathname?: string
  }
} | null

export const LoginPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { login, isLoading } = useAuth()

  const [nationalId, setNationalId] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const redirectPath = ((location.state as LocationState)?.from?.pathname) || '/dashboard'
  const isBusy = isLoading || isSubmitting

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      await login({ nationalId, password })
      navigate(redirectPath, { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setErrorMessage(error.message || 'No se pudo iniciar sesión. Revisa tus credenciales.')
      } else {
        setErrorMessage('Ocurrió un error inesperado. Intenta de nuevo.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#f8fafc',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#ffffff',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.1)',
        }}
      >
        <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem', textAlign: 'center' }}>
          SchoolMan
        </h1>
        <img
          src="/schoolman-login-logo.png"
          alt="SCM-R"
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '320px',
            height: 'auto',
            margin: '0 auto 2rem',
          }}
        />
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', color: '#0f172a' }}>
            Documento de identidad
            <input
              name="nationalId"
              value={nationalId}
              onChange={(event) => setNationalId(event.target.value)}
              required
              disabled={isBusy}
              style={{
                marginTop: '0.35rem',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '0.9rem', color: '#0f172a' }}>
            Contraseña
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={isBusy}
              style={{
                marginTop: '0.35rem',
                padding: '0.75rem 0.9rem',
                borderRadius: '8px',
                border: '1px solid #cbd5f5',
              }}
            />
          </label>
          {errorMessage ? (
            <div style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
              {errorMessage}
            </div>
          ) : null}
          <button
            type="submit"
            disabled={isBusy}
            style={{
              marginTop: '0.5rem',
              padding: '0.85rem',
              borderRadius: '8px',
              border: 'none',
              background: isBusy ? '#94a3b8' : '#1d4ed8',
              color: '#ffffff',
              fontWeight: 600,
              cursor: isBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {isBusy ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
