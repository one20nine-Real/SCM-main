# Supabase 연결 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 Next.js 프로토타입에서 Supabase 환경 설정, 서버 클라이언트, health endpoint, 레거시 workflow 격리를 검증하고 필요한 최소 수정을 적용한다.

**Architecture:** `lib/supabase/env.ts`가 공개 환경변수를 검증하고, `lib/supabase/server.ts`가 쿠키 기반 `createServerClient`를 제공한다. `/api/health/supabase`는 비밀 키 없이 환경 설정 상태만 반환하며, 기존 workflow 화면은 `app/(legacy)/workflow/`에서만 노출한다.

**Tech Stack:** Next.js 15 App Router, TypeScript, `@supabase/supabase-js`, `@supabase/ssr`, Node test runner.

**Spec:** 사용자 제공 프롬프트 ⓪ — Supabase 붙이기

## Global Constraints

- `.env.local`은 생성하지 않는다.
- `NEXT_PUBLIC_SUPABASE_URL`과 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`만 클라이언트 공개 환경변수로 사용한다.
- `components/workflow/*`는 수정하지 않는다.
- 오류가 발생하면 `error.md`를 먼저 확인하고 해결 내용으로 업데이트한다.
- 변경 후 `npm run build`를 실행한다.

---

### Task 1: 기존 구현 및 의존성 검증

**Files:**
- Read: `package.json`, `lib/supabase/env.ts`, `lib/supabase/server.ts`, `app/api/health/supabase/route.ts`

- [ ] `npm install`을 실행한다.
- [ ] 기존 Supabase 구현이 요구된 환경변수, 쿠키, 누락 메시지를 제공하는지 확인한다.
- [ ] `npm run build`를 실행하고 실패 시 `error.md` 확인 후 최소 수정한다.

### Task 2: 환경 예시와 health 응답 검증

**Files:**
- Modify: `.env.local.example`
- Verify: `app/api/health/supabase/route.ts`

- [ ] `.env.local.example`을 요청된 5개 변수로 맞춘다.
- [ ] `.env.local`이 생성되지 않았는지 확인한다.
- [ ] 환경변수가 없을 때 health endpoint가 503과 누락 상태를 반환하는지 확인한다.
- [ ] 환경변수가 있을 때 endpoint가 설정 완료 상태를 반환하는지 확인한다.

### Task 3: 최종 검증

**Files:**
- Verify: `app/(legacy)/workflow/page.tsx`

- [ ] `npm run build`를 다시 실행한다.
- [ ] 개발 서버에서 `GET /api/health/supabase`를 호출한다.
- [ ] 최종 상태와 실제 build 및 endpoint 응답을 보고한다.
