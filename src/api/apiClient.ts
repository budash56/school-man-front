const ABSOLUTE_URL_REGEX = /^https?:\/\//i
const RAW_API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.trim()
const API_BASE_URL = RAW_API_BASE_URL && RAW_API_BASE_URL.length > 0 ? RAW_API_BASE_URL : '/api'
const IS_ABSOLUTE_BASE_URL = ABSOLUTE_URL_REGEX.test(API_BASE_URL)

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

type QueryParams = Record<string, string | number | boolean | undefined>

type RequestOptions = {
  query?: QueryParams
  body?: unknown
}

let getAccessToken: () => string | null = () => null

export const setAccessTokenGetter = (fn: () => string | null) => {
  getAccessToken = fn
}

const buildQueryString = (query?: QueryParams) => {
  if (!query) {
    return ''
  }

  const searchParams = new URLSearchParams()
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined) {
      return
    }
    searchParams.append(key, String(value))
  })

  const queryString = searchParams.toString()
  return queryString ? `?${queryString}` : ''
}

const buildUrl = (path: string, query?: QueryParams) => {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const queryString = buildQueryString(query)

  if (IS_ABSOLUTE_BASE_URL) {
    const base = API_BASE_URL.replace(/\/$/, '')
    return `${base}${normalizedPath}${queryString}`
  }

  const trimmedBase = API_BASE_URL === '/' ? '' : API_BASE_URL.replace(/\/$/, '')
  const prefix = trimmedBase ? (trimmedBase.startsWith('/') ? trimmedBase : `/${trimmedBase}`) : ''
  return `${prefix}${normalizedPath}${queryString}`
}

async function request<T>(method: HttpMethod, path: string, options?: RequestOptions): Promise<T> {
  const url = buildUrl(path, options?.query)
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const token = getAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = {
    method,
    headers,
  }

  if (options?.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    init.body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    console.error('API request failed', { url, error })
    throw new ApiError(0, 'No se pudo conectar con el servidor. Intenta de nuevo.', error)
  }
  const responseText = await response.text()
  let data: unknown = undefined

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = responseText
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message?: unknown }).message ?? response.statusText)
      : response.statusText
    throw new ApiError(response.status, message || 'Request failed', data)
  }

  return data as T
}

async function requestForm<T>(method: HttpMethod, path: string, formData: FormData, query?: QueryParams): Promise<T> {
  const url = buildUrl(path, query)
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }

  const token = getAccessToken()
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const init: RequestInit = {
    method,
    headers,
    body: formData,
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch (error) {
    console.error('API request failed', { url, error })
    throw new ApiError(0, 'No se pudo conectar con el servidor. Intenta de nuevo.', error)
  }

  const responseText = await response.text()
  let data: unknown = undefined

  if (responseText) {
    try {
      data = JSON.parse(responseText)
    } catch {
      data = responseText
    }
  }

  if (!response.ok) {
    const message = typeof data === 'object' && data !== null && 'message' in data
      ? String((data as { message?: unknown }).message ?? response.statusText)
      : response.statusText
    throw new ApiError(response.status, message || 'Request failed', data)
  }

  return data as T
}

export const apiClient = {
  get: <T>(path: string, options?: { query?: QueryParams }) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }),
  del: <T>(path: string) => request<T>('DELETE', path),
  postForm: <T>(path: string, formData: FormData, query?: QueryParams) =>
    requestForm<T>('POST', path, formData, query),
}
