import { RouteGuard } from '@/components/RouteGuard'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <RouteGuard>
      {children}
      {/* Persistent Nivo branding — fixed bottom-left on all sub-pages */}
      <div className="fixed bottom-5 right-5 z-40 pointer-events-none select-none">
        <span className="text-xs uppercase tracking-widest text-gray-400 font-medium">
          by Nivo
        </span>
      </div>
    </RouteGuard>
  )
}
