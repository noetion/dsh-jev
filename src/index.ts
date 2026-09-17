import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { evaluateJev, JevAuthError, type FetchLike } from './client.ts'
import { Config, type Config as PluginConfig } from './config.ts'
import { resolveApiKey } from './credentials.ts'
import { JevParseError, parseRequest, type JevResult } from './domain.ts'
import { createSkillProvider } from './skills-provider.ts'

export const name = 'jev'
export const inject = ['tools']
export { Config }
export type { PluginConfig as ConfigType }

const OUTPUT = {
  schema: {
    type: 'object' as const,
    properties: {
      model: { type: 'string' as const, required: true as const },
      answers: { type: 'json' as const, required: true as const },
      usage: { type: 'json' as const },
    },
    additionalProperties: false,
  },
  render: (_args: unknown, value: JevResult) => [
    { type: 'text' as const, text: JSON.stringify(value, null, 2) },
  ],
}

function hostFetch(): FetchLike {
  return async (input, init) => {
    const response = await fetch(input, init)
    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
    }
  }
}

function resolveConfig(config?: PluginConfig): PluginConfig {
  const parsed = Config['~standard'].validate(config)
  if ('issues' in parsed) {
    const issue = Array.isArray(parsed.issues) ? parsed.issues[0] : undefined
    throw new JevParseError('config', issue?.message ?? 'invalid config')
  }
  return parsed.value
}

export function apply(ctx: Context, config?: PluginConfig): void {
  const pluginConfig = resolveConfig(config)
  ctx.tools.register(defineTool({
    name: 'jev_ask',
    description:
      'Ask TypeSafe Jev one or more typed questions over the same state. Use this for judgments the rest of the agent should branch on. Do not use it to generate prose. Each question is noul (yes/no probability), choice (one option from a set you name), or score (ordered levels). Several questions in one call run in parallel against the same state.',
    parameters: {
      state: {
        type: 'json',
        required: true,
        description: 'The evidence Jev should judge. A string, object, or array. Put source text, ids, and current facts here, not in the question ids.',
      },
      questions: {
        type: 'json',
        required: true,
        description:
          'Map of question id to { type: "noul"|"choice"|"score", instructions, criteria }. Choice criteria is an object of option to description (or null). Score criteria is an array of at least two level strings. Noul criteria is optional { true, false }.',
      },
      model: {
        type: 'string',
        description: 'TypeSafe model id or alias. Defaults to the plugin config, usually jev-latest.',
      },
    },
    output: OUTPUT,
    async execute(args, exec) {
      const request = parseRequest({
        state: args.state,
        questions: args.questions,
        model: args.model,
      }, pluginConfig.model)
      const apiKey = await resolveApiKey({
        envName: pluginConfig.apiKeyEnv,
        credentials: ctx.get('credentials') as { resolve(ref: string): Promise<{ value: string } | undefined> } | undefined,
      })
      if (apiKey === undefined) {
        throw new JevAuthError(pluginConfig.apiKeyEnv)
      }
      return evaluateJev({
        request,
        apiKey,
        endpoint: pluginConfig.endpoint,
        fetchImpl: hostFetch(),
        signal: exec.signal,
        envName: pluginConfig.apiKeyEnv,
      })
    },
  }))

  const skills = ctx.get('skills') as { registerProvider(factory: () => unknown): void } | undefined
  if (skills !== undefined) {
    skills.registerProvider(() => createSkillProvider())
  }

  const listed = ctx.tools.get('jev_ask') !== undefined
  console.log(`[jev] registered jev_ask listed=${listed}`)
  if (!listed) {
    throw new JevParseError('tools', 'jev_ask did not land in the registry')
  }
}
