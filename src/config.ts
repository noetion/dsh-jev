import { DEFAULT_ENDPOINT, DEFAULT_MODEL } from './client.ts'

export interface Config {
  model: string
  endpoint: string
  apiKeyEnv: string
}

export const Config = {
  '~standard': {
    version: 1 as const,
    vendor: 'dsh-jev',
    validate(value: unknown): { value: Config } | { issues: { message: string }[] } {
      if (value === undefined || value === null) {
        return {
          value: {
            model: DEFAULT_MODEL,
            endpoint: DEFAULT_ENDPOINT,
            apiKeyEnv: 'TYPESAFE_API_KEY',
          } satisfies Config,
        }
      }
      if (typeof value !== 'object' || Array.isArray(value)) {
        return { issues: [{ message: 'config must be an object' }] }
      }
      const raw = value as {
        model?: unknown
        endpoint?: unknown
        apiKeyEnv?: unknown
      }
      if (raw.model !== undefined && (typeof raw.model !== 'string' || raw.model.trim() === '')) {
        return { issues: [{ message: 'model must be a non-empty string' }] }
      }
      if (raw.endpoint !== undefined && (typeof raw.endpoint !== 'string' || raw.endpoint.trim() === '')) {
        return { issues: [{ message: 'endpoint must be a non-empty string' }] }
      }
      if (raw.apiKeyEnv !== undefined && (typeof raw.apiKeyEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw.apiKeyEnv))) {
        return { issues: [{ message: 'apiKeyEnv must be a POSIX environment-variable name' }] }
      }
      return {
        value: {
          model: raw.model ?? DEFAULT_MODEL,
          endpoint: raw.endpoint ?? DEFAULT_ENDPOINT,
          apiKeyEnv: raw.apiKeyEnv ?? 'TYPESAFE_API_KEY',
        } satisfies Config,
      }
    },
  },
}
