import { RouteGuard } from '@/components/RouteGuard';
import { NivoBadge } from '@/components/ui/NivoBadge';
import { CursorGlow } from '@/components/ui/CursorGlow';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div style={{ background: '#080810', minHeight: '100vh', position: 'relative' }} className="w-full">
        {children}
      </div>
      <CursorGlow color="rgba(124,92,252,0.15)" size={600} />
      <NivoBadge />
    </RouteGuard>
  );
}
