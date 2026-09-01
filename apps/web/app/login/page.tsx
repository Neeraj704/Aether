'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/store'
import { Input, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectPath = searchParams.get('redirect') || '/app'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        setErrorMsg(error.message)
        return
      }

      toast.success('Signed in', 'Welcome back to Aether workspace!')
      router.push(redirectPath)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to sign in')
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
      setErrorMsg(err?.message || 'Google sign-in failed')
    }
  }

  return (
    <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo />
        <h1 className="text-xl font-bold tracking-tight mt-2">Sign in to Aether</h1>
        <p className="text-xs text-muted-foreground">Enter your email below to access your workspace</p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-400">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="Email Address">
          <Input
            type="email"
            placeholder="arjun@aether.dev"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </Field>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-[13px] font-medium text-foreground">Password</label>
            <Link href="/forgot-password" className="text-xs text-brand font-medium hover:underline">
              Forgot password?
            </Link>
          </div>
          <Input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <PillButton type="submit" disabled={loading} className="w-full justify-center mt-2">
          {loading ? 'Signing In...' : 'Sign In \u2192'}
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

      <div className="text-center text-xs text-muted-foreground pt-1">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-brand font-semibold hover:underline">
          Sign up free
        </Link>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <Suspense
        fallback={
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-2xl flex items-center justify-center min-h-[300px]">
            <div className="size-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        }
      >
        <LoginContent />
      </Suspense>
    </div>
  )
}
