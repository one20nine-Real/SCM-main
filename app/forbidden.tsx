export default function ForbiddenPage() {
  return (
    <main className="auth-page">
      <section className="ui-panel" aria-labelledby="forbidden-title">
        <p className="eyebrow">ACCESS CONTROL</p>
        <h1 id="forbidden-title">접근 권한이 없습니다</h1>
        <p className="muted">
          계정이 비활성 상태이거나 이 화면에 필요한 권한이 없습니다. 관리자에게 권한을 확인해 주세요.
        </p>
        <a className="button primary" href="/dashboard">대시보드로 이동</a>
      </section>
    </main>
  );
}
