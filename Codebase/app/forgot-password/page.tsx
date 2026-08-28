'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { toast } from '@/lib/store'
import { Input, Field } from '@/components/ui/input'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { MailCheck, ArrowLeft } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [state, setState] = useState<'form' | 'sent'>('form')
  const [email, setEmail] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setState('sent')
    toast.success('Reset link sent', 'Check your inbox for further instructions.')
  }

  const handleResend = () => {
    toast.info('Reset link resent', 'A fresh reset link has been sent to your email.')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          {state === 'form' ? (
            <>
              <h1 className="text-xl font-bold tracking-tight mt-2">Reset your password</h1>
              <p className="text-xs text-muted-foreground">
                Enter your email below and we'll send you a link to reset your password.
              </p>
            </>
          ) : (
            <>
              <div className="mt-2 flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <MailCheck className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-1">Check your email</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If an account exists for <span className="font-medium text-foreground">{email}</span>, we&apos;ve sent a link to reset your password.
              </p>
            </>
          )}
        </div>

        {state === 'form' ? (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Email Address">
              <Input
                type="email"
                placeholder="arjun@aether.dev"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </Field>

            <PillButton type="submit" className="w-full justify-center mt-2">
              Send reset link &rarr;
            </PillButton>

            <div className="text-center text-xs text-muted-foreground pt-2">
              Remember your password?{' '}
              <Link href="/login" className="text-brand font-semibold hover:underline">
                Sign in
              </Link>
            </div>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <PillLink href="/login" variant="secondary" className="w-full justify-center">
              <ArrowLeft className="size-4" />
              <span>Back to login</span>
            </PillLink>

            <div className="text-center text-xs text-muted-foreground pt-2">
              Didn&apos;t get the email?{' '}
              <button
                type="button"
                onClick={handleResend}
                className="text-brand font-semibold hover:underline"
              >
                Click to resend
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
