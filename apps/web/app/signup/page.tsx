'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { createClient } from '@/lib/supabase/client'
import { Input, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { MailCheck } from 'lucide-react'

export default function SignupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      setIsSuccess(true)
    } catch (err: any) {
      setErrorMsg(err?.message || 'An unexpected error occurred.')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) {
        setErrorMsg(error.message)
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google sign-up failed')
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          {isSuccess ? (
            <>
              <div className="mt-2 flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
                <MailCheck className="size-6" />
              </div>
              <h1 className="text-xl font-bold tracking-tight mt-1">Check your email</h1>
              <p className="text-xs text-muted-foreground leading-relaxed">
                We&apos;ve sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click the link to activate your account.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold tracking-tight mt-2">Create your Aether Account</h1>
              <p className="text-xs text-muted-foreground">Start building visual trading bots in seconds</p>
            </>
          )}
        </div>

        {isSuccess ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-xs text-muted-foreground">
              Once confirmed, you can proceed to sign in to your workspace.
            </p>
            <Link href="/login" className="text-brand font-semibold hover:underline text-xs">
              Go to Sign In &rarr;
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {errorMsg && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
                  {errorMsg}
                </div>
              )}
              <Field label="Full Name">
                <Input
                  placeholder="Neeraj Sharma"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </Field>
              <Field label="Email Address">
                <Input
                  type="email"
                  placeholder="arjun@aether.dev"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </Field>
              <Field label="Password">
                <Input
                  type="password"
                  placeholder="Create a strong password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </Field>
              <PillButton type="submit" disabled={loading} className="w-full justify-center mt-2">
                {loading ? 'Creating Account...' : 'Create Free Account \u2192'}
              </PillButton>
            </form>

            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-2 text-[11px] text-muted-foreground uppercase tracking-wider">
                Or continue with
              </span>
            </div>

            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center gap-2 rounded-full border border-border bg-secondary/50 py-2.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
            >
              <svg className="size-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Google
            </button>
          </>
        )}

        <div className="text-center text-xs text-muted-foreground pt-2">
          Already have an account?{' '}
          <Link href="/login" className="text-brand font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
