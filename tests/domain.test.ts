import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  JevParseError,
  parseQuestion,
  parseAnswer,
  parseRequest,
  parseResult,
  toWireBody,
} from '../src/domain.ts'

test('preserves special JSON keys throughout requests and wire serialization', () => {
  const raw = JSON.parse('{"state":{"__proto__":{"polluted":true},"constructor":{"prototype":{"toString":"data"}}},"questions":{"__proto__":{"type":"choice","instructions":"pick","criteria":{"__proto__":"first","constructor":"second","prototype":null,"toString":"fourth"}},"constructor":{"type":"noul","instructions":"yes?"},"prototype":{"type":"score","instructions":"rate","criteria":["low","high"]},"toString":{"type":"noul","instructions":"yes?"}},"model":"jev-latest"}')
  const request = parseRequest(raw, 'jev-latest')
  assert.deepEqual(JSON.parse(JSON.stringify(toWireBody(request))), raw)
  assert.equal(Object.hasOwn(request.questions, '__proto__'), true)
  assert.equal(Object.getPrototypeOf(request.questions), Object.prototype)
  assert.equal(Object.getPrototypeOf(request.state), Object.prototype)
  assert.equal(Object.hasOwn(Object.prototype, 'polluted'), false)
})

test('preserves special answer, probability, and legend keys', () => {
  const raw = JSON.parse('{"type":"score","score":1,"legend":{"__proto__":"a","constructor":"b","prototype":"c","toString":"d"},"probabilities":{"__proto__":0.1,"constructor":0.2,"prototype":0.3,"toString":0.4},"confidence":0.5}')
  assert.deepEqual(JSON.parse(JSON.stringify(parseAnswer(raw))), raw)
  const choice = { ...raw, type: 'choice', choice: '__proto__' }
  const parsedChoice = parseAnswer(choice)
  assert.deepEqual(JSON.parse(JSON.stringify(parsedChoice)), {
    type: 'choice', choice: '__proto__', probabilities: raw.probabilities, confidence: 0.5,
  })
  const asked = JSON.parse('{"__proto__":{"type":"score"},"constructor":{"type":"score"},"prototype":{"type":"score"},"toString":{"type":"score"}}')
  const answers = Object.fromEntries(Object.keys(asked).map((id) => [id, raw]))
  const result = parseResult({ model: 'jev-latest', answers }, asked)
  assert.deepEqual(JSON.parse(JSON.stringify(result)), {
    model: 'jev-latest', answers,
  })
  assert.equal(Object.getPrototypeOf(result.answers), Object.prototype)
})

test('requires own answers even when an answer exists on the prototype', () => {
  const asked = { constructor: { type: 'noul' as const, instructions: 'yes?' } }
  const inherited = Object.create({ constructor: { type: 'noul', noul: 0.7 } })
  assert.throws(() => parseResult({ model: 'jev-latest', answers: inherited }, asked), {
    name: 'JevParseError', field: 'answers.constructor', message: 'missing answer for asked question',
  })
  assert.deepEqual(parseResult({ model: 'jev-latest', answers: { constructor: { type: 'noul', noul: 0.7 } } }, asked), {
    model: 'jev-latest', answers: { constructor: { type: 'noul', noul: 0.7 } },
  })
})

test('parses the TypeSafe docs noul and rejects a one-option choice', () => {
  const noul = parseQuestion({
    type: 'noul',
    instructions: 'Does this convey urgency?',
    criteria: { true: 'Explicitly time-sensitive', false: 'No urgency expressed' },
  })
  assert.deepEqual(noul, {
    type: 'noul',
    instructions: 'Does this convey urgency?',
    criteria: { true: 'Explicitly time-sensitive', false: 'No urgency expressed' },
  })
  assert.throws(
    () => parseQuestion({ type: 'choice', instructions: 'pick', criteria: { only: 'one' } }),
    JevParseError,
  )
})

test('round-trips the published quickstart request body', () => {
  const request = parseRequest({
    state: 'Hi, I have been trying to connect my Stripe account for 3 days and it keeps failing. I am losing sales. Please help ASAP.',
    model: 'jev-latest',
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
  assert.deepEqual(toWireBody(request), {
    state: 'Hi, I have been trying to connect my Stripe account for 3 days and it keeps failing. I am losing sales. Please help ASAP.',
    model: 'jev-latest',
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
  })
})

test('parses the published quickstart response and rejects a type mismatch', () => {
  const asked = parseRequest({
    state: 'ticket',
    questions: {
      department: {
        type: 'choice',
        instructions: 'Which team should handle this',
        criteria: { billing: null, technical: null, sales: null },
      },
      frustration: {
        type: 'score',
        instructions: 'How frustrated the customer appears',
        criteria: ['Calm, just stating facts', 'Frustrated but civil', 'Very angry, strong language'],
      },
      is_urgent: {
        type: 'noul',
        instructions: 'The message conveys urgency or time-sensitivity',
      },
    },
  }, 'jev-latest').questions
  const result = parseResult({
    model: 'jev-latest',
    answers: {
      department: {
        type: 'choice',
        choice: 'technical',
        probabilities: { billing: 0.159, technical: 0.84, sales: 0.001 },
        confidence: 0.596,
      },
      frustration: {
        type: 'score',
        score: 1.035,
        legend: {
          '0': 'Calm, just stating facts',
          '1': 'Frustrated but civil',
          '2': 'Very angry, strong language',
        },
        probabilities: { '0': 0.05, '1': 0.86, '2': 0.09 },
        confidence: 0.842,
      },
      is_urgent: {
        type: 'noul',
        noul: 0.999,
      },
    },
    usage: { input_tokens: 312, output_tokens: 48 },
  }, asked)
  assert.equal(result.answers.department.type, 'choice')
  if (result.answers.department.type === 'choice') {
    assert.equal(result.answers.department.choice, 'technical')
  }
  assert.equal(result.answers.is_urgent.type, 'noul')
  if (result.answers.is_urgent.type === 'noul') {
    assert.equal(result.answers.is_urgent.noul, 0.999)
  }
  assert.deepEqual(result.usage, { input_tokens: 312, output_tokens: 48 })
  assert.throws(
    () => parseResult({
      model: 'jev-latest',
      answers: {
        department: { type: 'noul', noul: 0.2 },
        frustration: {
          type: 'score',
          score: 1,
          legend: { '0': 'a', '1': 'b' },
          probabilities: { '0': 0.5, '1': 0.5 },
          confidence: 0.5,
        },
        is_urgent: { type: 'noul', noul: 0.1 },
      },
    }, asked),
    JevParseError,
  )
})
