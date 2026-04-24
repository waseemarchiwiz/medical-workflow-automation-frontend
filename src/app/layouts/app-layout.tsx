import { Link, NavLink, Outlet } from 'react-router-dom'

import { appRoutes } from '@/app/routes/paths'
import { buttonVariants } from '@/shared/components/ui/button.styles'
import { appConfig } from '@/shared/config/app.config'
import { cn } from '@/shared/lib/utils'

function AppLayout() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden">
      <div className="absolute left-[-8%] top-[-6%] h-72 w-72 rounded-full bg-[rgba(15,118,110,0.14)] blur-3xl" />
      <div className="absolute bottom-0 right-[-10%] h-80 w-80 rounded-full bg-[rgba(201,108,49,0.16)] blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-10 lg:py-8">
        <header className="rounded-full border border-white/50 bg-white/55 px-4 py-3 shadow-[var(--shadow)] backdrop-blur-xl sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Link className="inline-flex items-center gap-3 text-[var(--foreground)]" to={appRoutes.workflow}>
              <span className="rounded-full bg-[rgba(15,118,110,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--primary)]">
                NeuroICU
              </span>
              <span className="text-sm font-semibold tracking-[0.08em] uppercase text-[var(--muted)]">
                {appConfig.title}
              </span>
            </Link>

            <nav className="flex flex-wrap gap-2">
              <NavLink
                className={({ isActive }) =>
                  cn(
                    buttonVariants({
                      size: 'sm',
                      variant: isActive ? 'default' : 'ghost',
                    }),
                    'rounded-full px-4',
                  )
                }
                to={appRoutes.workflow}
              >
                Workflow
              </NavLink>
            </nav>
          </div>
        </header>

        <main className="flex-1 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export { AppLayout }
