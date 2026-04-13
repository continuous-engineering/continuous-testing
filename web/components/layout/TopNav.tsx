import { UserButton, OrganizationSwitcher } from '@clerk/nextjs'
import { ThemeToggle } from './ThemeToggle'

export function TopNav() {
  return (
    <header
      className="flex items-center justify-between h-row px-4 border-b flex-shrink-0"
      style={{ background: 'var(--ct-surface)', borderColor: 'var(--ct-border)' }}
    >
      <OrganizationSwitcher
        hidePersonal
        appearance={{
          elements: {
            organizationSwitcherTrigger: {
              fontSize: '13px',
              color: 'var(--ct-text-1)',
              padding: '4px 8px',
              borderRadius: '6px',
            },
          },
        }}
      />
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserButton afterSignOutUrl="/login" />
      </div>
    </header>
  )
}
