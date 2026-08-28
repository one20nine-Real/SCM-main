# 오류 및 해결 기록

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
