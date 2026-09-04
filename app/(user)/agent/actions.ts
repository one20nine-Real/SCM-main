'use server';

import { requireUser } from '@/lib/auth';
import { runAgent } from '@/lib/agent/orchestrator';
import { createAgentErrorState, createAgentSuccessState, type AgentUiState } from './state';

export async function askAgentAction(_state: AgentUiState, formData: FormData): Promise<AgentUiState> {
  const { profile } = await requireUser();
  const question = String(formData.get('question') ?? '').trim();
  if (!question) return createAgentErrorState('질문을 입력해주세요.');

  if (!process.env.OPENAI_BASE_URL?.trim() || !process.env.OPENAI_API_KEY?.trim() || !process.env.OPENAI_MODEL?.trim()) {
    return createAgentErrorState('OpenAI 설정이 없어 Agent를 사용할 수 없습니다.');
  }

  try {
    const result = await runAgent({ question, user: { role: profile.role } });
    return createAgentSuccessState(result.answer, result.trace);
  } catch {
    return createAgentErrorState('Agent 실행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
  }
}
