import type { AgentAnswer } from '@/lib/agent/schema';
import type { AgentTrace } from '@/lib/agent/orchestrator';

export type AgentUiState = {
  status: 'idle' | 'success' | 'error';
  error: string | null;
  answer: AgentAnswer | null;
  trace: AgentTrace[];
};

export const initialAgentState: AgentUiState = {
  status: 'idle',
  error: null,
  answer: null,
  trace: [],
};

export function isOpenAiConfigured(env: Record<string, string | undefined>) {
  return ['OPENAI_BASE_URL', 'OPENAI_API_KEY', 'OPENAI_MODEL'].every((key) => Boolean(env[key]?.trim()));
}

export function createAgentErrorState(error: string): AgentUiState {
  return { status: 'error', error, answer: null, trace: [] };
}

export function createAgentSuccessState(answer: AgentAnswer, trace: AgentTrace[]): AgentUiState {
  return { status: 'success', error: null, answer, trace };
}
