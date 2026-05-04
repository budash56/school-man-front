import { type FormEvent, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/apiClient'
import { useAuth } from './AuthContext'
import './LoginPage.css'

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
    <div className="login-page">
      <div className="login-card">
        <h1
          style={{
            margin: '0 0 0.75rem',
            textAlign: 'center',
            color: '#1d4ed8',
            fontFamily: '"Museo Sans", MuseoSans, "Avenir Next", Avenir, system-ui, sans-serif',
            fontSize: '2.4rem',
            fontWeight: 800,
            letterSpacing: '0',
            lineHeight: 1.05,
          }}
        >
          SchoolMan-R
        </h1>
        <p
          style={{
            margin: '0 0 2rem',
            textAlign: 'center',
            color: '#475569',
            fontSize: '0.95rem',
            lineHeight: 1.45,
          }}
        >
          Plataforma institucional para gestionar información académica, asistencia,
          planillas y procesos escolares.
        </p>
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
