import Link from 'next/link'
import { cn } from '@/lib/utils'

/**
 * A three-node flow glyph on a flat neutral tile  the mark reads as "a
 * small pipeline" rather than a decorative blob, and only uses accent color
 * on the three node dots.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 28 28"
      className={cn('block size-7 shrink-0', className)}
    >
      <rect x="0.75" y="0.75" width="26.5" height="26.5" rx="8" className="fill-secondary" stroke="var(--border)" strokeWidth="1" />
      <path
        d="M8.4 18.6 14 9.2l5.6 9.4"
        fill="none"
        stroke="var(--foreground)"
        strokeOpacity="0.82"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M10.7 15.1h6.6" fill="none" stroke="var(--foreground)" strokeOpacity="0.4" strokeWidth="1.3" strokeLinecap="round" />
      <circle cx="8.4" cy="18.6" r="2" fill="#2997ff" />
      <circle cx="14" cy="9.2" r="2" fill="#00b8c4" />
      <circle cx="19.6" cy="18.6" r="2" fill="#ff6ac1" />
    </svg>
  )
}

export function Logo({
  href = '/',
  className,
  showWord = true,
}: {
  href?: string
  className?: string
  showWord?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn('flex items-center gap-2 rounded-[10px] transition-opacity hover:opacity-80', className)}
    >
      <LogoMark />
      {showWord && (
        <span className="text-[17px] font-semibold tracking-[-0.02em]">
          Aether
          <span className="sr-only">  home</span>
        </span>
      )}
    </Link>
  )
}
