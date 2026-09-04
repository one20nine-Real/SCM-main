export type AgentEvidence = {
  source: string;
  claim: string;
  value: string;
};

export type AgentAnswer = {
  answer: string;
  verdict: string;
  evidence: AgentEvidence[];
  data_as_of: string | null;
  risk: string | null;
  recommended_action: string | null;
  cannot_answer: boolean;
  cannot_answer_reason: string | null;
};

export const agentAnswerJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: { type: 'string' },
    verdict: { type: 'string' },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source: { type: 'string' },
          claim: { type: 'string' },
          value: { type: 'string' },
        },
        required: ['source', 'claim', 'value'],
      },
    },
    data_as_of: { type: ['string', 'null'] },
    risk: { type: ['string', 'null'] },
    recommended_action: { type: ['string', 'null'] },
    cannot_answer: { type: 'boolean' },
    cannot_answer_reason: { type: ['string', 'null'] },
  },
  required: [
    'answer',
    'verdict',
    'evidence',
    'data_as_of',
    'risk',
    'recommended_action',
    'cannot_answer',
    'cannot_answer_reason',
  ],
} as const;

const answerKeys = [
  'answer',
  'verdict',
  'evidence',
  'data_as_of',
  'risk',
  'recommended_action',
  'cannot_answer',
  'cannot_answer_reason',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isEvidence(value: unknown): value is AgentEvidence {
  if (!isRecord(value) || !hasOnlyKeys(value, ['source', 'claim', 'value'])) return false;
  return typeof value.source === 'string' && typeof value.claim === 'string' && typeof value.value === 'string';
}

export function parseAgentAnswer(input: string): AgentAnswer {
  let value: unknown;
  try {
    value = JSON.parse(input);
  } catch {
    throw new Error('올바른 JSON이 아닙니다.');
  }

  if (!isRecord(value) || !hasOnlyKeys(value, answerKeys)) {
    throw new Error('AgentAnswer에 알 수 없는 필드가 있거나 필수 필드가 누락되었습니다.');
  }

  const missing = answerKeys.find((key) => !(key in value));
  if (missing) throw new Error(`필수 필드가 누락되었습니다: ${missing}`);

  if (typeof value.answer !== 'string' || typeof value.verdict !== 'string') {
    throw new Error('answer와 verdict는 문자열이어야 합니다.');
  }
  if (!Array.isArray(value.evidence) || !value.evidence.every(isEvidence)) {
    throw new Error('evidence 형식이 올바르지 않습니다.');
  }
  for (const key of ['data_as_of', 'risk', 'recommended_action', 'cannot_answer_reason']) {
    if (value[key] !== null && typeof value[key] !== 'string') {
      throw new Error(`${key}는 문자열 또는 null이어야 합니다.`);
    }
  }
  if (typeof value.cannot_answer !== 'boolean') {
    throw new Error('cannot_answer는 boolean이어야 합니다.');
  }
  if (value.cannot_answer && !value.cannot_answer_reason) {
    throw new Error('cannot_answer가 true이면 cannot_answer_reason이 필요합니다.');
  }
  if (!value.cannot_answer && value.cannot_answer_reason !== null) {
    throw new Error('cannot_answer가 false이면 cannot_answer_reason은 null이어야 합니다.');
  }

  return value as AgentAnswer;
}

export function cannotAnswer(reason: string): AgentAnswer {
  if (!reason.trim()) throw new Error('cannot_answer_reason은 비어 있을 수 없습니다.');
  return {
    answer: '현재 데이터만으로는 답변할 수 없습니다.',
    verdict: 'CANNOT_ANSWER',
    evidence: [],
    data_as_of: null,
    risk: null,
    recommended_action: null,
    cannot_answer: true,
    cannot_answer_reason: reason,
  };
}
