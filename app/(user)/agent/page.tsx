import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { isOpenAiConfigured } from './state';
import ChatForm from './chat-form';

export default async function AgentPage() {
  await requireUser();
  const configured = isOpenAiConfigured({
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  });
  return <><PageHeader eyebrow="AI AGENT" title="SCM Agent" description="출고·수요·정확도·BOM 질문을 실데이터 근거로 확인합니다." /><ChatForm configured={configured} /></>;
}
