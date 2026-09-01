'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/store'
import { PillLink, PillButton } from '@/components/ui/pill-button'
import { Input, Field } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { CheckCircle2, Mail, AlertTriangle } from 'lucide-react'

function VerifyEmailContent() {
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const [resendEmail, setResendEmail] = useState('')
  const [resending, setResending] = useState(false)

  useEffect(() => {
    async function checkSession() {
      try {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          setVerified(true)
        } else {
          setVerified(false)
        }
      } catch {
        setVerified(false)
      } finally {
        setLoading(false)
      }
    }
    checkSession()
  }, [])

  const handleResend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!resendEmail.trim()) {
      toast.error('Email required', 'Please enter your email to resend confirmation.')
      return
    }

    setResending(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: resendEmail.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/verify-email`,
        },
      })
      if (error) {
        toast.error('Resend failed', error.message)
      } else {
        toast.info('Verification email sent', 'Check your inbox for a fresh confirmation link.')
      }
    } catch (err: any) {
      toast.error('Error', err?.message || 'Failed to resend confirmation')
    } finally {
      setResending(false)
    }
  }

  if (loading) {
    return (
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl flex items-center justify-center min-h-[300px]">
        <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  if (!verified) {
    return (
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex justify-center">
          <Logo />
        </div>
        <EmptyState
          icon={Mail}
          title="Verification link expired or pending"
          description="We could not detect an active session. If your confirmation link has expired or you haven't received one, request a fresh email below."
          secondary={
            <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground">
              Back to login
            </Link>
          }
          className="py-4"
        />

        <form onSubmit={handleResend} className="flex flex-col gap-3">
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="arjun@aether.dev"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              required
            />
          </Field>
          <PillButton type="submit" disabled={resending} className="w-full justify-center">
            {resending ? 'Sending...' : 'Resend verification email'}
          </PillButton>
        </form>
      </div>
    )
  }

  // Success state with verified session
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
