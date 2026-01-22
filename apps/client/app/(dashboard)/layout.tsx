import { RouteGuard } from '@/components/RouteGuard';
import { NivoBadge } from '@/components/ui/NivoBadge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      {children}
      <NivoBadge />
    </RouteGuard>
  );
}
