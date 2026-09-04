# STEP 9 Inventory Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Forecast 기반 기간별 Inventory Projection과 Lead Time 정책 이력을 추가하고 기존 Stockout Risk를 교체한다.

**Architecture:** 계산은 `supabase/migrations/20260828000900_step9_inventory_projection.sql`의 view와 RPC에서 수행한다. Next.js는 analytics view를 조회하고 ADMIN 전용 RPC action으로 정책을 변경한다.

**Tech Stack:** PostgreSQL/Supabase views and RLS, Next.js App Router, TypeScript, 기존 순수 CSS UI.

**Spec:** `docs/superpowers/specs/2026-08-28-step9-inventory-projection-design.md`

## Global Constraints

- React에서 Projection·Risk·Forecast 계산을 하지 않는다.
- 재고·Forecast·Lead Time 누락은 null과 reason code로 표현한다.
- ADMIN만 Lead Time과 Soft Allocation을 변경할 수 있다.
- 기존 route `/analysis/stockout`은 유지한다.

---

### Task 1: DB 정책과 Projection view

- [x] `core.leadtime_policy`, `core.leadtime_policy_history`, `core.soft_allocation`을 추가한다.
- [x] `core.set_leadtime_policy`에 ADMIN 검증과 audit log를 연결한다.
- [x] `analytics.v_leadtime_policy`, `analytics.v_inventory_projection`, `analytics.v_stockout_risk`, `analytics.v_stockout_kpi`를 생성한다.
- [x] Open PO, 확정수주, 가예약을 기간별 component로 결합한다.

### Task 2: 모델과 조회 계층

- [x] `LeadtimePolicy`, `InventoryProjection` 타입과 null-safe normalizer를 추가한다.
- [x] `lib/scm.ts`에 analytics view 조회 함수를 추가한다.

### Task 3: 화면과 관리자 action

- [x] `/admin/scm-policies/lead-time`에 P50/P80/P90, 확정값, Effective 값을 표시한다.
- [x] `/analysis/stockout`을 기간별 Projection 표로 교체한다.
- [x] `lib/menu.ts`에 ADMIN 메뉴를 추가한다.

### Task 4: 검증

- [x] SQL 계약 테스트를 추가한다.
- [x] `npm test`와 `npm run build`를 실행한다.
- [ ] Supabase SQL Editor에서 migration을 실행하고 실제 데이터 10개 케이스를 확인한다.
