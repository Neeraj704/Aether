import type { Metadata } from 'next'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AppSidebar, MobileTabBar } from '@/components/app/app-sidebar'
import { AppTopbar } from '@/components/app/app-topbar'
import { CommandPalette } from '@/components/app/command-palette'

export const metadata: Metadata = {
  title: 'Workspace',
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <div className="flex min-h-dvh">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AppTopbar />
          <main className="flex-1 pb-20 lg:pb-0">{children}</main>
        </div>
      </div>
      <MobileTabBar />
      <CommandPalette />
    </TooltipProvider>
  )
}
