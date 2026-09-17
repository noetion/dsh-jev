import assert from 'node:assert/strict'
import { test } from 'node:test'
import { Config } from '../src/config.ts'
import { resolveApiKey } from '../src/credentials.ts'
import { createSkillProvider } from '../src/skills-provider.ts'

test('config fills TypeSafe defaults and rejects a bad env name', () => {
  const ok = Config['~standard'].validate(undefined)
  assert.equal('value' in ok && ok.value.model, 'jev-latest')
  assert.equal('value' in ok && ok.value.apiKeyEnv, 'TYPESAFE_API_KEY')
  const bad = Config['~standard'].validate({ apiKeyEnv: 'not a name' })
  assert.equal('issues' in bad, true)
})

test('resolveApiKey prefers a live env value over credentials', async () => {
  const fromEnv = await resolveApiKey({
    envName: 'TYPESAFE_API_KEY',
    env: { TYPESAFE_API_KEY: 'env-key' },
    credentials: { resolve: async () => ({ value: 'stored-key' }) },
  })
  assert.equal(fromEnv, 'env-key')
  const fromStore = await resolveApiKey({
    envName: 'TYPESAFE_API_KEY',
    env: {},
    credentials: { resolve: async () => ({ value: 'stored-key' }) },
  })
  assert.equal(fromStore, 'stored-key')
  const missing = await resolveApiKey({
    envName: 'TYPESAFE_API_KEY',
    env: {},
  })
  assert.equal(missing, undefined)
})

test('bundled jev skill is loadable from disk', async () => {
  const provider = createSkillProvider()
  const list = await provider.list()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, 'jev')
  const skill = await provider.get({ name: 'jev' })
  assert.equal(skill?.name, 'jev')
  assert.match(skill?.body ?? '', /jev_ask/)
  assert.match(skill?.body ?? '', /Do not put API keys/)
})
