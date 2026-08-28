'use server';
import { requireAdmin } from '@/lib/auth';
export async function toggleForecastModel(formData: FormData) { const { supabase } = await requireAdmin(); const modelId = String(formData.get('modelId')); const enabled = formData.get('enabled') === 'true'; const { error } = await supabase.schema('core').from('model_config').update({ enabled, updated_by: (await supabase.auth.getUser()).data.user?.id }).eq('model_id', modelId); if (error) throw new Error(error.message); }
export async function runBaselineForecast(_formData: FormData) { const { supabase } = await requireAdmin(); const { error } = await supabase.schema('core').rpc('run_baseline_forecast'); if (error) throw new Error(error.message); }
