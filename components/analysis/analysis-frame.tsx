import type { ReactNode } from 'react';
import PageHeader from '@/components/shell/page-header';
import AnalysisTabs from './analysis-tabs';

export default function AnalysisFrame({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return <section className="analysis-page"><PageHeader title={title} description={description} /><AnalysisTabs />{children}</section>;
}
