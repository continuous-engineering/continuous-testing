import type { Metadata, Viewport } from 'next'
import '@/styles/globals.css'

export const viewport: Viewport = { themeColor: '#09090f', colorScheme: 'dark' }

export const metadata: Metadata = {
  metadataBase: new URL('https://testing.continuous.engineering'),
  title: { default: 'continuous.testing — API · UI · AI test management', template: '%s — continuous.testing' },
  description: 'The only test platform that runs API, UI, and AI tests in a single unified pipeline. Self-healing selectors. Claude-powered test generation from your codebase.',
  openGraph: { title: 'continuous.testing', description: 'API · UI · AI — unified test management', siteName: 'continuous.testing', type: 'website' },
  twitter: { card: 'summary_large_image', title: 'continuous.testing', description: 'API · UI · AI — unified test management' },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ colorScheme: 'dark' }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  )
}
