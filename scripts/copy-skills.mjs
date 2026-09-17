import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const from = join(root, 'skills')
const to = join(root, 'dist', 'skills')
if (!existsSync(from)) {
  throw new Error('skills directory missing')
}
mkdirSync(dirname(to), { recursive: true })
cpSync(from, to, { recursive: true })
