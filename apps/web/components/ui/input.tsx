import { cn } from '@/lib/utils'

const field =
  'w-full rounded-[var(--radius-sm)] border border-input bg-card px-3 text-sm text-foreground transition-[border-color,box-shadow] outline-none placeholder:text-tertiary focus-visible:border-brand focus-visible:ring-3 focus-visible:ring-brand/20 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20'

export function Input({ className, type = 'text', ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      data-slot="input"
      type={type}
      className={cn(field, 'h-9', type === 'number' && 'tabular', className)}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(field, 'min-h-20 resize-y py-2 leading-relaxed', className)}
      {...props}
    />
  )
}

export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn('text-[13px] font-medium text-foreground', className)}
      {...props}
    />
  )
}

/** Label + control + help/error text, the standard stacked form row. */
export function Field({
  label,
  help,
  error,
  htmlFor,
  className,
  children,
}: {
  label?: string
  help?: string
  error?: string
  htmlFor?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : help ? (
        <p className="text-xs leading-relaxed text-tertiary">{help}</p>
      ) : null}
    </div>
  )
}

export { field as fieldClassName }
