import PageHeader from '@/components/shell/page-header';
import Panel from '@/components/ui/panel';
import EmptyValue from '@/components/ui/empty-value';
import { getLeadtimePolicies } from '@/lib/scm';
import { saveLeadtimePolicy } from './actions';

export const dynamic = 'force-dynamic';
const value = (number: number | null) => number === null ? <EmptyValue reasonCode="NO_LEADTIME" /> : number;

export default async function LeadTimePolicyPage() {
  const result = await getLeadtimePolicies();
  return <><PageHeader eyebrow="ADMIN / SCM POLICIES" title="Lead Time Policy" description="관리자 확정값을 우선 적용하고, 없으면 실적 P80을 Effective Lead Time으로 사용합니다." /><Panel className="section" title="Item / Supplier Lead Time">{result.error ? <p className="text-danger">조회에 실패했습니다: {result.error}</p> : <div className="analysis-table-wrap"><table className="analysis-table"><thead><tr>{['Item','Supplier','Samples','Mean','P50','P80','P90','Admin Item','Admin Supplier','Effective','Source','적용일','변경자','변경'].map((label) => <th key={label}>{label}</th>)}</tr></thead><tbody>{result.rows.length ? result.rows.map((row) => <tr key={`${row.itemId}-${row.supplierId}`}><td>{row.itemId}<br /><span className="muted">{row.itemName}</span></td><td>{row.supplierName} ({row.supplierId})</td><td>{value(row.samples)}</td><td>{value(row.mean)}</td><td>{value(row.p50)}</td><td>{value(row.p80)}</td><td>{value(row.p90)}</td><td>{value(row.itemConfirmed)}</td><td>{value(row.supplierConfirmed)}</td><td>{value(row.effective)}</td><td>{row.source}</td><td>{row.effectiveFrom?.slice(0, 10) ?? <EmptyValue reasonCode="NO_LEADTIME" />}</td><td>{row.changedBy ?? <span className="muted">—</span>}</td><td><form action={saveLeadtimePolicy} className="filter-row"><input type="hidden" name="itemId" value={row.itemId} /><input type="hidden" name="supplierId" value={row.supplierId} /><input name="leadTime" type="number" min="1" placeholder="일" /><input name="effectiveFrom" type="date" required /><input name="reason" placeholder="확정 사유" required /><button className="button" type="submit">저장</button></form></td></tr>) : <tr><td colSpan={14}>표시할 Lead Time 데이터가 없습니다.</td></tr>}</tbody></table></div>}</Panel></>;
}
