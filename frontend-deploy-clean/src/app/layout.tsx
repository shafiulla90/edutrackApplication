import type { Metadata } from 'next';
import { TenantProvider } from './providers/TenantContext';
import { ThemeProvider } from './providers/ThemeContext';
import { ToastProvider } from '@/components/Toast';
import './globals.css';

export const metadata: Metadata = {
  title: 'EduTrack SaaS Platform',
  description: 'Independent Multi-Tenant School & College Management Platform',
};

import CapacitorAppListener from '@/components/CapacitorAppListener';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('edutrack-theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <TenantProvider>
            <ToastProvider>
              <CapacitorAppListener />
              {children}
            </ToastProvider>
          </TenantProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

