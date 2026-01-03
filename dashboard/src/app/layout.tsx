import type { Metadata } from 'next'
import { ReactNode } from 'react'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'The Things Stack on Azure — Dashboard',
  description: 'Architecture overview and real-time placeholders for Fabric RTI and Digital Twins.',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
