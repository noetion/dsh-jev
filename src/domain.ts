export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type NoulQuestion = {
  type: 'noul'
  instructions: string
  criteria?: { true?: string; false?: string }
}

export type ChoiceQuestion = {
  type: 'choice'
  instructions: string
  criteria: Record<string, string | null>
}

export type ScoreQuestion = {
  type: 'score'
  instructions: string
  criteria: string[]
}

export type JevQuestion = NoulQuestion | ChoiceQuestion | ScoreQuestion

export type NoulAnswer = {
  type: 'noul'
  noul: number
}

export type ChoiceAnswer = {
  type: 'choice'
  choice: string
  probabilities: Record<string, number>
  confidence: number
}

export type ScoreAnswer = {
  type: 'score'
  score: number
  legend: Record<string, string>
  probabilities: Record<string, number>
  confidence: number
}

export type JevAnswer = NoulAnswer | ChoiceAnswer | ScoreAnswer

export type JevRequest = {
  state: JsonValue
  questions: Record<string, JevQuestion>
  model: string
}

export type JevUsage = {
  input_tokens: number
  output_tokens: number
}

export type JevResult = {
  model: string
  answers: Record<string, JevAnswer>
  usage?: JevUsage
}

export class JevParseError extends Error {
  readonly field: string

  constructor(field: string, message: string) {
    super(message)
    this.name = 'JevParseError'
    this.field = field
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function asJsonValue(value: unknown, field: string): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => asJsonValue(item, `${field}[${index}]`))
  }
  if (isRecord(value)) {
    const out: { [key: string]: JsonValue } = {}
    for (const [key, item] of Object.entries(value)) {
      out[key] = asJsonValue(item, `${field}.${key}`)
    }
    return out
  }
  throw new JevParseError(field, 'state must be JSON')
}

function parseInstructions(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new JevParseError(field, 'instructions must be a non-empty string')
  }
  return value
}

function parseNoul(raw: Record<string, unknown>, field: string): NoulQuestion {
  const question: NoulQuestion = {
    type: 'noul',
    instructions: parseInstructions(raw.instructions, `${field}.instructions`),
  }
  if (raw.criteria === undefined) {
    return question
  }
  if (!isRecord(raw.criteria)) {
    throw new JevParseError(`${field}.criteria`, 'noul criteria must be an object')
  }
  const criteria: { true?: string; false?: string } = {}
  if (raw.criteria.true !== undefined) {
    if (typeof raw.criteria.true !== 'string') {
      throw new JevParseError(`${field}.criteria.true`, 'must be a string')
    }
    criteria.true = raw.criteria.true
  }
  if (raw.criteria.false !== undefined) {
    if (typeof raw.criteria.false !== 'string') {
      throw new JevParseError(`${field}.criteria.false`, 'must be a string')
    }
    criteria.false = raw.criteria.false
  }
  return { ...question, criteria }
}

function parseChoice(raw: Record<string, unknown>, field: string): ChoiceQuestion {
  if (!isRecord(raw.criteria)) {
    throw new JevParseError(`${field}.criteria`, 'choice criteria must be an object')
  }
  const criteria: Record<string, string | null> = {}
  for (const [key, description] of Object.entries(raw.criteria)) {
    if (description !== null && typeof description !== 'string') {
      throw new JevParseError(`${field}.criteria.${key}`, 'must be a string or null')
    }
    criteria[key] = description
  }
  if (Object.keys(criteria).length < 2) {
    throw new JevParseError(`${field}.criteria`, 'choice needs at least two options')
  }
  return {
    type: 'choice',
    instructions: parseInstructions(raw.instructions, `${field}.instructions`),
    criteria,
  }
}

function parseScore(raw: Record<string, unknown>, field: string): ScoreQuestion {
  if (!Array.isArray(raw.criteria) || raw.criteria.length < 2) {
    throw new JevParseError(`${field}.criteria`, 'score needs at least two level strings')
  }
  const criteria: string[] = []
  for (const [index, level] of raw.criteria.entries()) {
    if (typeof level !== 'string' || level.trim() === '') {
      throw new JevParseError(`${field}.criteria[${index}]`, 'must be a non-empty string')
    }
    criteria.push(level)
  }
  return {
    type: 'score',
    instructions: parseInstructions(raw.instructions, `${field}.instructions`),
    criteria,
  }
}

export function parseQuestion(value: unknown, field = 'question'): JevQuestion {
  if (!isRecord(value)) {
    throw new JevParseError(field, 'question must be an object')
  }
  if (value.type === 'noul') return parseNoul(value, field)
  if (value.type === 'choice') return parseChoice(value, field)
  if (value.type === 'score') return parseScore(value, field)
  throw new JevParseError(`${field}.type`, 'type must be noul, choice, or score')
}

export function parseQuestions(value: unknown, field = 'questions'): Record<string, JevQuestion> {
  if (!isRecord(value)) {
    throw new JevParseError(field, 'questions must be an object')
  }
  const questions: Record<string, JevQuestion> = {}
  for (const [id, question] of Object.entries(value)) {
    if (id.trim() === '') {
      throw new JevParseError(field, 'question ids must be non-empty')
    }
    questions[id] = parseQuestion(question, `${field}.${id}`)
  }
  if (Object.keys(questions).length === 0) {
    throw new JevParseError(field, 'ask at least one question')
  }
  return questions
}

export function parseRequest(value: unknown, fallbackModel: string): JevRequest {
  if (!isRecord(value)) {
    throw new JevParseError('request', 'request must be an object')
  }
  const model = value.model === undefined ? fallbackModel : value.model
  if (typeof model !== 'string' || model.trim() === '') {
    throw new JevParseError('model', 'model must be a non-empty string')
  }
  return {
    state: asJsonValue(value.state, 'state'),
    questions: parseQuestions(value.questions),
    model,
  }
}

function parseUnitInterval(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new JevParseError(field, 'must be a number between 0 and 1')
  }
  return value
}

function parseProbabilities(value: unknown, field: string): Record<string, number> {
  if (!isRecord(value)) {
    throw new JevParseError(field, 'must be an object of numbers')
  }
  const probabilities: Record<string, number> = {}
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'number' || !Number.isFinite(item)) {
      throw new JevParseError(`${field}.${key}`, 'must be a finite number')
    }
    probabilities[key] = item
  }
  return probabilities
}

function parseNoulAnswer(raw: Record<string, unknown>, field: string): NoulAnswer {
  return { type: 'noul', noul: parseUnitInterval(raw.noul, `${field}.noul`) }
}

function parseChoiceAnswer(raw: Record<string, unknown>, field: string): ChoiceAnswer {
  if (typeof raw.choice !== 'string' || raw.choice === '') {
    throw new JevParseError(`${field}.choice`, 'must be a non-empty string')
  }
  return {
    type: 'choice',
    choice: raw.choice,
    probabilities: parseProbabilities(raw.probabilities, `${field}.probabilities`),
    confidence: parseUnitInterval(raw.confidence, `${field}.confidence`),
  }
}

function parseScoreAnswer(raw: Record<string, unknown>, field: string): ScoreAnswer {
  if (typeof raw.score !== 'number' || !Number.isFinite(raw.score)) {
    throw new JevParseError(`${field}.score`, 'must be a finite number')
  }
  if (!isRecord(raw.legend)) {
    throw new JevParseError(`${field}.legend`, 'must be an object')
  }
  const legend: Record<string, string> = {}
  for (const [key, item] of Object.entries(raw.legend)) {
    if (typeof item !== 'string') {
      throw new JevParseError(`${field}.legend.${key}`, 'must be a string')
    }
    legend[key] = item
  }
  return {
    type: 'score',
    score: raw.score,
    legend,
    probabilities: parseProbabilities(raw.probabilities, `${field}.probabilities`),
    confidence: parseUnitInterval(raw.confidence, `${field}.confidence`),
  }
}

export function parseAnswer(value: unknown, field = 'answer'): JevAnswer {
  if (!isRecord(value)) {
    throw new JevParseError(field, 'answer must be an object')
  }
  if (value.type === 'noul') return parseNoulAnswer(value, field)
  if (value.type === 'choice') return parseChoiceAnswer(value, field)
  if (value.type === 'score') return parseScoreAnswer(value, field)
  throw new JevParseError(`${field}.type`, 'type must be noul, choice, or score')
}

export function parseResult(value: unknown, asked: Record<string, JevQuestion>): JevResult {
  if (!isRecord(value)) {
    throw new JevParseError('result', 'result must be an object')
  }
  if (typeof value.model !== 'string' || value.model.trim() === '') {
    throw new JevParseError('model', 'model must be a non-empty string')
  }
  if (!isRecord(value.answers)) {
    throw new JevParseError('answers', 'answers must be an object')
  }
  const answers: Record<string, JevAnswer> = {}
  for (const id of Object.keys(asked)) {
    if (!(id in value.answers)) {
      throw new JevParseError(`answers.${id}`, 'missing answer for asked question')
    }
    const answer = parseAnswer(value.answers[id], `answers.${id}`)
    if (answer.type !== asked[id].type) {
      throw new JevParseError(`answers.${id}.type`, `expected ${asked[id].type}`)
    }
    answers[id] = answer
  }
  let usage: JevUsage | undefined
  if (value.usage !== undefined) {
    if (!isRecord(value.usage)) {
      throw new JevParseError('usage', 'must be an object')
    }
    const input = value.usage.input_tokens
    const output = value.usage.output_tokens
    if (typeof input !== 'number' || typeof output !== 'number') {
      throw new JevParseError('usage', 'input_tokens and output_tokens must be numbers')
    }
    usage = { input_tokens: input, output_tokens: output }
  }
  return usage === undefined
    ? { model: value.model, answers }
    : { model: value.model, answers, usage }
}

export function toWireQuestion(question: JevQuestion): Record<string, unknown> {
  if (question.type === 'noul') {
    return question.criteria === undefined
      ? { type: 'noul', instructions: question.instructions }
      : { type: 'noul', instructions: question.instructions, criteria: question.criteria }
  }
  if (question.type === 'choice') {
    return {
      type: 'choice',
      instructions: question.instructions,
      criteria: question.criteria,
    }
  }
  return {
    type: 'score',
    instructions: question.instructions,
    criteria: question.criteria,
  }
}

export function toWireBody(request: JevRequest): Record<string, unknown> {
  const questions: Record<string, unknown> = {}
  for (const [id, question] of Object.entries(request.questions)) {
    questions[id] = toWireQuestion(question)
  }
  return {
    state: request.state,
    model: request.model,
    questions,
  }
}
