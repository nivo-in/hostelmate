import { RouteGuard } from '@/components/RouteGuard';
import { NivoBadge } from '@/components/ui/NivoBadge';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RouteGuard>
      <div className="min-h-screen bg-white w-full">
        {children}
      </div>
      <NivoBadge />
    </RouteGuard>
  );
}
