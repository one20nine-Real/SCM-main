'use server';
import { requireAdmin } from '@/lib/auth';
export async function runBacktest(formData: FormData) { const { supabase } = await requireAdmin(); const { error } = await supabase.schema('core').rpc('run_backtest', { p_forecast_run_id: String(formData.get('runId')) }); if (error) throw new Error(error.message); }
export async function setManualChampion(formData: FormData) { const { supabase } = await requireAdmin(); const { error } = await supabase.schema('core').rpc('set_manual_champion', { p_item_id: String(formData.get('itemId')), p_model_id: String(formData.get('modelId')), p_backtest_run_id: String(formData.get('backtestRunId')), p_reason: String(formData.get('reason')) }); if (error) throw new Error(error.message); }
