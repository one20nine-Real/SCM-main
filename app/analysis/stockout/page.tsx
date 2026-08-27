import AnalysisFrame from '@/components/analysis/analysis-frame';
import DataTable, { formatNumber, type Column } from '@/components/analysis/data-table';
import { getStockoutKpi, getStockoutRisk } from '@/lib/scm';
import type { StockoutRisk } from '@/lib/scm-model';

export const dynamic = 'force-dynamic';

function formatDate(value: string | null) {
  if (!value) return '—';
  return value.slice(0, 10).replaceAll('-', '.');
}

function RiskStatus({ status }: { status: StockoutRisk['riskStatus'] }) {
  if (status === 'CRITICAL') return <span className="text-danger">위험</span>;
  if (status === 'SAFE') return <span className="text-good">안전</span>;
  return <span className="muted">판정 불가</span>;
}

function Reason({ reason }: { reason: StockoutRisk['reason'] }) {
  if (reason === 'NO_USAGE') return <span className="muted">사용 이력 없음</span>;
  if (reason === 'NO_LEADTIME') return <span className="muted">리드타임 기준 없음</span>;
  return <span className="muted">—</span>;
}

const columns: Column<StockoutRisk>[] = [
  { key: 'itemId', label: '품목코드' },
  { key: 'itemName', label: '품목명' },
  { key: 'supplier', label: '공급처' },
  { key: 'availableQty', label: '가용재고', align: 'right', render: (row) => formatNumber(row.availableQty) },
  { key: 'dailyUsageAvg', label: '일평균 사용량', align: 'right', render: (row) => formatNumber(row.dailyUsageAvg) },
  { key: 'stockoutDays', label: '소진까지', align: 'right', render: (row) => formatNumber(row.stockoutDays, '일') },
  { key: 'stockoutDate', label: '소진 예상일', render: (row) => formatDate(row.stockoutDate) },
  { key: 'riskStatus', label: '상태', align: 'center', render: (row) => <RiskStatus status={row.riskStatus} /> },
  { key: 'reason', label: '사유', render: (row) => <Reason reason={row.reason} /> },
];

export default async function StockoutPage() {
  const [riskResult, kpiResult] = await Promise.all([getStockoutRisk(), getStockoutKpi()]);

  return (
    <AnalysisFrame
      title="재고 소진 위험"
      description="현재고와 입고예정을 기준으로 품목별 소진 예상일과 위험 상태를 확인합니다."
    >
      <div className="grid grid-3">
        <div className="card metric">
          <div className="metric-label">전체 품목</div>
          <div className="metric-value">{kpiResult.data?.items ?? '—'}</div>
          <div className="metric-foot">분석 대상 품목</div>
        </div>
        <div className="card metric">
          <div className="metric-label">위험 품목</div>
          <div className="metric-value text-danger">{kpiResult.data?.critical ?? '—'}</div>
          <div className="metric-foot warn">CRITICAL 상태</div>
        </div>
        <div className="card metric">
          <div className="metric-label">안전 품목</div>
          <div className="metric-value text-good">{kpiResult.data?.safe ?? '—'}</div>
          <div className="metric-foot">SAFE 상태</div>
        </div>
        <div className="card metric">
          <div className="metric-label">판정 불가</div>
          <div className="metric-value">{kpiResult.data?.unknown ?? '—'}</div>
          <div className="metric-foot">사용량 또는 기준 없음</div>
        </div>
        <div className="card metric">
          <div className="metric-label">30일 이내 소진</div>
          <div className="metric-value">{kpiResult.data?.within30Days ?? '—'}</div>
          <div className="metric-foot warn">우선 검토 대상</div>
        </div>
        <div className="card metric">
          <div className="metric-label">평균 소진 예상</div>
          <div className="metric-value">{formatNumber(kpiResult.data?.averageStockoutDays ?? null, '일')}</div>
          <div className="metric-foot">계산 가능한 품목 기준</div>
        </div>
      </div>

      {kpiResult.error && (
        <div className="card section">
          <p className="text-danger">KPI 조회에 실패했습니다.</p>
          <p className="muted">{kpiResult.error}</p>
        </div>
      )}

      <div className="section card">
        <div className="card-title">
          <h3>품목별 소진 위험</h3>
          <span>가용재고 ÷ 일평균 사용량</span>
        </div>
        {riskResult.error ? (
          <div>
            <p className="text-danger">조회에 실패했습니다.</p>
            <p className="muted">{riskResult.error}</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={riskResult.rows}
            rowKey={(row) => row.itemId}
            empty="데이터가 없습니다. Exposed schemas 와 analytics.v_stockout_risk 를 확인하세요."
          />
        )}
      </div>
    </AnalysisFrame>
  );
}
