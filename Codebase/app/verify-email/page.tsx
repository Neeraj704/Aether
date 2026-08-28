'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { toast } from '@/lib/store'
import { PillLink } from '@/components/ui/pill-button'
import { EmptyState } from '@/components/ui/empty-state'
import { CheckCircle2, Mail, AlertTriangle } from 'lucide-react'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const handleResend = () => {
    toast.info('Verification email sent', 'Check your inbox for a fresh confirmation link.')
  }

  // Missing token state
  if (!token) {
    return (
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>
        <EmptyState
          icon={Mail}
          title="Missing verification link"
          description="We couldn't find a valid email verification token. Please click the confirmation link sent to your registered email address."
          action={{
            label: 'Resend verification email',
            onClick: handleResend,
          }}
          secondary={
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Back to login
            </Link>
          }
          className="py-4"
        />
      </div>
    )
  }

  // Explicit expired token case
  if (token === 'expired') {
    return (
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>
        <EmptyState
          icon={AlertTriangle}
          title="Verification link expired"
          description="This verification link has expired. Please request a new verification email to confirm your account."
          action={{
            label: 'Resend verification email',
            onClick: handleResend,
          }}
          secondary={
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Back to login
            </Link>
          }
          className="py-4"
        />
      </div>
    )
  }

  // Success state with valid token
  return (
    <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo />
        <div className="mt-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight mt-2">Email verified successfully</h1>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Your email address has been verified. You&apos;re now ready to start assembling layers, backtesting, and paper trading.
        </p>
      </div>

      <div className="flex flex-col gap-4 mt-2">
        <PillLink href="/app" className="w-full justify-center">
          Continue to dashboard &rarr;
        </PillLink>

        <div className="text-center text-xs text-muted-foreground">
          Need help getting started?{' '}
          <Link href="/docs" className="text-brand font-semibold hover:underline">
            Read documentation
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function VerifyEmailPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl flex items-center justify-center min-h-[300px]">
            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        }
      >
        <VerifyEmailContent />
      </Suspense>
    </div>
  )
}
