import test from 'node:test';
import assert from 'node:assert/strict';
import { isSafeNextPath, canChangeOwnAccount } from './auth-policy.ts';

test('next는 같은 사이트의 상대 경로만 허용한다', () => {
  assert.equal(isSafeNextPath('/analysis/stockout'), true);
  assert.equal(isSafeNextPath('/dashboard?tab=all'), true);
  assert.equal(isSafeNextPath('https://evil.example/login'), false);
  assert.equal(isSafeNextPath('//evil.example/login'), false);
});

test('관리자는 자신의 role과 active 상태를 스스로 바꿀 수 없다', () => {
  assert.equal(canChangeOwnAccount({ actorId: 'u1', targetId: 'u1', role: 'USER', active: true }), false);
  assert.equal(canChangeOwnAccount({ actorId: 'u1', targetId: 'u2', role: 'ADMIN', active: false }), true);
});
