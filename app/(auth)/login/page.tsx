import Link from 'next/link';
import Panel from '@/components/ui/panel';
export default function LoginPage() {
  return <main className="auth-page"><Panel title="월간 발주계획 로그인" description="프로토타입에서는 사용자 메뉴로 이동합니다."><Link className="button primary" href="/dashboard">대시보드로 이동</Link></Panel></main>;
}
