import type { Metadata } from 'next'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: 'continuous.testing — API · UI · AI test management',
  description:
    'The only test platform that runs API, UI, and AI tests in a single unified pipeline. ' +
    'Self-healing selectors, Claude-powered test generation, stateless runner model.',
  openGraph: {
    title: 'continuous.testing',
    description: 'API · UI · AI — unified test management',
    siteName: 'continuous.testing',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
