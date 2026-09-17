import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const home = mkdtempSync(join(tmpdir(), 'dsh-jev-'))
const env = { ...process.env, DSH_HOME: home }

function npxCli(): string {
  const candidates = [
    join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npx-cli.js'),
  ]
  const found = candidates.find((path) => existsSync(path))
  if (found === undefined) {
    throw new Error('npx-cli.js not found next to node')
  }
  return found
}

function run(args: string[]): string {
  const command = process.env.DSH_BIN
  const result = command
    ? spawnSync(command, args, { cwd: root, env, encoding: 'utf8' })
    : spawnSync(process.execPath, [npxCli(), '--yes', '@deepseek-ai/dsh', ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
    })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  if (result.error) {
    throw new Error(`dsh spawn failed: ${result.error.message}`)
  }
  if (result.status !== 0) {
    throw new Error(`dsh ${args.join(' ')} exited ${result.status}\n${output}`)
  }
  return output
}

run(['plugin', '--profile', 'dsh-jev-verify', 'add', root])
const dumped = run(['--profile', 'dsh-jev-verify', '--dump-config'])
if (!dumped.includes('dsh-jev') && !/id:\s*jev\b/.test(dumped)) {
  throw new Error('dump-config did not name the dsh-jev bundle')
}
mkdirSync(join(root, 'results'), { recursive: true })
writeFileSync(
  join(root, 'results', 'verify-boot.json'),
  `${JSON.stringify({ ok: true, mentionedJev: true, jevLines: dumped.split(/\r?\n/).filter((line) => /jev/i.test(line)).length }, null, 2)}\n`,
)
console.log(JSON.stringify({ ok: true, profile: 'dsh-jev-verify' }))
