# STEP 5 SKU Demand Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `core.v_train_demand`만 사용해 SKU별 수요 패턴을 SQL에서 계산하고 `/analysis/demand-profile`에서 조회한다.

**Architecture:** SQL migration이 forecast setting의 학습기간을 월 Grid로 확장하고 ADI, CV², 추세, 최근 변화, peak, seasonality를 계산한다. `lib/demand-profile-model.ts`는 SQL 결과를 화면 모델로 정규화하고, `lib/scm.ts`가 `analytics` view만 조회한다. 화면은 저장된 결과를 필터링하고 공통 Badge/EmptyValue로 표시한다.

**Tech Stack:** PostgreSQL views, Next.js App Router, TypeScript, 순수 CSS, 기존 Supabase SSR client.

**Spec:** 사용자 승인 채팅 설계(2026-08-28 STEP 5)

## Global Constraints

- Demand Profile은 반드시 `core.v_train_demand`만 사용한다.
- `raw.usage_history`, `core.v_test_actual`, test 기간 actual을 화면·계산 코드에서 직접 사용하지 않는다.
- ADI는 전체 학습 기간 수 / 양수 수요 기간 수로 계산한다.
- CV²는 양수 수요 기간의 표준편차 / 평균을 제곱한다.
- 분류 코드는 `SMOOTH`, `INTERMITTENT`, `ERRATIC`, `LUMPY`만 사용한다.
- 24개월 미만 seasonality는 `NULL`과 `INSUFFICIENT_PERIODS`를 반환한다.
- 계산 불가 값은 0으로 보정하지 않는다.
- 계산은 SQL, React는 조회 결과 표시와 필터링만 담당한다.

### Task 1: 수요 프로파일 모델 테스트

**Files:**
- Create: `lib/demand-profile-model.test.ts`
- Create: `lib/demand-profile-model.ts`

- [x] Write tests for four Syntetos-Boylan-Croston classifications, unavailable reason handling, and filter predicates.
- [x] Run `npm test` and confirm the new test fails because the model functions do not exist.
- [x] Implement minimal result normalization and filter helpers without statistical calculations.
- [x] Run `npm test` and confirm all tests pass.

### Task 2: 학습기간 수요 프로파일 SQL

**Files:**
- Create: `supabase/migrations/20260828000500_step5_demand_profile.sql`

- [x] Create `analytics.v_sku_demand_profile` from `core.v_train_demand`, `core.forecast_setting`, and `core.v_item_master` only.
- [x] Generate monthly periods from train_start through train_end and left join aggregated positive demand, preserving grid zeros separately from source nulls.
- [x] Return null reason codes for no demand, insufficient samples, and insufficient seasonality periods.
- [x] Create `analytics.v_demand_profile_kpi` and grants for authenticated users.
- [x] Add comments documenting tie handling for peak period and Syntetos-Boylan-Croston thresholds.

### Task 3: 조회 계층

**Files:**
- Modify: `lib/scm-model.ts`
- Modify: `lib/scm.ts`

- [x] Add the typed Demand Profile model and normalize SQL aliases without recomputing metrics.
- [x] Add `getDemandProfiles()` and `getDemandProfileKpi()` using `.schema('analytics')` only.
- [x] Run `npm test` and TypeScript validation.

### Task 4: 분석 화면과 메뉴

**Files:**
- Create: `app/(user)/analysis/demand-profile/page.tsx`
- Modify: `lib/menu.ts`
- Modify: `app/globals.css`

- [x] Render KPI cards and the profile table with Badge and EmptyValue.
- [x] Filter persisted rows by SKU, demand type, and calculation availability only.
- [x] Add the route to the shared user menu and responsive styles using existing CSS tokens.
- [x] Run `npm test`, `npx tsc --noEmit`, and `npm run build`.

### Task 5: 최종 검증

**Files:**
- Modify: `error.md` only if a new implementation error occurs.

- [x] Verify no new code references `raw.usage_history` or `core.v_test_actual` for Demand Profile.
- [x] Verify migration ordering after STEP 4 and report that Supabase SQL Editor application is required.
- [x] Run the full test suite and production build again before completion.
