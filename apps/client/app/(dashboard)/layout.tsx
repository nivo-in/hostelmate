import { RouteGuard } from '@/components/RouteGuard';
import { NivoBadge } from '@/components/ui/NivoBadge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div style={{ background: '#080810', minHeight: '100vh', position: 'relative' }} className="w-full">
        {children}
      </div>
      <NivoBadge />
    </RouteGuard>
  );
}
