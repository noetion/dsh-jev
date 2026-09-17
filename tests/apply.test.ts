import assert from 'node:assert/strict'
import { test } from 'node:test'
import { apply } from '../src/index.ts'
import { JevAuthError } from '../src/client.ts'

test('apply registers jev_ask and execute returns a parsed noul', async () => {
  let tool: { name?: string; execute?: Function } | undefined
  const ctx = {
    tools: {
      register(definition: { name?: string; execute?: Function }) {
        tool = definition
        return () => {}
      },
      get(name: string) {
        return name === 'jev_ask' ? tool : undefined
      },
    },
    get() {
      return undefined
    },
  }
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => ({
    ok: true,
    status: 200,
    text: async () => JSON.stringify({
      model: 'jev-1.13.0',
      answers: { is_urgent: { type: 'noul', noul: 0.92 } },
    }),
  })) as unknown as typeof fetch
  try {
    apply(ctx as never, { model: 'jev-latest', endpoint: 'https://api.typesafe.ai/v1/systemone', apiKeyEnv: 'TYPESAFE_API_KEY' })
    assert.equal(tool?.name, 'jev_ask')
    assert.equal(typeof tool?.execute, 'function')
    const previous = process.env.TYPESAFE_API_KEY
    process.env.TYPESAFE_API_KEY = 'test-key'
    try {
      const result = await tool!.execute!(
        {
          state: 'Help! My payouts have been failing for 3 days.',
          questions: {
            is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
          },
        },
        { signal: new AbortController().signal },
      )
      assert.equal(result.model, 'jev-1.13.0')
      assert.equal(result.answers.is_urgent.noul, 0.92)
    } finally {
      if (previous === undefined) delete process.env.TYPESAFE_API_KEY
      else process.env.TYPESAFE_API_KEY = previous
    }
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('execute throws JevAuthError that names the env when the key is missing', async () => {
  let tool: { execute?: Function } | undefined
  const ctx = {
    tools: {
      register(definition: { execute?: Function }) {
        tool = definition
        return () => {}
      },
      get(name: string) {
        return name === 'jev_ask' ? tool : undefined
      },
    },
    get() {
      return undefined
    },
  }
  apply(ctx as never, { model: 'jev-latest', endpoint: 'https://api.typesafe.ai/v1/systemone', apiKeyEnv: 'DSH_JEV_TEST_KEY' })
  const previous = process.env.DSH_JEV_TEST_KEY
  delete process.env.DSH_JEV_TEST_KEY
  try {
    await assert.rejects(
      () => tool!.execute!(
        {
          state: 'x',
          questions: { is_urgent: { type: 'noul', instructions: 'urgent?' } },
        },
        { signal: new AbortController().signal },
      ),
      (error: unknown) => error instanceof JevAuthError && /DSH_JEV_TEST_KEY/.test(error.message),
    )
  } finally {
    if (previous === undefined) delete process.env.DSH_JEV_TEST_KEY
    else process.env.DSH_JEV_TEST_KEY = previous
  }
})
