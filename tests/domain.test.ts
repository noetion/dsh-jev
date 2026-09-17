import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  JevParseError,
  parseQuestion,
  parseRequest,
  parseResult,
  toWireBody,
} from '../src/domain.ts'

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
