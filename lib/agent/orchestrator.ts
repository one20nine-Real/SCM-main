import { agentAnswerJsonSchema, cannotAnswer, parseAgentAnswer, type AgentAnswer } from './schema.ts';
import { createLlmClient, type ChatMessage, type ChatRequest, type ChatResult, type LlmToolCall } from './llm.ts';
import { agentTools, type AgentTool, type ToolResult } from './tools.ts';
import { buildAllowedNumberDictionary, verifyAnswerNumbers, type ToolObservation } from './guardrail.ts';

export type AgentUser = { role: string } | string;
export type AgentHistory = (ChatMessage & { tool_calls?: LlmToolCall[] })[];
export type AgentRequest = { question: string; user: AgentUser; history?: AgentHistory };
export type AgentTrace = { name: string; args: string; ok: boolean; ms: number; reason: string | null };
export type AgentRunResult = { answer: AgentAnswer; history: AgentHistory; trace: AgentTrace[] };
export type AgentLlm = { chat: (request: ChatRequest) => Promise<ChatResult> };
export type OrchestratorOptions = { llm?: AgentLlm; tools?: AgentTool[]; timeoutMs?: number };

const answerResponseFormat = {
  type: 'json_schema',
  json_schema: { name: 'agent_answer', strict: true, schema: agentAnswerJsonSchema },
};

function roleOf(user: AgentUser) {
  return typeof user === 'string' ? user : user.role;
}

function asToolMessage(callId: string, result: unknown): ChatMessage {
  return { role: 'tool', content: JSON.stringify(result), tool_call_id: callId };
}

function timeoutPromise<T>(milliseconds: number) {
  return new Promise<T>((resolve) => setTimeout(() => resolve(undefined as T), milliseconds));
}

async function withinDeadline<T>(operation: Promise<T>, deadline: number): Promise<T | undefined> {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return undefined;
  return Promise.race([operation, timeoutPromise<T>(remaining)]);
}

function llmTools(tools: AgentTool[]) {
  return tools.map((tool) => ({ type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.parameters } }));
}

function failure(reason: string, history: AgentHistory, trace: AgentTrace[]): AgentRunResult {
  return { answer: cannotAnswer(reason), history, trace };
}

export async function runAgent(request: AgentRequest, options: OrchestratorOptions = {}): Promise<AgentRunResult> {
  const history: AgentHistory = [...(request.history ?? []), { role: 'user', content: request.question }];
  const trace: AgentTrace[] = [];
  const role = roleOf(request.user);
  const availableTools = (options.tools ?? agentTools).filter((tool) => tool.roles.includes(role));
  const llm = options.llm ?? createLlmClient();
  const deadline = Date.now() + (options.timeoutMs ?? 60_000);
  let responseFormat: Record<string, unknown> = answerResponseFormat;
  const observations: ToolObservation[] = [];
  let guardrailRegenerated = false;

  for (let round = 0; round < 6; round += 1) {
    const llmRequest: ChatRequest = {
      messages: history,
      tools: llmTools(availableTools),
      tool_choice: 'auto',
      temperature: 0,
      response_format: responseFormat,
    };
    let llmResult: ChatResult | undefined;
    try {
      llmResult = await withinDeadline(llm.chat(llmRequest), deadline);
    } catch {
      return failure('LLM_FAILED', history, trace);
    }
    if (!llmResult) return failure('TIMEOUT', history, trace);
    if (llmResult.error) return failure(llmResult.error, history, trace);

    if (llmResult.toolCalls.length === 0) {
      if (!llmResult.content) return failure('EMPTY_LLM_RESPONSE', history, trace);
      try {
        const parsedAnswer = parseAgentAnswer(llmResult.content);
        const checked = verifyAnswerNumbers(parsedAnswer, buildAllowedNumberDictionary(observations));
        if (checked.ok) return { answer: parsedAnswer, history, trace };
        if (guardrailRegenerated) return failure('UNSUPPORTED_NUMBERS', history, trace);
        guardrailRegenerated = true;
        history.push({
          role: 'system',
          content: `숫자 검증 실패입니다. 출처 없는 숫자를 제거하거나 ToolResult 숫자로 고쳐 JSON 답변만 다시 작성하세요. 출처 없는 숫자: ${checked.unsupportedNumbers.join(', ')}`,
        });
        continue;
      } catch {
        return failure('INVALID_AGENT_ANSWER', history, trace);
      }
    }

    history.push({ role: 'assistant', content: llmResult.content, tool_calls: llmResult.toolCalls });
    // 첫 호출 이후에는 json_object를 고정해 같은 모델에 json_schema fallback을 반복하지 않는다.
    responseFormat = { type: 'json_object' };

    for (const call of llmResult.toolCalls) {
      const startedAt = Date.now();
      const tool = availableTools.find((candidate) => candidate.name === call.function.name);
      if (!tool) {
        const reason = 'TOOL_NOT_ALLOWED';
        trace.push({ name: call.function.name, args: call.function.arguments, ok: false, ms: Date.now() - startedAt, reason });
        history.push(asToolMessage(call.id, { ok: false, reason }));
        return failure(reason, history, trace);
      }

      let args: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(call.function.arguments);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not object');
        args = parsed as Record<string, unknown>;
      } catch {
        const reason = 'INVALID_ARGUMENTS';
        trace.push({ name: call.function.name, args: call.function.arguments, ok: false, ms: Date.now() - startedAt, reason });
        history.push(asToolMessage(call.id, { ok: false, reason }));
        return failure(reason, history, trace);
      }

      // Tool 목록을 구성한 뒤 실행 직전에도 같은 사용자 role을 다시 확인한다.
      if (!tool.roles.includes(role)) {
        const reason = 'TOOL_NOT_ALLOWED';
        trace.push({ name: call.function.name, args: call.function.arguments, ok: false, ms: Date.now() - startedAt, reason });
        history.push(asToolMessage(call.id, { ok: false, reason }));
        return failure(reason, history, trace);
      }

      let result: ToolResult<unknown> | undefined;
      try {
        result = await withinDeadline(tool.run(args), deadline);
      } catch {
        result = undefined;
      }
      if (!result) {
        const reason = 'TIMEOUT';
        trace.push({ name: call.function.name, args: call.function.arguments, ok: false, ms: Date.now() - startedAt, reason });
        history.push(asToolMessage(call.id, { ok: false, reason }));
        return failure(reason, history, trace);
      }
      trace.push({ name: call.function.name, args: call.function.arguments, ok: result.ok, ms: Date.now() - startedAt, reason: result.reason });
      history.push(asToolMessage(call.id, result));
      observations.push({ toolName: call.function.name, result });
      if (!result.ok) return failure(result.reason ?? 'TOOL_FAILED', history, trace);
    }
  }

  return failure('TOOL_LOOP_LIMIT', history, trace);
}
