import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

type ColorMode = 'light' | 'dark'

type ColorModeContextValue = {
  mode: ColorMode
  toggleColorMode: () => void
}

const COLOR_MODE_STORAGE_KEY = 'schoolman-color-mode'

const ColorModeContext = createContext<ColorModeContextValue | undefined>(undefined)

const getStoredMode = (): ColorMode => {
  if (typeof window === 'undefined') {
    return 'light'
  }

  const stored = window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)
  return stored === 'dark' ? 'dark' : 'light'
}

const persistMode = (mode: ColorMode) => {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(COLOR_MODE_STORAGE_KEY, mode)
}

export const useColorMode = () => {
  const ctx = useContext(ColorModeContext)
  if (!ctx) {
    throw new Error('useColorMode must be used within ColorModeProvider')
  }
  return ctx
}

type ColorModeProviderProps = {
  children: ReactNode
}

export const ColorModeProvider = ({ children }: ColorModeProviderProps) => {
  const [mode, setMode] = useState<ColorMode>(() => getStoredMode())

  const toggleColorMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light'
      persistMode(next)
      return next
    })
  }

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: mode === 'light' ? '#1d4ed8' : '#90caf9',
          },
          background: {
            default: mode === 'light' ? '#f5f7fb' : '#0f172a',
            paper: mode === 'light' ? '#ffffff' : '#1f2937',
          },
        },
        shape: {
          borderRadius: 8,
        },
      }),
    [mode],
  )

  const value = useMemo<ColorModeContextValue>(
    () => ({
      mode,
      toggleColorMode,
    }),
    [mode],
  )

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  )
}
