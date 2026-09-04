'use server';
import { requireAdmin } from '@/lib/auth';

export async function saveLeadtimePolicy(formData: FormData) {
  const { supabase } = await requireAdmin();
  const itemId = String(formData.get('itemId') ?? '');
  const supplierId = String(formData.get('supplierId') ?? '');
  const leadTime = Number(formData.get('leadTime'));
  const reason = String(formData.get('reason') ?? '').trim();
  const effectiveFrom = String(formData.get('effectiveFrom') ?? '');
  if (!supplierId || !Number.isInteger(leadTime) || leadTime <= 0 || !reason || !effectiveFrom) throw new Error('Lead Time과 사유, 적용일을 입력하세요.');
  const { error } = await supabase.schema('core').rpc('set_leadtime_policy', { p_item_id: itemId || null, p_supplier_id: supplierId, p_confirmed_lead_time: leadTime, p_reason: reason, p_effective_from: effectiveFrom });
  if (error) throw new Error(error.message);
}
