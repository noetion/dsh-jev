import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function parseEnvFile(path: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      if (!out.TYPESAFE_API_KEY) out.TYPESAFE_API_KEY = trimmed
      continue
    }
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (value) out[key] = value
  }
  return out
}

export function loadApiKey(): string {
  if (process.env.TYPESAFE_API_KEY && process.env.TYPESAFE_API_KEY.trim() !== '') {
    return process.env.TYPESAFE_API_KEY
  }
  const file = process.env.TYPESAFE_KEY_FILE
  if (file && existsSync(file)) {
    const parsed = parseEnvFile(resolve(file))
    const key = parsed.TYPESAFE_API_KEY
    if (key) return key
  }
  throw new Error('Set TYPESAFE_API_KEY or TYPESAFE_KEY_FILE')
}
