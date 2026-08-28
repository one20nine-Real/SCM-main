# 오류 및 해결 기록

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
