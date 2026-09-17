import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { evaluateJev } from '../src/client.ts'
import { parseRequest } from '../src/domain.ts'
import { loadApiKey } from './load-key.ts'

const request = parseRequest({
  state: 'Hi, I have been trying to connect my Stripe account for 3 days and it keeps failing. I am losing sales. Please help ASAP.',
  questions: {
    department: {
      type: 'choice',
      instructions: 'Which team should handle this',
      criteria: {
        billing: 'Payment or subscription issues',
        technical: 'Bugs or integration problems',
        sales: 'Pricing or account questions',
      },
    },
    frustration: {
      type: 'score',
      instructions: 'How frustrated the customer appears',
      criteria: [
        'Calm, just stating facts',
        'Frustrated but civil',
        'Very angry, strong language',
      ],
    },
    is_urgent: {
      type: 'noul',
      instructions: 'The message conveys urgency or time-sensitivity',
    },
  },
}, 'jev-latest')

const apiKey = loadApiKey()
const result = await evaluateJev({ request, apiKey })
const department = result.answers.department
const frustration = result.answers.frustration
const urgent = result.answers.is_urgent
if (department.type !== 'choice') throw new Error('department was not a choice')
if (frustration.type !== 'score') throw new Error('frustration was not a score')
if (urgent.type !== 'noul') throw new Error('is_urgent was not a noul')
if (!['billing', 'technical', 'sales'].includes(department.choice)) {
  throw new Error(`department.choice was ${department.choice}`)
}
if (urgent.noul < 0.5) {
  throw new Error(`expected urgency noul >= 0.5, got ${urgent.noul}`)
}
const out = {
  ok: true,
  model: result.model,
  department: department.choice,
  frustration: frustration.score,
  urgency: urgent.noul,
  usage: result.usage ?? null,
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
mkdirSync(join(root, 'results'), { recursive: true })
writeFileSync(join(root, 'results', 'live-smoke.json'), `${JSON.stringify(out, null, 2)}\n`)
console.log(JSON.stringify(out))
