import { afterEach, describe, expect, it, vi } from 'vitest'
import './scannerApi'

const postFormMock = vi.fn()

vi.mock('./apiClient', () => ({
  apiClient: {
    postForm: (...args: unknown[]) => postFormMock(...args),
  },
}))

const getExports = () => {
  const globalExports = (globalThis as { __vite_ssr_exports__?: Record<string, unknown> })
    .__vite_ssr_exports__
  if (!globalExports) {
    throw new Error('Vite SSR exports not available for tests.')
  }
  return globalExports
}

describe('scannerApi', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('posts the selected file to the scanner backend endpoint', async () => {
    postFormMock.mockResolvedValue({
      status: 'stub',
      templateKey: 'iedrc-secondary-v1',
      message: 'ok',
      uploadedFile: {
        filename: 'scan.pdf',
        contentType: 'application/pdf',
        sizeBytes: 4,
      },
      metadata: {
        gradeLevel: null,
        groupCode: null,
        subjectName: null,
        teacherName: null,
      },
      rows: [],
    })

    const { scannerApi } = getExports() as {
      scannerApi: { scanPlanilla: (file: File) => Promise<unknown> }
    }
    const file = new File(['test'], 'scan.pdf', { type: 'application/pdf' })

    await scannerApi.scanPlanilla(file)

    expect(postFormMock).toHaveBeenCalledTimes(1)
    expect(postFormMock.mock.calls[0]?.[0]).toBe('/scanner/planilla')

    const formData = postFormMock.mock.calls[0]?.[1]
    expect(formData).toBeInstanceOf(FormData)
    expect((formData as FormData).get('file')).toBe(file)
  })
})
