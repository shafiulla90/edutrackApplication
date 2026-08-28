'use client';

import { useEffect } from 'react';
import { App as CapApp } from '@capacitor/app';
import { usePathname, useRouter } from 'next/navigation';

export default function CapacitorAppListener() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let listener: any;

    const setupBackListener = async () => {
      try {
        listener = await CapApp.addListener('backButton', () => {
          // 1. If any modal is open, trigger close
          const modalCloseBtn = document.querySelector('[data-close-modal="true"]') as HTMLButtonElement;
          if (modalCloseBtn) {
            modalCloseBtn.click();
            return;
          }

          // 2. If drawer/sidebar is open on mobile, close drawer
          const drawerCloseBtn = document.querySelector('[data-close-drawer="true"]') as HTMLButtonElement;
          if (drawerCloseBtn) {
            drawerCloseBtn.click();
            return;
          }

          // 3. Router navigation back if on nested route
          if (pathname !== '/dashboard' && pathname !== '/auth/login' && pathname !== '/') {
            router.back();
          } else {
            // Exit/minimize app on root home screen
            CapApp.minimizeApp();
          }
        });
      } catch {
        // Ignored on standard web browsers
      }
    };

    setupBackListener();

    return () => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    };
  }, [pathname, router]);

  return null;
}
