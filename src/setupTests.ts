import '@testing-library/jest-dom'

type ViteSsrExportName = (...args: unknown[]) => void

const globalWithVite = globalThis as {
  __vite_ssr_exportName__?: ViteSsrExportName
  __vite_ssr_exports__?: Record<string, unknown>
}

if (typeof globalWithVite.__vite_ssr_exportName__ === 'undefined') {
  globalWithVite.__vite_ssr_exports__ = globalWithVite.__vite_ssr_exports__ ?? {}
  globalWithVite.__vite_ssr_exportName__ = (...args: unknown[]) => {
    if (args.length === 2) {
      const [name, getter] = args as [string, () => unknown]
      Object.defineProperty(globalWithVite.__vite_ssr_exports__, name, {
        enumerable: true,
        configurable: true,
        get: getter,
      })
      return
    }
    if (args.length === 3) {
      const [exportsObj, name, getter] = args as [Record<string, unknown>, string, () => unknown]
      Object.defineProperty(exportsObj, name, {
        enumerable: true,
        configurable: true,
        get: getter,
      })
    }
  }
}
