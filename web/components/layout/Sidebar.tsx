'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  badge?: number
}

type NavSection = {
  title: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { label: 'Dashboard',   href: '/' },
      { label: 'Flaky Tests', href: '/flaky' },
    ],
  },
  {
    title: 'Testing',
    items: [
      { label: 'Projects',   href: '/projects' },
      { label: 'Pipelines',  href: '/pipelines' },
      { label: 'Runs',       href: '/runs' },
      { label: 'Datasets',   href: '/datasets' },
      { label: 'Coverage',   href: '/coverage' },
    ],
  },
  {
    title: 'Import',
    items: [
      { label: 'API Spec / OpenAPI', href: '/import' },
    ],
  },
  {
    title: 'Issues',
    items: [
      { label: 'Issues',     href: '/issues' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { label: 'Runners',      href: '/settings/runners' },
      { label: 'Secrets',      href: '/settings/secrets' },
      { label: 'Environments', href: '/settings/environments' },
      { label: 'Integrations', href: '/settings/integrations' },
      { label: 'Team',         href: '/settings/team' },
    ],
  },
]

export function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname()
  const base = projectId ? `/projects/${projectId}` : ''

  return (
    <nav
      className="flex flex-col w-52 flex-shrink-0 border-r h-full overflow-y-auto"
      style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)' }}
    >
      {/* Logo */}
      <div
        className="flex items-center h-row px-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--ct-border)' }}
      >
        <span className="text-label font-semibold" style={{ color: 'var(--ct-accent-500)' }}>
          continuous.testing
        </span>
      </div>

      {/* Nav sections */}
      <div className="flex flex-col gap-4 py-3 flex-1">
        {NAV.map((section) => (
          <div key={section.title}>
            <div
              className="text-caption uppercase tracking-widest px-3 mb-1"
              style={{ color: 'var(--ct-text-3)' }}
            >
              {section.title}
            </div>
            {section.items.map((item) => {
              const href = `${base}${item.href}`
              const active = pathname === href || (item.href !== '/' && pathname.startsWith(href))
              return (
                <Link
                  key={item.href}
                  href={href}
                  className={cn(
                    'ct-row text-body justify-between px-3 border-0',
                    active
                      ? 'text-[var(--ct-accent-400)] bg-[var(--ct-surface-raised)]'
                      : 'text-[var(--ct-text-2)] hover:text-[var(--ct-text-1)]',
                  )}
                >
                  {item.label}
                  {item.badge != null && item.badge > 0 && (
                    <span
                      className="text-caption px-1.5 py-0.5 rounded-full"
                      style={{ background: 'var(--ct-fail)', color: '#fff' }}
                    >
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </div>
    </nav>
  )
}
