import test from 'node:test';
import assert from 'node:assert/strict';
import { runAgent, type AgentLlm } from './orchestrator.ts';
import type { AgentTool } from './tools.ts';
import type { ChatResult } from './llm.ts';

const answer = JSON.stringify({
  answer: '확인했습니다.',
  verdict: 'SAFE',
  evidence: [],
  data_as_of: null,
  risk: null,
  recommended_action: '계속 관찰하세요.',
  cannot_answer: false,
  cannot_answer_reason: null,
});

const numericAnswer = (quantity: number) => JSON.stringify({
  answer: `출고량은 ${quantity}개입니다.`,
  verdict: 'SAFE',
  evidence: [{ source: 'lookup', claim: `출고량 ${quantity}`, value: String(quantity) }],
  data_as_of: null,
  risk: null,
  recommended_action: `월 ${quantity}개를 준비하세요.`,
  cannot_answer: false,
  cannot_answer_reason: null,
});

function llmQueue(results: ChatResult[], requests: unknown[]): AgentLlm {
  return { chat: async (request) => { requests.push(request); return results.shift() ?? { content: answer, toolCalls: [], error: null }; } };
}

function tool(name: string, roles: string[], run: AgentTool['run']): AgentTool {
  return { name, description: `${name} 설명`, parameters: { type: 'object', additionalProperties: false, properties: { itemCode: { type: 'string' } }, required: ['itemCode'] }, roles, run };
}

function call(name: string, args = '{"itemCode":"ITEM001"}', id = 'call_1') {
  return { id, type: 'function' as const, function: { name, arguments: args } };
}

test('runs the user → tool call → tool result → explanation message sequence', async () => {
  const requests: any[] = [];
  const fakeTool = tool('lookup', ['planner'], async () => ({ ok: true, data: { stock: 12 }, numbers: [12], dataAsOf: '2026-09-04', reason: null }));
  const llm = llmQueue([
    { content: null, toolCalls: [call('lookup')], error: null },
    { content: answer, toolCalls: [], error: null },
  ], requests);

  const result = await runAgent({ question: '재고를 알려줘', user: { role: 'planner' }, history: [] }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.answer, '확인했습니다.');
  assert.equal(result.trace.length, 1);
  assert.equal(result.trace[0].name, 'lookup');
  assert.equal(result.trace[0].ok, true);
  const messages = requests[1].messages;
  assert.equal(messages[messages.length - 2].role, 'assistant');
  assert.equal(messages[messages.length - 2].tool_calls[0].id, 'call_1');
  assert.equal(messages[messages.length - 1].role, 'tool');
  assert.equal(messages[messages.length - 1].tool_call_id, 'call_1');
});

test('turns an unauthorized tool call into cannot-answer without executing it', async () => {
  let executed = false;
  const fakeTool = tool('adminOnly', ['admin'], async () => { executed = true; return { ok: true, data: {}, numbers: [], dataAsOf: null, reason: null }; });
  const llm = llmQueue([{ content: null, toolCalls: [call('adminOnly')], error: null }], []);

  const result = await runAgent({ question: '관리 정보를 알려줘', user: { role: 'planner' } }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.cannot_answer, true);
  assert.equal(result.answer.cannot_answer_reason, 'TOOL_NOT_ALLOWED');
  assert.equal(executed, false);
  assert.equal(result.trace[0].reason, 'TOOL_NOT_ALLOWED');
});

test('turns malformed tool arguments into cannot-answer without executing the tool', async () => {
  let executed = false;
  const fakeTool = tool('lookup', ['planner'], async () => { executed = true; return { ok: true, data: {}, numbers: [], dataAsOf: null, reason: null }; });
  const llm = llmQueue([{ content: null, toolCalls: [call('lookup', '{bad')], error: null }], []);

  const result = await runAgent({ question: '재고를 알려줘', user: { role: 'planner' } }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.cannot_answer, true);
  assert.equal(result.answer.cannot_answer_reason, 'INVALID_ARGUMENTS');
  assert.equal(executed, false);
  assert.equal(result.trace[0].ok, false);
});

test('stops a tool loop after six rounds', async () => {
  const requests: unknown[] = [];
  const fakeTool = tool('loop', ['planner'], async () => ({ ok: true, data: { value: 1 }, numbers: [1], dataAsOf: null, reason: null }));
  const llm = llmQueue(Array.from({ length: 7 }, () => ({ content: null, toolCalls: [call('loop')], error: null })), requests);

  const result = await runAgent({ question: '계속 확인해줘', user: { role: 'planner' } }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.cannot_answer, true);
  assert.equal(result.answer.cannot_answer_reason, 'TOOL_LOOP_LIMIT');
  assert.equal(result.trace.length, 6);
  assert.equal(requests.length, 6);
});

test('검증 실패 답변은 숫자 근거를 포함한 지시와 함께 한 번 재생성한다', async () => {
  const requests: any[] = [];
  const fakeTool = tool('lookup', ['planner'], async () => ({ ok: true, data: { stock: 12 }, numbers: [12], dataAsOf: null, reason: null }));
  const llm = llmQueue([
    { content: null, toolCalls: [call('lookup')], error: null },
    { content: numericAnswer(999), toolCalls: [], error: null },
    { content: numericAnswer(12), toolCalls: [], error: null },
  ], requests);

  const result = await runAgent({ question: '재고를 알려줘', user: { role: 'planner' } }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.cannot_answer, false);
  assert.equal(result.answer.answer, '출고량은 12개입니다.');
  assert.equal(requests.length, 3);
  assert.match(requests[2].messages.at(-1).content, /999/);
});

test('재생성 후에도 출처 없는 숫자가 남으면 답변을 버린다', async () => {
  const fakeTool = tool('lookup', ['planner'], async () => ({ ok: true, data: { stock: 12 }, numbers: [12], dataAsOf: null, reason: null }));
  const llm = llmQueue([
    { content: null, toolCalls: [call('lookup')], error: null },
    { content: numericAnswer(999), toolCalls: [], error: null },
    { content: numericAnswer(998), toolCalls: [], error: null },
  ], []);

  const result = await runAgent({ question: '재고를 알려줘', user: { role: 'planner' } }, { llm, tools: [fakeTool] });

  assert.equal(result.answer.cannot_answer, true);
  assert.equal(result.answer.cannot_answer_reason, 'UNSUPPORTED_NUMBERS');
});
