import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { hasPrivateHostPath } from '../scripts/private-paths.ts'

test('detects real home paths on each platform while preserving public attribution', () => {
  for (const path of [
    ['','Users','alice','project'].join('/'),
    ['','home','9user','project'].join('/'),
    ['C:', 'Users', 'alice', 'project'].join('\\'),
    ['D:', 'Users', 'alice', 'project'].join('/'),
    ['C:', 'Users', 'alice', 'project'].join('\\\\'),
    ['file://', 'Users', 'alice', 'project'].join('/'),
  ]) assert.equal(hasPrivateHostPath(path), true, path)
  assert.equal(hasPrivateHostPath('https://github.com/noetion/dsh-jev Copyright noetion'), false)
  assert.equal(hasPrivateHostPath('src/users/profile.ts'), false)
  assert.equal(hasPrivateHostPath(['https://example.com', 'Users', 'public'].join('/')), false)
})

test('public repository owner matching the local username is not a private path', () => {
  const run = spawnSync(process.execPath, ['--experimental-strip-types', 'scripts/adopt-check.ts'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
    env: { ...process.env, USER: 'noetion', USERNAME: 'noetion' },
  })
  const result = JSON.parse(run.stdout)
  assert.equal(result.checks.find((check: { id: string }) => check.id === 'no_host_paths').ok, true)
  assert.equal(run.status, 0, run.stdout + run.stderr)
})
