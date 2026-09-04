import test from 'node:test';
import assert from 'node:assert/strict';
import { createLlmClient, type ChatRequest } from './llm.ts';

const request: ChatRequest = {
  messages: [{ role: 'user', content: '품목 추세를 알려줘' }],
  temperature: 0,
  response_format: { type: 'json_schema', json_schema: { name: 'agent_answer', strict: true, schema: {} } },
};

function withEnv(values: Record<string, string | undefined>, callback: () => Promise<void>) {
  const previous = { base: process.env.OPENAI_BASE_URL, key: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL };
  Object.assign(process.env, values);
  return callback().finally(() => {
    if (previous.base === undefined) delete process.env.OPENAI_BASE_URL; else process.env.OPENAI_BASE_URL = previous.base;
    if (previous.key === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous.key;
    if (previous.model === undefined) delete process.env.OPENAI_MODEL; else process.env.OPENAI_MODEL = previous.model;
  });
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

test('returns an error without fetching when OpenAI settings are missing', async () => {
  await withEnv({ OPENAI_BASE_URL: ' ', OPENAI_API_KEY: 'key', OPENAI_MODEL: 'model' }, async () => {
    let called = false;
    const result = await createLlmClient(async () => { called = true; return response({}); }).chat(request);
    assert.equal(result.error, 'OPENAI_BASE_URL이 설정되지 않았습니다.');
    assert.equal(called, false);
  });
});

test('parses assistant content and tool_calls from a successful response', async () => {
  await withEnv({ OPENAI_BASE_URL: ' https://example.test/v1 ', OPENAI_API_KEY: ' key ', OPENAI_MODEL: ' model ' }, async () => {
    let captured: RequestInit | undefined;
    const client = createLlmClient(async (_url, init) => { captured = init; return response({ choices: [{ message: { content: null, tool_calls: [{ id: 'call_1', type: 'function', function: { name: 'getShipmentTrend', arguments: '{"itemCode":"ITEM001"}' } }] } }] }); });
    const result = await client.chat(request);
    assert.equal(result.error, null);
    assert.equal(result.content, null);
    assert.equal(result.toolCalls[0].function.name, 'getShipmentTrend');
    assert.equal(new Headers(captured?.headers).get('authorization'), 'Bearer key');
    assert.equal((JSON.parse(String(captured?.body)) as { model: string }).model, 'model');
  });
});

test('falls back from json_schema to json_object once for a model', async () => {
  await withEnv({ OPENAI_BASE_URL: 'https://fallback-schema.test/v1', OPENAI_API_KEY: 'key', OPENAI_MODEL: 'schema-model' }, async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = createLlmClient(async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return bodies.length === 1 || bodies.length === 3 ? response({ error: { message: 'json_schema is not supported' } }, 400) : response({ choices: [{ message: { content: '{}' } }] }); });
    const first = await client.chat(request);
    const second = await client.chat(request);
    assert.equal(first.error, null);
    assert.equal(second.error, 'json_schema is not supported');
    assert.equal((bodies[1].response_format as { type: string }).type, 'json_object');
    assert.equal(bodies.length, 3);
  });
});

test('removes temperature once when the 400 response mentions temperature', async () => {
  await withEnv({ OPENAI_BASE_URL: 'https://fallback-temperature.test/v1', OPENAI_API_KEY: 'key', OPENAI_MODEL: 'temperature-model' }, async () => {
    const bodies: Record<string, unknown>[] = [];
    const client = createLlmClient(async (_url, init) => { bodies.push(JSON.parse(String(init?.body))); return bodies.length === 1 ? response({ error: { message: "'temperature' does not support 0 with this model" } }, 400) : response({ choices: [{ message: { content: 'ok' } }] }); });
    const result = await client.chat(request);
    assert.equal(result.error, null);
    assert.equal('temperature' in bodies[1], false);
  });
});

test('returns a timeout error when the request is aborted', async () => {
  await withEnv({ OPENAI_BASE_URL: 'https://timeout.test/v1', OPENAI_API_KEY: 'key', OPENAI_MODEL: 'timeout-model' }, async () => {
    const client = createLlmClient((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }), { timeoutMs: 5 });
    const result = await client.chat(request);
    assert.equal(result.error, 'OpenAI 요청 시간이 초과되었습니다.');
  });
});
