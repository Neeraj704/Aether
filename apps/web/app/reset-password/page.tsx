'use client'

import { Suspense, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/store'
import { Input, Field } from '@/components/ui/input'
import { PillButton, PillLink } from '@/components/ui/pill-button'
import { KeyRound, CheckCircle2 } from 'lucide-react'

function ResetPasswordContent() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setDone(true)
      toast.success('Password updated', 'You can now sign in with your new password.')
    } catch (err: any) {
      setError(err?.message || 'Failed to update password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo />
        {done ? (
          <>
            <div className="mt-2 flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="size-6" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mt-1">Password reset complete</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your password has been successfully updated. You can now use your new password to sign in.
            </p>
          </>
        ) : (
          <>
            <div className="mt-2 flex size-10 items-center justify-center rounded-full bg-brand/10 text-brand">
              <KeyRound className="size-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight mt-1">Set new password</h1>
            <p className="text-xs text-muted-foreground">
              Please enter and confirm your new password below.
            </p>
          </>
        )}
      </div>

      {done ? (
        <div className="flex flex-col gap-4">
          <PillLink href="/login" className="w-full justify-center">
            Continue to login &rarr;
          </PillLink>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="New password">
            <Input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
              required
              autoFocus
            />
          </Field>

          <Field label="Confirm new password" error={error}>
            <Input
              type="password"
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value)
                if (error) setError('')
              }}
              required
            />
          </Field>

          <PillButton type="submit" disabled={loading} className="w-full justify-center mt-2">
            {loading ? 'Updating password...' : 'Reset password \u2192'}
          </PillButton>

          <div className="text-center text-xs text-muted-foreground pt-2">
            <Link href="/login" className="text-brand font-semibold hover:underline">
              Back to login
            </Link>
          </div>
        </form>
      )}
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl flex items-center justify-center min-h-[300px]">
            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        }
      >
        <ResetPasswordContent />
      </Suspense>
    </div>
  )
}
