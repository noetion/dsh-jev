export type CredentialResolver = {
  resolve(ref: string): Promise<{ value: string } | undefined>
}

export async function resolveApiKey(options: {
  envName: string
  env?: NodeJS.ProcessEnv
  credentials?: CredentialResolver
}): Promise<string | undefined> {
  const env = options.env ?? process.env
  const fromEnv = env[options.envName]
  if (typeof fromEnv === 'string' && fromEnv.trim() !== '') {
    return fromEnv
  }
  const resolved = await options.credentials?.resolve(options.envName)
  if (resolved?.value && resolved.value.trim() !== '') {
    return resolved.value
  }
  return undefined
}
