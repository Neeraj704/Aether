'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
} as const

export function DialogContent({
  className,
  children,
  size = 'md',
  showClose = true,
}: {
  className?: string
  children: React.ReactNode
  size?: keyof typeof SIZES
  showClose?: boolean
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          'fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200',
          'data-[starting-style]:opacity-0 data-[ending-style]:opacity-0',
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          'fixed top-1/2 left-1/2 z-50 w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2',
          'max-h-[calc(100vh-4rem)] overflow-y-auto',
          'glass rounded-[var(--radius-lg)] float-shadow-lg',
          'transition-[transform,opacity,scale] duration-250 ease-[cubic-bezier(0.16,1,0.3,1)]',
          'data-[starting-style]:scale-[0.97] data-[starting-style]:opacity-0',
          'data-[ending-style]:scale-[0.97] data-[ending-style]:opacity-0',
          SIZES[size],
          className,
        )}
      >
        {showClose ? (
          <DialogPrimitive.Close
            className={cn(
              'absolute top-4 right-4 z-10 flex size-7 items-center justify-center rounded-full',
              'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
            )}
            aria-label="Close"
          >
            <X className="size-4" />
          </DialogPrimitive.Close>
        ) : null}
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  )
}

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('flex flex-col gap-1.5 px-6 pt-6 pb-4', className)} {...props} />
}

export function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      className={cn('pr-8 text-lg font-semibold tracking-[-0.015em]', className)}
      {...props}
    />
  )
}

export function DialogDescription({ className, ...props }: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      className={cn('text-[13px] leading-relaxed text-muted-foreground', className)}
      {...props}
    />
  )
}

export function DialogBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-6 py-2', className)} {...props} />
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'flex flex-col-reverse gap-2 px-6 pt-4 pb-6 sm:flex-row sm:justify-end',
        className,
      )}
      {...props}
    />
  )
}
