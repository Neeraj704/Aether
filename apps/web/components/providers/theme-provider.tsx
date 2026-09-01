'use client'

import { useEffect } from 'react'
import { useSession } from '@/lib/store'

/**
 * Applies the persisted theme choice to <html>. `system` follows the OS and
 * keeps following it live, so a user who never picks a theme tracks their Mac's
 * appearance setting the way an Apple app would.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSession((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const mq = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && mq.matches)
      root.classList.toggle('dark', dark)
      root.style.colorScheme = dark ? 'dark' : 'light'
    }

    apply()
    if (theme !== 'system') return

    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  return <>{children}</>
}

/**
 * Runs before paint so the first frame is already the right theme  otherwise
 * a dark-mode user sees a white flash while the store rehydrates.
 */
export function ThemeScript() {
  const js = `
(function(){
  try {
    var raw = localStorage.getItem('aether.session');
    var theme = raw ? (JSON.parse(raw).state || {}).theme : 'system';
    if (!theme) theme = 'system';
    var dark = theme === 'dark' || (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    }
  } catch (e) {}
})();`

  return <script dangerouslySetInnerHTML={{ __html: js }} suppressHydrationWarning />
}
