import { existsSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { userInfo } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

type Check = { id: string; ok: boolean; detail: string }

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8')
}

function trackedFiles(): string[] {
  const result = spawnSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`)
  }
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

const checks: Check[] = []

function check(id: string, ok: boolean, detail: string): void {
  checks.push({ id, ok, detail })
}

const readme = read('README.md')
const pkg = JSON.parse(read('package.json')) as {
  description?: string
  version?: string
  scripts?: Record<string, string>
}

check('readme_allow_builds', /allowBuilds/.test(readme), 'README shows pnpm allowBuilds for git install')
check('readme_commit_pin', /github:noetion\/dsh-jev#/.test(readme), 'README pins github:noetion/dsh-jev to a commit')
check('readme_status', /\b0\.1\.0\b/.test(readme), 'README states version 0.1.0')
check('readme_dsh_pin', /0\.1\.5-rc\.2/.test(readme), 'README names DSH 0.1.5-rc.2')
check('readme_api_key', /TYPESAFE_API_KEY/.test(readme), 'README names TYPESAFE_API_KEY')
check('readme_endpoint', /api\.typesafe\.ai/.test(readme), 'README names the TypeSafe endpoint')
check(
  'readme_not_chat',
  /does not generate chat/i.test(readme) || /not an LLM adapter/i.test(readme),
  'README says Jev is not a chat model',
)
check('readme_license', /\bMIT\b/.test(readme) && existsSync(join(root, 'LICENSE')), 'README names MIT and LICENSE exists')
check(
  'readme_support',
  /GitHub issue/i.test(readme) || /open an issue/i.test(readme),
  'README says how to get support',
)
check('security_md', existsSync(join(root, 'SECURITY.md')), 'SECURITY.md exists')
check(
  'package_description',
  typeof pkg.description === 'string'
    && !/any DSH agent/i.test(pkg.description)
    && /jev_ask/.test(pkg.description),
  'package.json description names jev_ask and does not say any DSH agent',
)
check(
  'no_decisions_tsv',
  !trackedFiles().includes('decisions.tsv') || !existsSync(join(root, 'decisions.tsv')),
  'lab decisions.tsv is not in the working tree',
)

function localUserNames(): string[] {
  const candidates: Array<string | undefined> = [process.env.USERNAME, process.env.USER]
  try {
    candidates.push(userInfo().username)
  } catch {
    // userInfo() throws where the platform has no passwd entry; the env vars cover that.
  }
  return [...new Set(
    candidates
      .filter((name): name is string => typeof name === 'string' && name.trim().length >= 3)
      .map((name) => name.trim().toLowerCase()),
  )]
}

const userNames = localUserNames()

const hostHit = trackedFiles().flatMap((file) => {
  const path = join(root, file)
  if (!existsSync(path)) return []
  const text = read(file)
  const lowered = text.toLowerCase()
  const hits: string[] = []
  if (userNames.some((name) => lowered.includes(name))) hits.push(`${file}:username`)
  if (/C:\\Users\\/i.test(text)) hits.push(`${file}:C:\\Users`)
  if (/\/Users\/[A-Za-z]/.test(text)) hits.push(`${file}:/Users`)
  if (/\/home\/[A-Za-z]/.test(text)) hits.push(`${file}:/home`)
  return hits
})
check('no_host_paths', hostHit.length === 0, hostHit.join(', ') || 'no host paths in tracked files')

check(
  'prepare_script',
  pkg.scripts?.prepare === 'npm run build',
  'prepare builds dist for git installs',
)

const full = process.argv.includes('--full')
if (full) {
  const dist = join(root, 'dist', 'index.js')
  check('dist_built', existsSync(dist), 'dist/index.js exists after build')
}

const passed = checks.filter((item) => item.ok).length
const result = {
  ok: passed === checks.length,
  passed,
  total: checks.length,
  failed: checks.filter((item) => !item.ok).map((item) => item.id),
  checks,
}
console.log(JSON.stringify(result, null, 2))
if (!result.ok) process.exit(1)
