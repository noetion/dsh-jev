import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BUNDLED_SKILL_RANK = 600
const PROVIDER = 'jev-bundled'

export function defaultSkillsRoot(): string {
  return join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
}

function parseFrontmatter(text: string): { name: string; description: string; whenToUse?: string; body: string } | undefined {
  if (!text.startsWith('---')) return undefined
  const end = text.indexOf('\n---', 3)
  if (end === -1) return undefined
  const raw = text.slice(3, end).trim()
  const body = text.slice(end + 4).replace(/^\s+/, '')
  const fields: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1).trim().replace(/^["']|["']$/g, '')
    fields[key] = value
  }
  if (!fields.name || !fields.description) return undefined
  return {
    name: fields.name,
    description: fields.description,
    ...fields['when-to-use'] || fields.whenToUse
      ? { whenToUse: fields['when-to-use'] ?? fields.whenToUse }
      : {},
    body,
  }
}

export function createSkillProvider(skillsRoot = defaultSkillsRoot()) {
  async function load() {
    let names: string[] = []
    try {
      names = await readdir(skillsRoot)
    } catch {
      return []
    }
    const skills = []
    for (const name of names) {
      const dir = join(skillsRoot, name)
      let text: string
      try {
        text = await readFile(join(dir, 'SKILL.md'), 'utf8')
      } catch {
        continue
      }
      const parsed = parseFrontmatter(text)
      if (parsed === undefined) continue
      skills.push({
        name: parsed.name,
        description: parsed.description,
        whenToUse: parsed.whenToUse,
        content: parsed.body,
        dir,
      })
    }
    return skills
  }

  return {
    name: PROVIDER,
    async list() {
      const skills = await load()
      return skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        ...skill.whenToUse ? { whenToUse: skill.whenToUse } : {},
        invocation: { modelInvocable: true, userInvocable: true },
        provider: PROVIDER,
        source: 'bundled' as const,
        resourceBase: { kind: 'directory' as const, path: skill.dir },
        rank: BUNDLED_SKILL_RANK,
        locator: skill.dir,
        path: join(skill.dir, 'SKILL.md'),
      }))
    },
    async get(candidate: { name: string }) {
      const skills = await load()
      const skill = skills.find((entry) => entry.name === candidate.name)
      if (skill === undefined) return undefined
      return {
        name: skill.name,
        description: skill.description,
        ...skill.whenToUse ? { whenToUse: skill.whenToUse } : {},
        invocation: { modelInvocable: true, userInvocable: true },
        body: skill.content,
        location: join(skill.dir, 'SKILL.md'),
      }
    },
  }
}
