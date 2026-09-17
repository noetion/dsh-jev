import assert from 'node:assert/strict'
import { test } from 'node:test'
import { evaluateJev, JevAuthError, JevHttpError, type FetchLike } from '../src/client.ts'
import { parseRequest } from '../src/domain.ts'

const request = parseRequest({
  state: 'Help! My payouts have been failing for 3 days.',
  questions: {
    is_urgent: {
      type: 'noul',
      instructions: 'Does this convey urgency?',
    },
  },
}, 'jev-latest')

test('posts the wire body and returns the parsed noul', async () => {
  const calls: Array<{ url: string; auth: string; body: unknown }> = []
  const fetchImpl: FetchLike = async (url, init) => {
    calls.push({
      url,
      auth: init.headers.Authorization,
      body: JSON.parse(init.body),
    })
    return {
      ok: true,
      status: 200,
      async text() {
        return JSON.stringify({
          model: 'jev-1.13.0',
          answers: { is_urgent: { type: 'noul', noul: 0.92 } },
          usage: { input_tokens: 312, output_tokens: 48 },
        })
      },
    }
  }
  const result = await evaluateJev({
    request,
    apiKey: 'test-key',
    fetchImpl,
  })
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://api.typesafe.ai/v1/systemone')
  assert.equal(calls[0].auth, 'Bearer test-key')
  assert.deepEqual(calls[0].body, {
    state: 'Help! My payouts have been failing for 3 days.',
    model: 'jev-latest',
    questions: {
      is_urgent: { type: 'noul', instructions: 'Does this convey urgency?' },
    },
  })
  assert.equal(result.model, 'jev-1.13.0')
  assert.equal(result.answers.is_urgent.type, 'noul')
  if (result.answers.is_urgent.type === 'noul') {
    assert.equal(result.answers.is_urgent.noul, 0.92)
  }
})

test('throws JevAuthError on an empty key and on HTTP 401', async () => {
  await assert.rejects(
    () => evaluateJev({ request, apiKey: '  ', envName: 'CUSTOM_KEY', fetchImpl: async () => {
      throw new Error('should not fetch')
    } }),
    (error: unknown) => error instanceof JevAuthError && error.envName === 'CUSTOM_KEY' && /CUSTOM_KEY/.test(error.message),
  )
  await assert.rejects(
    () => evaluateJev({
      request,
      apiKey: 'test-key',
      envName: 'CUSTOM_KEY',
      fetchImpl: async () => ({ ok: false, status: 401, text: async () => 'nope' }),
    }),
    (error: unknown) => error instanceof JevAuthError && error.envName === 'CUSTOM_KEY',
  )
})

test('throws JevHttpError on 422 without retrying', async () => {
  let calls = 0
  await assert.rejects(
    () => evaluateJev({
      request,
      apiKey: 'test-key',
      fetchImpl: async () => {
        calls += 1
        return { ok: false, status: 422, text: async () => '{"error":"bad question"}' }
      },
    }),
    (error: unknown) =>
      error instanceof JevHttpError
      && error.status === 422
      && error.body === '{"error":"bad question"}'
      && error.message.includes('{"error":"bad question"}'),
  )
  assert.equal(calls, 1)
})
