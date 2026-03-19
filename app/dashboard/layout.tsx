import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth/auth'
import { SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/dashboard/app-sidebar'
import { DashboardHeader } from '@/components/dashboard/dashboard-header'
import { Toaster } from '@/components/ui/sonner'
import { SessionProvider } from '@/components/dashboard/session-provider'

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
          <div className="flex flex-1 flex-col">
            <DashboardHeader />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </SessionProvider>
  )
}
