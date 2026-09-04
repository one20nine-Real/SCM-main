import type { AgentAnswer } from './schema.ts';
import type { ToolResult } from './tools.ts';

export type ToolObservation = {
  toolName: string;
  result: ToolResult<unknown>;
};

export type ExtractedAnswerNumber = {
  value: number;
  raw: string;
  field: string;
};

export type GuardrailResult =
  | { ok: true; allowed: Record<string, number[]> }
  | {
      ok: false;
      allowed: Record<string, number[]>;
      unsupportedNumbers: number[];
      reason: 'UNSUPPORTED_NUMBERS';
    };

const numberPattern = /[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?%?/g;
const datePattern = /\b\d{4}-\d{1,2}(?:-\d{1,2})?\b/g;
const codePattern = /[A-Za-z0-9_-]*[A-Za-z][A-Za-z0-9_-]*\d[A-Za-z0-9_-]*/g;

function answerTextFields(answer: AgentAnswer) {
  const fields: Array<[string, string]> = [
    ['answer', answer.answer],
    ['verdict', answer.verdict],
    ['recommended_action', answer.recommended_action ?? ''],
  ];
  answer.evidence.forEach((evidence, index) => {
    fields.push([`evidence.${index}.source`, evidence.source]);
    fields.push([`evidence.${index}.claim`, evidence.claim]);
    fields.push([`evidence.${index}.value`, evidence.value]);
    const extra = evidence as unknown as Record<string, unknown>;
    for (const key of ['label', 'reason']) {
      if (typeof extra[key] === 'string') fields.push([`evidence.${index}.${key}`, extra[key] as string]);
    }
  });
  return fields;
}

function maskedDates(text: string) {
  return text
    .replace(datePattern, (match) => ' '.repeat(match.length))
    .replace(codePattern, (match) => ' '.repeat(match.length));
}

function isListNumber(text: string, end: number) {
  return /^\s*[.)]/.test(text.slice(end));
}

export function extractAnswerNumbers(answer: AgentAnswer): ExtractedAnswerNumber[] {
  const extracted: ExtractedAnswerNumber[] = [];
  for (const [field, originalText] of answerTextFields(answer)) {
    const text = maskedDates(originalText);
    const matcher = new RegExp(numberPattern.source, numberPattern.flags);
    let match: RegExpExecArray | null;
    while ((match = matcher.exec(text)) !== null) {
      const raw = match[0];
      const index = match.index;
      if (isListNumber(text, index + raw.length)) continue;
      const value = Number(raw.replaceAll(',', '').replace(/%$/, ''));
      if (Number.isFinite(value)) extracted.push({ value, raw, field });
    }
  }
  return extracted;
}

export function buildAllowedNumberDictionary(observations: readonly ToolObservation[]) {
  const allowed: Record<string, number[]> = {};
  for (const observation of observations) {
    const values = observation.result.numbers.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
    allowed[`${observation.toolName}.numbers`] = [...(allowed[`${observation.toolName}.numbers`] ?? []), ...values];
  }
  return allowed;
}

function decimalPlaces(raw: string) {
  const numeric = raw.replaceAll(',', '').replace(/%$/, '');
  const decimal = numeric.split('.')[1];
  return decimal?.length ?? 0;
}

function matchesAllowed(item: ExtractedAnswerNumber, allowed: number[]) {
  const places = decimalPlaces(item.raw);
  return allowed.some((candidate) => {
    if (item.raw.endsWith('%')) {
      return candidate >= 0 && candidate <= 1 && Number((candidate * 100).toFixed(places)) === item.value;
    }
    return Number(candidate.toFixed(places)) === item.value;
  });
}

export function verifyAnswerNumbers(answer: AgentAnswer, allowed: Record<string, number[]>): GuardrailResult {
  const extracted = extractAnswerNumbers(answer);
  const allowedValues = Object.values(allowed).flat().filter((value) => typeof value === 'number' && Number.isFinite(value));
  const unsupportedNumbers = extracted.filter((item) => !matchesAllowed(item, allowedValues)).map((item) => item.value);
  if (unsupportedNumbers.length === 0) return { ok: true, allowed };
  return { ok: false, allowed, unsupportedNumbers: Array.from(new Set(unsupportedNumbers)), reason: 'UNSUPPORTED_NUMBERS' };
}
