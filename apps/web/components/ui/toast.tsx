'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, Info, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useToasts, type Toast, type ToastKind } from '@/lib/store'
import { cn, EASE_AETHER } from '@/lib/utils'

const ICONS: Record<ToastKind, typeof Info> = {
  success: CheckCircle2,
  error: TriangleAlert,
  info: Info,
  warn: TriangleAlert,
  unlock: Sparkles,
}

const ACCENTS: Record<ToastKind, string> = {
  success: 'text-profit',
  error: 'text-loss',
  info: 'text-brand',
  warn: 'text-amber-400',
  unlock: 'text-gold',
}

function ToastCard({ toast }: { toast: Toast }) {
  const dismiss = useToasts((s) => s.dismiss)
  const Icon = ICONS[toast.kind]

  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: 24, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 24, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ duration: 0.32, ease: EASE_AETHER }}
      className="glass pointer-events-auto relative w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-[var(--radius-md)] p-4"
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('mt-0.5 size-5 shrink-0', ACCENTS[toast.kind])} strokeWidth={1.5} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold leading-5">{toast.title}</p>
          {toast.description && (
            <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{toast.description}</p>
          )}
          {toast.action && (
            <Link
              href={toast.action.href}
              onClick={() => dismiss(toast.id)}
              className="mt-2 inline-block text-[13px] font-medium text-brand hover:underline"
            >
              {toast.action.label}
            </Link>
          )}
        </div>
        <button
          type="button"
          onClick={() => dismiss(toast.id)}
          aria-label="Dismiss notification"
          className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" strokeWidth={1.5} />
        </button>
      </div>

      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: toast.duration / 1000, ease: 'linear' }}
        onAnimationComplete={() => dismiss(toast.id)}
        style={{ transformOrigin: 'left' }}
        className={cn('absolute inset-x-0 bottom-0 h-px', {
          'bg-profit': toast.kind === 'success',
          'bg-loss': toast.kind === 'error',
          'bg-brand': toast.kind === 'info',
          'bg-gold': toast.kind === 'unlock',
        })}
      />
    </motion.li>
  )
}

export function ToastViewport() {
  const toasts = useToasts((s) => s.toasts)

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex justify-end sm:bottom-6 sm:right-6"
    >
      <ul className="flex flex-col items-end gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <ToastCard key={t.id} toast={t} />
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
