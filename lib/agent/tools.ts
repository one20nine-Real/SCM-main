export type JsonSchema = {
  type: 'object';
  additionalProperties: false;
  properties: Record<string, { type: string | string[] }>;
  required: string[];
};

export type ToolResult<T> = {
  ok: boolean;
  data: T | null;
  numbers: number[];
  dataAsOf: string | null;
  reason: string | null;
};

export type AgentTool = {
  name: string;
  description: string;
  parameters: JsonSchema;
  roles: string[];
  run: (input: Record<string, unknown>) => Promise<ToolResult<unknown>>;
};

function numbersIn(value: unknown, result: number[] = []) {
  if (typeof value === 'number' && Number.isFinite(value)) result.push(value);
  else if (Array.isArray(value)) value.forEach((item) => numbersIn(item, result));
  else if (value && typeof value === 'object') Object.values(value).forEach((item) => numbersIn(item, result));
  return result;
}

function resultOf<T extends { dataAsOf?: string | null; reason?: string | null }>(result: { data: T | null; error: string | null }): ToolResult<T> {
  const reason = result.error ?? result.data?.reason ?? null;
  return { ok: result.error === null, data: result.data, numbers: numbersIn(result.data), dataAsOf: result.data?.dataAsOf ?? null, reason };
}

const itemCodeParameters: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { itemCode: { type: 'string' } },
  required: ['itemCode'],
};

const modelBaseParameters: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { modelBase: { type: 'string' } },
  required: ['modelBase'],
};

const olAccuracyParameters: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: { modelBase: { type: 'string' }, fy: { type: ['string', 'number', 'null'] } },
  required: ['modelBase', 'fy'],
};

export const agentTools: AgentTool[] = [
  {
    name: 'getShipmentTrend',
    description: '품목의 월별 출고량과 최근 이동평균 추세를 조회합니다.',
    parameters: itemCodeParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      if (typeof input.itemCode !== 'string' || !input.itemCode.trim()) return { ok: false, data: null, numbers: [], dataAsOf: null, reason: 'ITEM_CODE_REQUIRED' };
      const { getShipmentTrend } = await import('../scm');
      return resultOf(await getShipmentTrend(input.itemCode));
    },
  },
  {
    name: 'getDemandProfile',
    description: '품목의 희소 출고 이력에서 ADI, CV², 무수요율과 수요유형을 조회합니다.',
    parameters: itemCodeParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      if (typeof input.itemCode !== 'string' || !input.itemCode.trim()) return { ok: false, data: null, numbers: [], dataAsOf: null, reason: 'ITEM_CODE_REQUIRED' };
      const { getDemandProfile } = await import('../scm');
      return resultOf(await getDemandProfile(input.itemCode));
    },
  },
  {
    name: 'getOlAccuracy',
    description: '기종의 Sales OL과 SCM OL을 실제값 기준 WAPE와 Bias로 비교합니다.',
    parameters: olAccuracyParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      if (typeof input.modelBase !== 'string' || !input.modelBase.trim()) return { ok: false, data: null, numbers: [], dataAsOf: null, reason: 'MODEL_BASE_REQUIRED' };
      const { getOlAccuracy } = await import('../scm');
      return resultOf(await getOlAccuracy(input.modelBase, typeof input.fy === 'string' || typeof input.fy === 'number' ? input.fy : undefined));
    },
  },
  {
    name: 'getBomRequirement',
    description: '기종의 CAP, 필수 옵션, SCC·Label, 구성 품목과 기계 1대당 수량을 조회합니다.',
    parameters: modelBaseParameters,
    roles: ['USER', 'ADMIN'],
    async run(input) {
      if (typeof input.modelBase !== 'string' || !input.modelBase.trim()) return { ok: false, data: null, numbers: [], dataAsOf: null, reason: 'MODEL_BASE_REQUIRED' };
      const { getBomRequirement } = await import('../scm');
      return resultOf(await getBomRequirement(input.modelBase));
    },
  },
];
