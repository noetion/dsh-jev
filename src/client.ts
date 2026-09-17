import {
  JevParseError,
  parseResult,
  toWireBody,
  type JevRequest,
  type JevResult,
} from './domain.ts'

export const DEFAULT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone'
export const DEFAULT_MODEL = 'jev-latest'

export type FetchLike = (
  input: string,
  init: {
    method: string
    headers: Record<string, string>
    body: string
    signal?: AbortSignal
  },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>

export class JevHttpError extends Error {
  readonly status: number
  readonly body: string

  constructor(status: number, body: string) {
    const clipped = body.trim().slice(0, 500)
    super(clipped === '' ? `TypeSafe returned ${status}` : `TypeSafe returned ${status}: ${clipped}`)
    this.name = 'JevHttpError'
    this.status = status
    this.body = body
  }
}

export class JevAuthError extends Error {
  readonly envName: string

  constructor(envName = 'TYPESAFE_API_KEY') {
    super(`${envName} is not configured. Set it in the process environment or in DSH credentials under that name.`)
    this.name = 'JevAuthError'
    this.envName = envName
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function evaluateJev(options: {
  request: JevRequest
  apiKey: string
  endpoint?: string
  fetchImpl?: FetchLike
  signal?: AbortSignal
  attempt?: number
  envName?: string
}): Promise<JevResult> {
  const envName = options.envName ?? 'TYPESAFE_API_KEY'
  if (options.apiKey.trim() === '') {
    throw new JevAuthError(envName)
  }
  const attempt = options.attempt ?? 0
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const fetchImpl = options.fetchImpl ?? fetch
  let response: { ok: boolean; status: number; text(): Promise<string> }
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(toWireBody(options.request)),
      ...options.signal ? { signal: options.signal } : {},
    })
  } catch (cause) {
    if (attempt < 3 && options.signal?.aborted !== true) {
      await sleep(400 * (attempt + 1))
      return evaluateJev({ ...options, attempt: attempt + 1 })
    }
    throw cause
  }
  const text = await response.text()
  if ((response.status === 429 || response.status === 529 || response.status >= 500) && attempt < 3) {
    await sleep(600 * 2 ** attempt)
    return evaluateJev({ ...options, attempt: attempt + 1 })
  }
  if (response.status === 401) {
    throw new JevAuthError(envName)
  }
  if (!response.ok) {
    throw new JevHttpError(response.status, text)
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new JevParseError('body', 'TypeSafe response was not JSON')
  }
  return parseResult(parsed, options.request.questions)
}
