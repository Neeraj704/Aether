'use client'

import Link from 'next/link'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-primary-foreground hover:bg-brand-hover',
  secondary:
    'bg-secondary text-secondary-foreground hover:bg-muted border border-border backdrop-blur-xl',
  ghost: 'text-brand hover:bg-accent',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-4 text-[13px]',
  md: 'h-11 px-6 text-[15px]',
  lg: 'h-[52px] px-8 text-[17px]',
}

interface BaseProps {
  variant?: Variant
  size?: Size
  className?: string
  children: React.ReactNode
}

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-[var(--radius-pill)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-45'

/** Apple's signature pill CTA. Press scales to 0.97 with no bounce, per §4. */
export function PillLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: BaseProps & { href: string } & React.ComponentProps<typeof Link>) {
  return (
    <motion.span whileTap={{ scale: 0.97 }} className="inline-flex">
      <Link href={href} className={cn(base, VARIANTS[variant], SIZES[size], className)} {...rest}>
        {children}
      </Link>
    </motion.span>
  )
}

export function PillButton({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...rest
}: BaseProps & React.ComponentProps<'button'>) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      className={cn(base, VARIANTS[variant], SIZES[size], className)}
      {...(rest as React.ComponentProps<typeof motion.button>)}
    >
      {children}
    </motion.button>
  )
}
