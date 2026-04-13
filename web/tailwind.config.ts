import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Cascadia Code', 'monospace'],
      },
      colors: {
        // CT semantic tokens — always use these, never raw Tailwind colors for status
        pass:    'var(--ct-pass)',
        fail:    'var(--ct-fail)',
        flaky:   'var(--ct-flaky)',
        running: 'var(--ct-running)',
        skipped: 'var(--ct-skipped)',
        blocked: 'var(--ct-blocked)',
        // CT surfaces
        'ct-bg':      'var(--ct-bg)',
        'ct-surface': 'var(--ct-surface)',
        'ct-raised':  'var(--ct-surface-raised)',
        'ct-border':  'var(--ct-border)',
      },
      fontSize: {
        'display': ['32px', { lineHeight: '40px', fontWeight: '700', letterSpacing: '-0.02em' }],
        'title':   ['20px', { lineHeight: '28px', fontWeight: '600', letterSpacing: '-0.01em' }],
        'heading': ['16px', { lineHeight: '24px', fontWeight: '600' }],
        'body':    ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'label':   ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'caption': ['11px', { lineHeight: '16px', fontWeight: '400' }],
        'mono':    ['13px', { lineHeight: '20px', fontWeight: '400' }],
      },
      borderRadius: {
        sm: '4px',
        md: '6px',
        lg: '8px',
      },
      height: {
        row: 'var(--ct-row-h)', // 36px — dense table rows
      },
    },
  },
} satisfies Config
