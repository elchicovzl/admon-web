import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/components/dashboard/session-provider'

/**
 * Every route under /dashboard is already dynamic in practice — `auth()`
 * below reads cookies. Declaring it makes that explicit and, more to the
 * point, guarantees it: `AppSidebar` calls `useSearchParams()` (to tell
 * "Cobros" from "Pagos", which share a path and differ only by `?type=`),
 * and Next fails the BUILD on that hook if it ever tries to prerender a
 * route in this segment statically.
 */
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  return (
    <SessionProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <AppSidebar user={session.user} />
          <div className="flex flex-1 flex-col min-w-0">
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto p-6 min-w-0">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </SessionProvider>
  )
}
