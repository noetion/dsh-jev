import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dummy = mkdtempSync(join(tmpdir(), 'dsh-jev-git-'))
const spec = `git+file:///${root.replace(/\\/g, '/')}`
const sha = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' })
if (sha.status !== 0) {
  throw new Error(`git rev-parse failed: ${sha.stderr}`)
}
const key = `dsh-jev@${spec}#${sha.stdout.trim()}`

writeFileSync(join(dummy, 'package.json'), `${JSON.stringify({ name: 'dsh-jev-git-probe', private: true }, null, 2)}\n`)
writeFileSync(join(dummy, 'pnpm-workspace.yaml'), `allowBuilds:\n  ${JSON.stringify(key)}: true\n`)

// Node 22 and later refuse to spawn a .cmd shim without a shell, so run pnpm's JS
// entry with the current node and fall back to the PATH shim only on POSIX.
function pnpmCli(): string | undefined {
  const binDirs = [
    join(dirname(process.execPath), 'node_modules', 'pnpm', 'bin'),
    join(dirname(process.execPath), '..', 'lib', 'node_modules', 'pnpm', 'bin'),
  ]
  if (process.env.APPDATA) {
    binDirs.unshift(join(process.env.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin'))
  }
  for (const dir of binDirs) {
    for (const name of ['pnpm.cjs', 'pnpm.mjs']) {
      const entry = join(dir, name)
      if (existsSync(entry)) return entry
    }
  }
  return undefined
}

function add(): { status: number | null; error?: string; output: string } {
  const cli = pnpmCli()
  const result = cli === undefined
    ? spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['add', spec], {
      cwd: dummy,
      encoding: 'utf8',
    })
    : spawnSync(process.execPath, [cli, 'add', spec], {
      cwd: dummy,
      encoding: 'utf8',
    })
  return {
    status: result.status,
    ...result.error ? { error: result.error.message } : {},
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
  }
}

const first = add()
if (first.status !== 0) {
  const reason = first.error === undefined ? '' : ` (${first.error})`
  throw new Error(`pnpm add ${spec} exited ${first.status}${reason}\n${first.output}`)
}

const entry = join(dummy, 'node_modules', 'dsh-jev', 'dist', 'index.js')
if (!existsSync(entry)) {
  throw new Error(`git install did not write ${entry}\n${first.output}`)
}
console.log(JSON.stringify({ ok: true, dummy, entry, allowBuildsKey: key }))
