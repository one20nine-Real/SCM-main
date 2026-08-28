export function isSafeNextPath(nextPath: string | null | undefined) {
  return Boolean(nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') && !nextPath.includes('://'));
}

export function canChangeOwnAccount({ actorId, targetId }: { actorId: string; targetId: string; role: 'ADMIN' | 'USER'; active: boolean }) {
  return actorId !== targetId;
}
