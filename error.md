# 오류 및 해결 기록

## 2026-09-04 — Agent 실제 Tool role 불일치

### 증상

인증 사용자의 role은 `USER` 또는 `ADMIN`인데 Agent 실제 Tool 4개가 `roles: ['server']`로만 선언되어, 정상 질문도 오케스트레이터의 실행 직전 권한 검사에서 `TOOL_NOT_ALLOWED`가 됩니다.

### 원인

`lib/auth.ts`의 애플리케이션 role과 `lib/agent/tools.ts`의 내부용 role 표기가 일치하지 않았습니다.

### 해결책

재현 테스트를 추가한 뒤 실제 데이터 Tool 4개의 허용 role을 `['USER', 'ADMIN']`으로 통일했습니다. ADMIN 전용 Tool 이름을 USER가 호출하는 경우는 오케스트레이터의 role 재검사로 계속 거부됩니다.

## 2026-09-04 — build와 tsc 동시 실행 시 `.next/types` race

### 증상

`npm.cmd run build`와 `npx.cmd tsc --noEmit`을 동시에 실행하면 `tsc`가 `.next/types/app/...` 파일을 찾지 못하는 `TS6053` 오류가 날 수 있습니다.

### 원인

`tsconfig.json`이 Next.js build가 생성하는 `.next/types/**/*.ts`를 include하는데, 두 명령이 동시에 실행되면서 TypeScript가 생성 전 파일을 읽었습니다.

### 해결책

검증 명령은 `npm.cmd test`와 build/tsc를 병렬 실행하지 않습니다. build가 끝난 뒤 `npx.cmd tsc --noEmit`을 단독 실행하면 통과합니다. 이는 소스 코드 결함이 아니라 검증 순서 문제입니다.

## 추가 사례 — npx.ps1 차단

`npx tsc --noEmit`도 같은 PowerShell 실행 정책으로 `npx.ps1`이 차단될 수 있습니다.

```powershell
npx.cmd tsc --noEmit
```

검증 결과 이 저장소에서는 TypeScript 검사가 오류 없이 통과했습니다.

## 2026-09-04 — PowerShell 실행 정책으로 npm.ps1 차단

### 증상

PowerShell에서 `npm test` 실행 시 다음 오류가 발생합니다.

```text
이 시스템에서 스크립트를 실행할 수 없으므로 C:\Program Files\nodejs\npm.ps1 파일을 로드할 수 없습니다.
PSSecurityException: UnauthorizedAccess
```

### 원인

PowerShell의 실행 정책이 `npm.ps1` 스크립트 실행을 차단하고 있습니다. Node.js 설치 문제나 프로젝트 테스트 오류가 아닙니다.

### 해결책

가장 간단한 우회 방법은 Windows 명령 스크립트를 직접 실행하는 것입니다.

```powershell
npm.cmd test
npm.cmd run build
```

영구적으로 현재 사용자 정책을 완화하려면 PowerShell에서 다음을 실행할 수 있습니다.

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

정책 변경 후 PowerShell을 다시 열면 `npm test`를 사용할 수 있습니다. 회사 PC 정책으로 변경이 차단되면 `npm.cmd` 방식을 사용합니다.

## 2026-09-04 — 구매추천 위험 상태 타입 불일치

### 증상

`npm run build`에서 `UNKNOWN` 위험 상태를 공통 `Badge` 컴포넌트에 전달할 수 없다는 TypeScript 오류가 발생했습니다.

### 원인

분석 모델은 데이터 부족 상태를 `UNKNOWN`으로 보존하지만, 화면 배지는 `SAFE`, `WARNING`, `CRITICAL`, `CALCULATION_UNAVAILABLE`만 지원합니다.

### 해결책

`lib/design-system.ts`에 `toBadgeStatus` 변환 함수를 추가해 지원되지 않는 상태를 `CALCULATION_UNAVAILABLE`로 표시하고, 구매추천 화면에서 변환 후 배지에 전달했습니다.

## 2026-09-04 — Supabase analytics 스키마 권한 부족

### 증상

`GET /api/health/supabase`가 다음 응답을 반환했습니다.

```text
Supabase query failed: permission denied for schema analytics
```

### 원인

공개 환경변수로 Supabase 프로젝트에는 접속했지만, 현재 API 역할이 `analytics` 스키마와 `v_stockout_kpi` 뷰를 조회할 권한이 없습니다.

### 해결책

Supabase Dashboard의 API Exposed schemas에 `analytics`와 `core`를 추가하고, 프로젝트의 `sql/01-grants.sql` 및 `sql/02-policies.sql` 권한 SQL을 적용합니다. 이후 schema cache가 갱신되면 endpoint가 `connected: true`를 반환합니다.

## 2026-08-28 — migration 파일 경로를 SQL로 실행함

### 증상

Supabase SQL Editor에서 다음과 같은 오류가 발생합니다.

```text
42601: syntax error at or near "superbase"
```

### 원인

`supabase/migrations/20260828000600_step6_step7_forecast_backtest.sql`은 실행할 SQL이 아니라 로컬 파일 경로입니다. 파일 경로만 SQL Editor에 입력하면 PostgreSQL 문법 오류가 발생합니다.

### 해결책

로컬 프로젝트의 해당 `.sql` 파일을 텍스트 편집기로 열고 파일 전체 내용을 복사한 뒤, Supabase SQL Editor에 붙여넣어 실행합니다. SQL Editor에는 `supabase/migrations/...` 경로를 입력하지 않습니다.

## 2026-08-28 — analytics.v_model_config가 schema cache에 없음

### 증상

관리자 Forecast 화면의 Model Registry 조회에서 다음 오류가 표시됩니다.

```text
Could not find the table 'analytics.v_model_config' in the schema cache
```

### 원인

Supabase REST API에 `analytics.v_model_config`를 직접 조회한 결과 `PGRST205`가 재현되었습니다. `supabase/migrations/20260828000600_step6_step7_forecast_backtest.sql`에는 해당 view 생성문이 있지만, 실제 Supabase 프로젝트에 migration이 실행되지 않았거나 실행 후 PostgREST schema cache가 갱신되지 않은 상태입니다.

### 해결책

Supabase SQL Editor에서 다음 migration 파일 전체를 실행합니다.

```text
supabase/migrations/20260828000600_step6_step7_forecast_backtest.sql
```

실행 후 다음 쿼리로 확인합니다.

```sql
select to_regclass('analytics.v_model_config') as model_config_view;
select * from analytics.v_model_config limit 1;
```

`model_config_view`가 `analytics.v_model_config`로 반환되어야 합니다. 그래도 schema cache 오류가 계속되면 Supabase Dashboard의 Settings → API에서 schema cache reload/restart를 수행한 뒤 다시 조회합니다.

### 주의

이 문제는 Next.js 코드만 수정해서 해결할 수 없습니다. STEP 2부터 STEP 6까지 migration이 순서대로 적용되어야 하며, `core.model_config`가 먼저 생성되어야 합니다.

## 2026-08-28 — Vercel 서버 예외 Digest 609131802@E488

### 증상

`scm-main-cyan.vercel.app` 접속 시 Next.js의 서버 예외 화면과 digest `609131802@E488`가 표시됩니다.

### 확인 결과

- 비로그인 `GET /dashboard`는 정상적으로 `/login?next=%2Fdashboard`로 리다이렉트됩니다.
- `GET /login`은 HTTP 200으로 렌더링됩니다.
- 로그인 후 보호된 레이아웃은 `lib/auth.ts`의 `requireUser()`에서 `core.app_user`를 조회합니다.
- `core.app_user` 조회 오류, 프로필 누락, 비활성 계정은 `forbidden()`으로 처리됩니다.

### 원인 후보

배포 Supabase 프로젝트에 STEP 2 migration이 적용되지 않았거나, 로그인한 사용자의 `core.app_user` 행이 없거나 비활성인 경우가 가장 유력합니다. 이 프로젝트에는 이전에 `42P01: relation "core.app_user" does not exist`가 기록되어 있습니다. Vercel Production 환경변수 누락도 로그인 전 middleware에서 같은 증상을 만들 수 있으므로 함께 확인해야 합니다.

### 해결책

1. Vercel의 Production 환경에 `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`를 등록합니다.
2. Supabase SQL Editor에서 STEP 2부터 현재까지의 migration을 순서대로 실행합니다.
3. 로그인 사용자의 `core.app_user` 행이 존재하는지, `active = true`인지 확인합니다.
4. 권한이 없는 경우에는 서버 예외 대신 `app/forbidden.tsx`의 안내 화면이 표시되도록 Next.js `authInterrupts`를 활성화했습니다.

### 적용 상태

코드 수정 및 로컬 build 확인 후 재배포가 필요합니다. DB migration과 Vercel 환경변수는 배포 환경에서 수동 확인해야 합니다.

## 2026-08-27 — 소진위험 분석 메뉴가 웹에 보이지 않음

### 증상

소진위험 분석 페이지를 구현하고 Git에 푸시했지만 웹의 분석 메뉴에는 리드타임 분석만 표시됩니다.

### 원인

`components/analysis/analysis-tabs.tsx`에 `/analysis/stockout` 링크는 등록되어 있지만, `AnalysisTabs` 컴포넌트를 `AnalysisFrame` 또는 분석 페이지에서 렌더링하고 있지 않습니다. 또한 메인 사이드바의 분석 링크는 현재 `/analysis/leadtime`만 가리킵니다.

### 확인 방법

- `components/analysis/analysis-tabs.tsx`에서 `ready: true`인 소진위험 탭을 확인합니다.
- `rg` 검색 결과 `AnalysisTabs`의 정의만 있고 사용처가 없습니다.
- `/analysis/stockout`을 직접 열면 페이지 라우트는 존재하지만, 현재 화면에서 이동할 메뉴가 없습니다.

### 해결책

분석 공통 프레임인 `components/analysis/analysis-frame.tsx`에서 `AnalysisTabs`를 렌더링하거나, 각 분석 페이지의 제목 영역 아래에 공통으로 렌더링합니다. 그러면 리드타임과 소진위험 탭이 분석 화면에 표시됩니다.

추가로 메인 사이드바에서 소진위험을 바로 노출하려면 `components/procurement-app.tsx`에 `/analysis/stockout` 링크를 추가합니다. 배포 환경에서는 수정 커밋이 실제 배포된 버전인지도 확인해야 합니다.

### 적용 상태

`components/analysis/analysis-frame.tsx`에 `AnalysisTabs`를 연결했습니다. 이제 `/analysis/leadtime`과 `/analysis/stockout`에서 두 분석 탭이 표시됩니다.

## 2026-08-28 — core.app_user 테이블이 존재하지 않음

### 증상

Supabase SQL Editor에서 다음 쿼리를 실행할 때 `42P01: relation "core.app_user" does not exist` 오류가 발생합니다.

```sql
update core.app_user
set role = 'ADMIN', active = true
where email = '관리자이메일@example.com';
```

### 원인

프로젝트 코드에는 STEP 2 migration이 있지만, 해당 migration이 실제 Supabase 프로젝트에 아직 실행되지 않았습니다. 따라서 `core` 스키마 또는 `core.app_user` 테이블이 DB에 생성되지 않은 상태입니다.

### 해결책

Supabase Dashboard → SQL Editor에서 다음 파일의 전체 내용을 먼저 실행합니다.

```text
supabase/migrations/20260828000200_step2_auth_rbac.sql
```

실행 후 테이블 생성 여부를 확인합니다.

```sql
select to_regclass('core.app_user') as app_user_table;
```

`core.app_user`가 반환되면 관리자 지정 쿼리를 다시 실행합니다.

```sql
update core.app_user
set role = 'ADMIN', active = true
where email = '관리자이메일@example.com';
```

### 주의

- STEP 2 migration은 STEP 3 migration보다 먼저 실행해야 합니다.
- Auth 사용자 계정을 먼저 만든 뒤 관리자 지정 쿼리를 실행합니다.
- migration 실행 전에는 `core.app_user`에 직접 INSERT하지 않습니다.

## 2026-08-28 — STEP 4 검증 테스트에서 모듈을 찾지 못함

### 증상

`npm test` 실행 시 `lib/import/validate.test.ts`에서 `Cannot find module .../lib/import/schema` 오류가 발생했습니다.

### 원인

프로젝트의 테스트 실행 방식은 Node가 TypeScript 파일을 직접 로드하므로, 새 Import 순수 모듈의 상대 import에 `.ts` 확장자가 필요합니다.

### 해결책

`validate.test.ts`와 `validate.ts`의 상대 import를 `.ts` 확장자로 명시했습니다. Next.js 빌드 설정의 `allowImportingTsExtensions`와도 일치합니다.

추가로 `Date.parse`가 존재하지 않는 날짜를 자동 보정하는 문제를 확인해, 연·월·일을 직접 대조하는 엄격한 날짜 검증으로 보완했습니다.

## 2026-08-28 — STEP 5 SQL 격리 테스트 정규식 불일치

### 증상

수요 프로파일 테스트가 LUMPY 분류 구문을 찾지 못해 실패했습니다.

### 원인

SQL은 앞의 세 조건을 분기한 뒤 남은 경우를 `else 'LUMPY'`로 처리하는데, 테스트가 존재하지 않는 명시적 `>=` 분기 문장을 기대했습니다.

### 해결책

테스트를 실제 SQL 구조에 맞춰 `else 'LUMPY'`를 검증하도록 수정했습니다. Demand Type 계산은 계속 SQL에서만 수행합니다.

## 2026-08-28 — STEP 6·7 TypeScript 타입 검사 오류

### 증상

`npx tsc --noEmit`에서 관리자 Server Action 반환 타입, ES5 대상의 `Set`/`HTMLCollection` 순회, Forecast 정규화 helper 호출 오류가 발생했습니다.

### 원인

기존 프로젝트가 `target: es5`를 사용하고 있으며, Next.js form action은 `void | Promise<void>` 반환을 요구합니다. 또한 기존 숫자 helper는 행/컬럼 두 인자 형태였습니다.

### 해결책

Server Action은 결과 ID를 반환하지 않고 완료만 반환하도록 수정했고, `Array.from`으로 컬렉션을 변환했습니다. 숫자 helper는 단일 값과 행/컬럼 호출을 모두 지원하도록 보완했습니다.
