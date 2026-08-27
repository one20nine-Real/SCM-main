# 월간 발주계획 시스템 아키텍처

> 기준 경로: 저장소 루트 `C:\Users\fujifilm\Desktop\superSCM-main`
>
> 이 문서는 현재 커밋의 실제 파일 구조와 구현 상태를 기준으로 작성한 개발자용 안내서입니다. 화면에 표시되는 일부 값은 아직 대표 샘플이며, 모든 업무 단계가 데이터베이스와 연결된 상태는 아닙니다.

## 1. 한눈에 보는 요약

한국후지필름BI의 월간 기기·옵션 발주계획을 위한 Next.js 15 프로토타입입니다. 사용자는 하나의 업무 플로우에서 전체 현황, 수요 확정, 재고·공급, 마스터 검증, 발주량 계산, 보고자료 단계를 순서대로 확인하고, 별도의 분석 메뉴에서 Supabase의 `analytics` 뷰를 조회합니다.

```text
브라우저
  ├─ /                         → app/page.tsx
  │                              → components/procurement-app.tsx
  │                                → components/workflow/*
  │
  ├─ /analysis/leadtime        → app/analysis/leadtime/page.tsx
  │                                → lib/scm.ts
  │                                  → lib/supabase/server.ts
  │                                    → Supabase analytics.v_leadtime_gap
  │                                → components/analysis/*
  │
  ├─ /analysis/stockout        → app/analysis/stockout/page.tsx
  │                                → lib/scm.ts
  │                                  → Supabase analytics.v_stockout_risk
  │                                  → Supabase analytics.v_stockout_kpi
  │                                → components/analysis/*
  │
  └─ /api/health/supabase      → app/api/health/supabase/route.ts
                                 → 환경변수 설정 여부 확인
```

### 핵심 설계 원칙

- 화면 라우팅은 Next.js App Router의 `app/` 디렉터리가 담당합니다.
- 전체 업무 플로우는 `ProcurementApp` 클라이언트 컴포넌트가 현재 단계를 상태로 관리합니다.
- 분석 화면은 서버 컴포넌트에서 조회 함수를 호출하고, 조회 로직은 `lib/scm.ts`에 모읍니다.
- Supabase 원본 `raw` 스키마는 화면에서 직접 조회하지 않습니다. `core`가 정제·기준값을 제공하고 `analytics`가 화면용 결과를 제공합니다.
- 화면 표시용 타입과 컬럼명 정규화는 `lib/scm-model.ts`에 둡니다.
- 전역 스타일은 `app/globals.css`의 순수 CSS를 사용하며 Tailwind나 CSS Modules는 사용하지 않습니다.
- 현재 워크플로우 단계는 대표 샘플값 중심의 Phase 1 화면이고, 리드타임·소진위험 분석은 Supabase 조회와 연결되어 있습니다.

## 2. 폴더별 요약

| 폴더 | 기능 요약 | 주요 파일 |
|---|---|---|
| `app/` | Next.js 라우트, 전역 레이아웃, 전역 스타일, API Route | `page.tsx`, `layout.tsx`, `globals.css`, `analysis/leadtime/page.tsx`, `analysis/stockout/page.tsx`, `api/health/supabase/route.ts` |
| `components/` | 화면을 구성하는 재사용 React 컴포넌트 | `procurement-app.tsx`, `analysis/*`, `workflow/*` |
| `components/analysis/` | 분석 화면의 프레임, 탭, 표 공통 껍데기 | `analysis-frame.tsx`, `analysis-tabs.tsx`, `data-table.tsx` |
| `components/workflow/` | 6단계 월간 발주 업무 화면 | `dashboard-step.tsx`, `demand-step.tsx`, `supply-step.tsx`, `master-step.tsx`, `calculation-step.tsx`, `report-step.tsx`, `step-frame.tsx` |
| `lib/` | 도메인 타입·정규화, Supabase 조회, 클라이언트 생성 | `scm-model.ts`, `scm.ts`, `supabase.ts`, `supabase/*` |
| `supabase/` | Supabase 로컬 설정과 데이터베이스 마이그레이션 | `config.toml`, `migrations/*` |
| `sql/` | Supabase 권한 및 RLS 정책을 수동 적용하는 SQL | `01-grants.sql`, `02-policies.sql` |
| `docs/` | 실습 안내 및 Superpowers 산출물 | `04-실습안내.md`, `superpowers/*` |
| `outputs/` | 생성된 Excel 문서와 미리보기 이미지 | `기기_옵션_월간발주_프로세스정의서.xlsx`, `preview_*.png` |
| 루트 문서 | 프로젝트 규칙, 스키마, PRD, 배포 안내 | `AGENTS.md`, `SCHEMA.md`, `README.md`, `README_배포전_확인.md` |
| `superSCM/` | 루트와 유사한 하위 프로젝트 사본 | 루트와 유사한 `app/`, `components/`, `lib/` 등 |

## 3. 폴더별 상세 설명

### 3.1 `app/`: 라우팅과 애플리케이션 진입점

`app/`은 Next.js App Router의 라우트 트리입니다. 페이지 파일은 URL과 직접 연결되고, 레이아웃은 하위 라우트에 공통 HTML 구조와 메타데이터를 제공합니다.

| 파일 | 역할 |
|---|---|
| `app/layout.tsx` | 전체 페이지의 루트 레이아웃. `lang="ko"`, 페이지 제목·설명 메타데이터, `globals.css` 로딩을 정의합니다. |
| `app/page.tsx` | `/` 진입점. `ProcurementApp`을 렌더링합니다. |
| `app/globals.css` | 앱 전체의 레이아웃·워크플로우·분석 화면·카드·표·버튼 스타일을 정의하는 단일 전역 스타일 파일입니다. |
| `app/analysis/leadtime/page.tsx` | `/analysis/leadtime` 분석 화면. `getLeadtimeGap()`을 호출해 공급처별 리드타임 격차 KPI와 표를 서버에서 렌더링합니다. `force-dynamic`으로 캐시된 결과 대신 최신 조회를 사용합니다. |
| `app/analysis/stockout/page.tsx` | `/analysis/stockout` 분석 화면. `getStockoutRisk()`와 `getStockoutKpi()`를 병렬 호출해 KPI 카드와 품목별 소진위험 표를 서버에서 렌더링합니다. 상태와 계산 불가 사유는 DB 결과를 표시용 문구로 변환합니다. |
| `app/api/health/supabase/route.ts` | `GET /api/health/supabase` API. Supabase URL과 publishable key가 설정됐는지만 확인하며 실제 DB 쿼리는 하지 않습니다. 미설정 시 503을 반환합니다. |

현재 루트에는 `app/analysis/layout.tsx`가 없습니다. 분석 화면 공통 UI는 별도 레이아웃이 아니라 `components/analysis/analysis-frame.tsx`로 조합됩니다.

### 3.2 `components/`: 화면 조합 계층

#### `components/procurement-app.tsx`

전체 프로토타입의 클라이언트 컨트롤러입니다. `StepId`와 `steps` 목록으로 6개 업무 단계를 정의하고, `active` 상태와 이전·다음 이동을 관리합니다. 현재 선택된 단계에 맞춰 워크플로우 컴포넌트를 렌더링하며, 사이드바와 상단 진행 표시줄도 이 파일에서 조합합니다.

이 컴포넌트가 `'use client'`인 이유는 단계 전환 상태와 클릭 이벤트를 브라우저에서 관리하기 때문입니다. `/analysis/leadtime` 링크는 일반 Next.js `Link`로 별도 서버 렌더링 라우트로 이동합니다.

#### `components/workflow/`

월간 발주계획의 6단계 업무 화면을 표현합니다. 현재는 입력 저장이나 계산 서비스가 연결되지 않은 프로토타입이며, 단계별 대표 데이터와 UI 흐름을 보여주는 책임을 가집니다.

| 파일 | 역할 |
|---|---|
| `dashboard-step.tsx` | 전체 현황 화면. KPI 카드, 프로세스 준비상태, 발주계획 목록, 단계 진입 버튼을 샘플값으로 표시합니다. |
| `demand-step.tsx` | 수요 확정 화면. OL·SFDC·대량 거래 등 수요 확정에 필요한 화면 구조와 대표 행을 표시합니다. |
| `supply-step.tsx` | 재고·공급 화면. 재고, Open PO, 입고 예정 등 수급 검토 UI를 표시합니다. |
| `master-step.tsx` | 마스터 검증 화면. 품목·공급처 기준정보 및 업로드 관련 UI를 표시합니다. |
| `calculation-step.tsx` | 발주량 계산 화면. 계산 결과와 예외 검토 영역의 프로토타입을 표시합니다. |
| `report-step.tsx` | 보고자료 화면. 경영진 보고용 결과 미리보기 구조를 표시합니다. |
| `step-frame.tsx` | 단계 공통 하단 프레임. 이전/다음 버튼과 프로토타입 안내 문구를 제공합니다. |

새로운 실제 기능을 붙일 때는 단계 컴포넌트에 직접 계산식을 넣기보다 도메인 모델·조회 함수·저장 함수를 별도 계층으로 분리해야 합니다.

#### `components/analysis/`

분석 페이지가 데이터 조회와 분석 의미에 집중하도록 공통 표시 요소를 제공합니다.

| 파일 | 역할 |
|---|---|
| `analysis-frame.tsx` | 분석 제목, 설명, `SUPABASE LIVE` 배지를 포함한 공통 분석 화면 프레임입니다. |
| `analysis-tabs.tsx` | 분석 화면 간 이동 탭입니다. 완성된 경로만 링크로 만들고, 미완성 화면은 `ready: false`와 `오후 실습` 배지로 비활성 표시합니다. 현재 리드타임과 소진위험 탭은 모두 활성화되어 있습니다. |
| `data-table.tsx` | 제네릭 `DataTable<T>`와 `Column<T>`을 제공하는 표 컴포넌트입니다. 컬럼 정렬·렌더러·빈 결과 문구를 외부에서 주입할 수 있고, `formatNumber()`로 숫자와 null을 표시합니다. |

### 3.3 `lib/`: 도메인과 외부 데이터 접근

`lib/`은 UI와 Supabase SDK 사이의 경계입니다. 화면은 가능한 한 이 계층의 함수를 호출하고, Supabase 스키마명이나 컬럼명 차이를 화면에 노출하지 않습니다.

| 파일 | 역할 |
|---|---|
| `lib/scm-model.ts` | `LeadtimeGap`, `StockoutRisk`, `StockoutKpi` 타입과 각 정규화 함수를 정의합니다. 여러 후보 컬럼명을 순서대로 확인해 화면용 표준 타입으로 정규화하고, 숫자 변환 실패와 계산 불가 null을 안전하게 처리합니다. |
| `lib/scm-model.test.ts` | SCM 모델과 정규화 함수의 Node 테스트 파일입니다. |
| `lib/scm.ts` | 조회 함수의 집합입니다. `getLeadtimeGap()`은 `analytics.v_leadtime_gap`, `getStockoutRisk()`는 `analytics.v_stockout_risk`, `getStockoutKpi()`는 `analytics.v_stockout_kpi`를 조회·정규화합니다. 조회 오류와 예외를 화면이 구분할 수 있는 반환 형태로 바꿉니다. |
| `lib/supabase.ts` | 브라우저/서버 클라이언트와 환경변수 함수를 외부에 재-export하는 진입점입니다. |
| `lib/supabase/env.ts` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 읽고 검증합니다. secret key는 다루지 않습니다. |
| `lib/supabase/server.ts` | 서버 컴포넌트와 서버 조회 함수가 사용하는 Supabase 클라이언트를 생성합니다. 세션 유지·자동 갱신을 끈 읽기 중심 설정입니다. |
| `lib/supabase/client.ts` | 클라이언트 컴포넌트에서 사용할 브라우저 Supabase 클라이언트를 생성합니다. |

분석 화면의 호출 경계는 다음과 같습니다.

```text
app/analysis/leadtime/page.tsx
  → getLeadtimeGap()
    → createSupabaseServerClient()
      → supabase.schema('analytics').from('v_leadtime_gap').select('*')
    → normalizeLeadtimeGap()
  → AnalysisFrame + DataTable
```

### 3.4 `supabase/`: 데이터베이스 변경 이력

| 파일 | 역할 |
|---|---|
| `supabase/config.toml` | 로컬 Supabase 프로젝트 설정. 프로젝트 ID, API·Studio 활성화, PostgreSQL 15 버전을 정의합니다. |
| `supabase/migrations/20260813000100_create_procurement_demand_core.sql` | 수요 확정 기능의 초기 스키마 마이그레이션입니다. `planning_runs`, `ol_demand`, `sfdc_pipeline`, `bulk_deals`, `historical_actuals`, `demand_confirmations` 테이블과 인덱스·`updated_at` 트리거를 생성합니다. |

현재 마이그레이션은 `public` 스키마의 수요 확정 테이블을 생성합니다. `SCHEMA.md`에 정의된 `raw`, `core`, `analytics`의 원본·정제·분석 뷰 구조는 `dump.sql` 또는 원격 Supabase 상태와 함께 관리되는 것으로 보이며, 루트 마이그레이션 파일에 전체 분석 뷰 정의가 들어 있지는 않습니다.

### 3.5 `sql/`: 권한 및 보안 정책

| 파일 | 역할 |
|---|---|
| `sql/01-grants.sql` | `anon`, `authenticated` 롤에 `core`, `analytics` 스키마 사용 권한과 읽기 권한을 부여합니다. `raw`는 의도적으로 노출하지 않습니다. 향후 생성될 core·analytics 테이블에도 기본 SELECT 권한을 부여합니다. |
| `sql/02-policies.sql` | `core.leadtime_plan`, `core.usage_profile`에 수업용 전체 허용 RLS 정책과 쓰기 권한을 부여합니다. 운영 환경에서는 `auth.uid()` 등으로 범위를 제한해야 합니다. |

Supabase Dashboard의 Data API Exposed schemas에 `core`, `analytics`가 빠지면 권한·노출 설정 문제로 빈 결과가 반환될 수 있으므로, 조회 오류와 빈 결과를 화면에서 구분해야 합니다.

### 3.6 `docs/`: 업무·실습 문서

| 경로 | 역할 |
|---|---|
| `docs/04-실습안내.md` | 4회차 실습의 작업 순서와 검증 방법을 설명합니다. |
| `docs/superpowers/04-실습안내.md` | 같은 실습 안내의 Superpowers 작업 맥락 사본입니다. |
| `docs/superpowers/specs/2026-08-13-procurement-planning-mvp-prd.md` | MVP 요구사항 산출물입니다. |
| `docs/superpowers/plans/2026-08-13-procurement-planning-mvp-plan.md` | 구현 계획 산출물입니다. |

### 3.7 `outputs/`: 생성 산출물

`outputs/019ff8b7-725b-7b41-99a2-f3b7bc66ee76/`에는 프로세스 정의서 Excel 파일, 검사 결과 NDJSON, 사용 안내·프로세스맵·계산 규칙·데이터 정의·RACI·KPI 등의 PNG 미리보기가 있습니다. 애플리케이션 실행 코드가 아니라 문서 생성 결과이므로 런타임 의존성은 없습니다.

### 3.8 루트의 주요 파일

| 파일 | 역할 |
|---|---|
| `AGENTS.md` | 프로젝트 작업 규칙. 데이터 계층, CSS, 화면 생성 순서, 검증 규칙을 정의합니다. |
| `SCHEMA.md` | Supabase 스키마 역할과 뷰·테이블 컬럼 정의, 기대 건수, 접속 방법을 설명합니다. |
| `README.md` | 실행 방법, 현재 Phase 1 범위, Supabase 연결 및 다음 구현 단계를 안내합니다. |
| `README_배포전_확인.md` | 배포 전 확인 사항입니다. |
| `2026-08-13-procurement-planning-mvp-prd.md` | 제품 요구사항 문서입니다. |
| `적용방법.md` | 프로젝트 적용·실습 방법 안내입니다. |
| `package.json` | Next.js, React, Supabase, lucide-react 의존성과 `dev`, `build`, `test`, `start` 스크립트를 정의합니다. |
| `package-lock.json` | npm 의존성 잠금 파일입니다. |
| `tsconfig.json` | strict TypeScript, bundler 모듈 해석, `@/*` 경로 별칭을 정의합니다. |
| `next.config.ts` | Next.js 설정. 현재 React Strict Mode를 활성화합니다. |
| `vercel.json` | Vercel에서 Next.js 프레임워크로 배포하도록 선언합니다. |
| `.env.example` | Supabase 환경변수 입력 예시입니다. |
| `.env.local.example` | 로컬 개발용 환경변수 예시입니다. 실제 값은 `.env.local`에만 둡니다. |
| `.gitignore` | 의존성, Next.js 산출물, 환경변수, Vercel 및 임시 파일을 Git에서 제외합니다. |
| `dump.sql` | Supabase 데이터·뷰·스키마를 복원하기 위한 SQL 덤프입니다. |
| `build_dummy_demand_data.mjs` | 수요 관련 더미 데이터 생성 스크립트입니다. |
| `build_workbook.mjs` | 프로세스 정의서 등 Excel 산출물을 생성하는 스크립트입니다. |
| `next-env.d.ts` | Next.js가 생성하는 TypeScript 환경 선언 파일입니다. |
| `ARCHITECTURE.md` | 이 문서. 저장소 구조와 파일 책임을 설명합니다. |

### 3.9 `superSCM/`: 중복 하위 사본

`superSCM/`에는 루트와 거의 같은 프로젝트 파일이 다시 들어 있습니다. 확인된 차이로 하위 사본에는 `app/analysis/layout.tsx`, `tsconfig.json`, `vercel.json` 등이 추가되어 있습니다. 현재 `package.json`과 Git 명령을 실행한 기준은 저장소 루트이므로, 개발·문서화 기준 경로도 루트로 잡습니다.

이 디렉터리가 배포 대상인지 단순 복사본인지 명확한 자동화 설정은 확인되지 않았습니다. 기능을 추가할 때 두 위치를 동시에 수정하면 구조가 더 분기될 수 있으므로, 먼저 공식 소스 루트를 결정하고 필요하면 사본을 정리해야 합니다.

## 4. 데이터 아키텍처

### 4.1 스키마 책임

| 스키마 | 책임 | 화면 접근 |
|---|---|---|
| `raw` | CSV 원본 적재. 적재 후 직접 수정하지 않음 | 직접 조회 금지 |
| `core` | 공급처 별칭, 기준 리드타임, 사용 프로파일, 정제 뷰 | 기준값 저장·정제 결과 제공 |
| `analytics` | 화면·AI가 소비하는 계산 결과 뷰 | 화면의 기본 조회 대상 |
| `public` | 현재 마이그레이션이 정의한 수요 확정 업무 테이블 | 향후 입력·저장 기능 대상 |

대표적인 `analytics` 뷰는 `v_leadtime_gap`, `v_stockout_risk`, `v_stockout_kpi`, `v_usage_profile`, `v_usage_anomaly`입니다. 계산·평균·분위수는 화면 코드가 아니라 SQL 뷰에서 수행하는 것이 기준입니다.

### 4.2 분석 조회 규칙

새 분석 화면은 다음 순서로 추가합니다.

1. `lib/scm-model.ts`: 타입과 컬럼 후보 정규화 함수를 추가합니다.
2. `lib/scm.ts`: `.schema('analytics')`를 사용하는 조회 함수를 추가합니다.
3. `app/analysis/<기능이름>/page.tsx`: 조회 오류·빈 결과·화면을 구현합니다.
4. `components/analysis/*`: 공통 프레임과 표를 재사용합니다.

조회 결과는 다음 세 상태를 구분해야 합니다.

- 조회 오류: Supabase 오류 메시지와 함께 실패 표시
- 정상 조회 + 빈 배열: 데이터 없음 또는 Exposed schemas 설정 점검 안내
- 정상 조회 + 데이터: KPI와 표 표시

### 4.3 현재 분석 화면의 데이터 흐름

`/analysis/leadtime`은 서버 컴포넌트가 `getLeadtimeGap()`을 호출합니다. 조회 함수는 서버 Supabase 클라이언트로 `analytics.v_leadtime_gap`을 읽고, 정규화된 `LeadtimeGap` 배열을 반환합니다. 페이지는 배열에서 공급처 수, 실제 리드타임이 더 긴 공급처 수, 표본 부족 공급처 수를 표시하고 `DataTable`에 행을 전달합니다.

페이지 안의 `gap` 색상 판정은 이미 계산된 `gap_days`의 표시 방식만 결정합니다. P80, 평균, 격차 자체를 다시 계산하지 않습니다.

#### 소진위험 분석 구현과 재사용 경계

소진위험 분석은 리드타임 분석과 같은 4계층 패턴을 사용하지만, 도메인 모델과 조회 뷰만 분리합니다.

```text
app/analysis/stockout/page.tsx
  → Promise.all([getStockoutRisk(), getStockoutKpi()])
    → createSupabaseServerClient()
      → analytics.v_stockout_risk
      → analytics.v_stockout_kpi
    → normalizeStockoutRisk() / normalizeStockoutKpi()
  → AnalysisFrame
  → DataTable<StockoutRisk>
```

각 계층의 책임은 다음과 같습니다.

| 계층 | 소진위험에서 담당하는 일 | 재사용 방식 |
|---|---|---|
| `lib/scm-model.ts` | DB 컬럼을 `StockoutRisk`, `StockoutKpi`로 정규화하고 `SAFE`, `CRITICAL`, `UNKNOWN` 및 사유 코드를 보존 | 다른 뷰의 컬럼명이 달라도 화면 타입을 안정적으로 유지 |
| `lib/scm.ts` | 소진위험 상세 행과 KPI를 각각 조회하고 오류를 `{ rows/data, error }`로 반환 | 페이지가 Supabase SDK나 스키마명을 직접 알지 않도록 분리 |
| `app/analysis/stockout/page.tsx` | KPI 카드·상태 표시·표 컬럼을 조합하고 화면 문구를 결정 | 분석별로 필요한 컬럼 정의만 새로 작성 |
| `components/analysis/*` | 제목 프레임, 탭, 제네릭 표, 숫자 포맷 제공 | 리드타임과 모든 후속 분석 화면에서 공통 사용 |

`getStockoutRisk()`와 `getStockoutKpi()`는 서로 독립적인 조회이므로 `Promise.all()`로 병렬 실행합니다. 한쪽 조회만 실패한 경우에도 성공한 쪽은 표시하고, 실패한 영역에만 오류를 표시할 수 있습니다. 상세 행이 빈 배열인 경우에는 단순히 숫자 0으로 바꾸지 않고, 뷰 또는 Exposed schemas 설정을 확인하도록 안내합니다.

소진위험 페이지의 표는 `DataTable`의 `Column<StockoutRisk>` 정의만 교체합니다. 공통 표 컴포넌트는 컬럼의 `render` 함수를 호출하므로 상태 색상, 날짜 포맷, null 및 사유 표시를 분석 페이지가 독립적으로 제어할 수 있습니다. 향후 사용량 이상·입고 지연 분석도 동일하게 타입, 정규화 함수, 조회 함수, 페이지별 컬럼 정의만 추가하면 됩니다.

계산 기준은 화면에 두지 않습니다. `available_qty`, `stockout_days`, `stockout_date`, `risk_status`는 `analytics` 뷰가 계산하고, 화면은 이미 계산된 값을 표시합니다. 사용량 또는 리드타임이 없어 계산할 수 없는 행은 `stockoutDays: null`로 유지하고 `NO_USAGE`, `NO_LEADTIME` 사유를 표시합니다.

## 5. 화면 상태와 의존관계

### 메인 워크플로우

```text
app/page.tsx
  → ProcurementApp
    → active: StepId
    → DashboardStep | DemandStep | SupplyStep | MasterStep
       | CalculationStep | ReportStep
    → StepFrame
```

`active`는 URL이나 DB에 저장되지 않는 브라우저 메모리 상태입니다. 페이지를 새로고침하면 기본 단계인 `dashboard`로 돌아갑니다. 단계 이동은 `navigate()`가 인덱스를 범위 내로 제한해 처리합니다.

### 분석 메뉴

```text
ProcurementApp sidebar
  → Link('/analysis/leadtime')
    → LeadtimePage
      → AnalysisFrame
      → DataTable<LeadtimeGap>
```

`AnalysisTabs`에는 `/analysis/leadtime`과 `/analysis/stockout`이 활성 링크로 등록되어 있습니다. 새 분석 경로를 추가할 때는 페이지 구현 전 `ready: false`로 두어 404와 미완성 기능을 구분할 수 있습니다.

## 6. 보안·환경변수·배포

- 브라우저와 서버 모두 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 사용합니다.
- `sb_secret_*` 키는 클라이언트 코드에 넣지 않습니다.
- `.env.local`은 Git에 커밋하지 않습니다.
- 현재 서버 클라이언트는 세션 없는 읽기 중심 설정입니다. 인증·권한 기반 쓰기 기능을 추가하면 서버 세션 처리와 RLS 조건을 함께 설계해야 합니다.
- `sql/02-policies.sql`의 전체 허용 정책은 수업용입니다. 운영 배포에서는 사용자·역할별 정책으로 교체해야 합니다.
- `vercel.json`은 Vercel Next.js 배포를 선언하지만, 실제 Supabase URL·키와 스키마 노출·권한 설정은 배포 환경에서 별도로 구성해야 합니다.

## 7. 개발 및 검증 명령

```bash
npm install
npm run dev
npm run test
npm run build
```

권장 확인 순서는 다음과 같습니다.

1. `/`에서 6단계 워크플로우 이동이 되는지 확인합니다.
2. `/analysis/leadtime`에서 Supabase 조회 성공·실패·빈 결과가 각각 올바르게 표시되는지 확인합니다.
3. 화면의 공급처 행 수가 `analytics.v_leadtime_gap`의 결과 수와 같은지 확인합니다.
4. `gap = P80 - 마스터`의 부호와 색상이 맞는지 확인합니다.
5. 환경변수가 없을 때 `/api/health/supabase`가 503을 반환하는지 확인합니다.
6. 변경 후 `npm run build`를 실행합니다.

## 8. 현재 범위와 향후 확장 지점

현재 구현된 것은 업무 플로우를 설명하는 UI 프로토타입과 리드타임·소진위험 분석 조회입니다. README에 명시된 다음 단계인 SQLite 저장, 직접 입력·Excel/CSV 업로드, 실제 발주량 계산, 수동 조정 이력, Excel/PDF 다운로드는 아직 별도 서비스나 API로 구현되지 않았습니다.

향후 기능을 추가할 때는 다음 경계를 유지해야 합니다.

- 입력·확정 데이터는 정해진 저장 테이블과 RLS를 통해 관리합니다.
- 원본 데이터를 화면에서 직접 수정하지 않습니다.
- 계산식은 SQL 뷰 또는 순수 모델 함수에 둡니다.
- 계산 불가 값은 임의의 숫자 대신 `null`과 사유 코드로 표현합니다.
- 화면 컴포넌트는 조회·저장·계산의 세부 구현을 직접 소유하지 않습니다.
- 실제 소스 루트로 루트 디렉터리를 사용할지 `superSCM/`을 사용할지 먼저 확정합니다.
