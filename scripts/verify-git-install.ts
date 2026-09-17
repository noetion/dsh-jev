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

function add(): { status: number | null; output: string } {
  const pnpm = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'
  const result = spawnSync(pnpm, ['add', spec], {
    cwd: dummy,
    encoding: 'utf8',
  })
  return { status: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

const first = add()
if (first.status !== 0) {
  throw new Error(`pnpm add ${spec} exited ${first.status}\n${first.output}`)
}

const entry = join(dummy, 'node_modules', 'dsh-jev', 'dist', 'index.js')
if (!existsSync(entry)) {
  throw new Error(`git install did not write ${entry}\n${first.output}`)
}
console.log(JSON.stringify({ ok: true, dummy, entry, allowBuildsKey: key }))
