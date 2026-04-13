'use client'

import { useEffect, useState } from 'react'

type Theme = 'dark' | 'light' | 'system'

const ICONS: Record<Theme, string> = {
  dark:   '🌙',
  light:  '☀️',
  system: '💻',
}

function resolveTheme(t: Theme): 'dark' | 'light' {
  if (t !== 'system') return t
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const saved = (localStorage.getItem('ct-theme') as Theme) ?? 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', resolveTheme(saved))
  }, [])

  function cycle() {
    const order: Theme[] = ['dark', 'light', 'system']
    const next = order[(order.indexOf(theme) + 1) % order.length]!
    setTheme(next)
    localStorage.setItem('ct-theme', next)
    document.documentElement.setAttribute('data-theme', resolveTheme(next))
  }

  return (
    <button
      onClick={cycle}
      title={`Theme: ${theme}`}
      className="flex items-center justify-center w-7 h-7 rounded-md text-sm transition-colors hover:bg-[var(--ct-surface-raised)]"
      aria-label={`Switch theme, current: ${theme}`}
    >
      {ICONS[theme]}
    </button>
  )
}
