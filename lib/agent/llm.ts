export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export type ChatMessage = {
  role: ChatRole;
  content: string | null;
  name?: string;
  tool_call_id?: string;
};

export type LlmToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ChatTool = Record<string, unknown>;

export type ChatRequest = {
  messages: ChatMessage[];
  tools?: ChatTool[];
  tool_choice?: 'auto';
  temperature?: number;
  response_format?: Record<string, unknown>;
};

export type ChatResult = {
  content: string | null;
  toolCalls: LlmToolCall[];
  error: string | null;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

type LlmClientOptions = { timeoutMs?: number };
type ApiResponse = { status: number; body: unknown; message: string | null };

const fallbackKeys = new Set<string>();

function errorResult(message: string): ChatResult {
  return { content: null, toolCalls: [], error: message };
}

function responseMessage(body: unknown) {
  if (!body || typeof body !== 'object') return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') return (error as { message: string }).message;
  return typeof (body as { message?: unknown }).message === 'string' ? (body as { message: string }).message : null;
}

async function readResponse(response: Response): Promise<ApiResponse> {
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    return { status: response.status, body: null, message: 'OpenAI 응답 JSON을 파싱할 수 없습니다.' };
  }
  return { status: response.status, body, message: responseMessage(body) };
}

function parseCompletion(body: unknown): ChatResult {
  if (!body || typeof body !== 'object') return errorResult('OpenAI 응답 형식이 올바르지 않습니다.');
  const choices = (body as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== 'object') return errorResult('OpenAI 응답에 choices가 없습니다.');
  const message = (choices[0] as { message?: unknown }).message;
  if (!message || typeof message !== 'object') return errorResult('OpenAI 응답에 message가 없습니다.');
  const content = (message as { content?: unknown }).content;
  if (content !== null && content !== undefined && typeof content !== 'string') return errorResult('OpenAI 응답 content 형식이 올바르지 않습니다.');
  const rawToolCalls = (message as { tool_calls?: unknown }).tool_calls;
  if (rawToolCalls !== undefined && !Array.isArray(rawToolCalls)) return errorResult('OpenAI 응답 tool_calls 형식이 올바르지 않습니다.');
  const toolCalls: LlmToolCall[] = [];
  for (const raw of rawToolCalls ?? []) {
    if (!raw || typeof raw !== 'object') return errorResult('OpenAI 응답 tool_call 형식이 올바르지 않습니다.');
    const call = raw as { id?: unknown; type?: unknown; function?: unknown };
    const fn = call.function;
    if (typeof call.id !== 'string' || call.type !== 'function' || !fn || typeof fn !== 'object' || typeof (fn as { name?: unknown }).name !== 'string' || typeof (fn as { arguments?: unknown }).arguments !== 'string') return errorResult('OpenAI 응답 tool_call 형식이 올바르지 않습니다.');
    toolCalls.push({ id: call.id, type: 'function', function: { name: (fn as { name: string }).name, arguments: (fn as { arguments: string }).arguments } });
  }
  return { content: content ?? null, toolCalls, error: null };
}

export function createLlmClient(fetchImpl: FetchLike = fetch, options: LlmClientOptions = {}) {
  const timeoutMs = options.timeoutMs ?? 60_000;

  return {
    async chat(request: ChatRequest): Promise<ChatResult> {
      const baseUrl = process.env.OPENAI_BASE_URL?.trim();
      const apiKey = process.env.OPENAI_API_KEY?.trim();
      const model = process.env.OPENAI_MODEL?.trim();
      if (!baseUrl) return errorResult('OPENAI_BASE_URL이 설정되지 않았습니다.');
      if (!apiKey) return errorResult('OPENAI_API_KEY가 설정되지 않았습니다.');
      if (!model) return errorResult('OPENAI_MODEL이 설정되지 않았습니다.');

      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const fallbackKey = `${baseUrl}|${model}`;
      const initialBody: Record<string, unknown> = {
        model,
        messages: request.messages,
        temperature: request.temperature ?? 0,
      };
      if (request.tools !== undefined) initialBody.tools = request.tools;
      if (request.tool_choice !== undefined) initialBody.tool_choice = request.tool_choice;
      if (request.response_format !== undefined) initialBody.response_format = request.response_format;

      const send = async (body: Record<string, unknown>): Promise<ApiResponse | { timeout: true }> => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        try {
          const response = await fetchImpl(endpoint, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
          return await readResponse(response);
        } catch (error) {
          if (controller.signal.aborted) return { timeout: true };
          return { status: 0, body: null, message: error instanceof Error ? error.message : 'OpenAI 네트워크 요청에 실패했습니다.' };
        } finally {
          clearTimeout(timer);
        }
      };

      let response = await send(initialBody);
      if ('timeout' in response) return errorResult('OpenAI 요청 시간이 초과되었습니다.');
      if (response.status === 400 && !fallbackKeys.has(fallbackKey)) {
        const responseFormat = initialBody.response_format as { type?: unknown } | undefined;
        const mentionsTemperature = response.message?.toLowerCase().includes('temperature') === true;
        if (mentionsTemperature) {
          fallbackKeys.add(fallbackKey);
          const retryBody = { ...initialBody };
          delete retryBody.temperature;
          response = await send(retryBody);
        } else if (responseFormat?.type === 'json_schema') {
          fallbackKeys.add(fallbackKey);
          response = await send({ ...initialBody, response_format: { type: 'json_object' } });
        }
      }
      if ('timeout' in response) return errorResult('OpenAI 요청 시간이 초과되었습니다.');
      if (response.status < 200 || response.status >= 300) return errorResult(response.message ?? `OpenAI 요청이 실패했습니다. (${response.status})`);
      if (response.body === null) return errorResult('OpenAI 응답 JSON을 파싱할 수 없습니다.');
      return parseCompletion(response.body);
    },
  };
}
