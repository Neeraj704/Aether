'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { useSession, toast } from '@/lib/store'
import { Input, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'

export default function LoginPage() {
  const router = useRouter()
  const setAuthed = useSession((s) => s.setAuthed)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthed(true)
    toast.success('Signed in', 'Welcome back to Aether workspace!')
    router.push('/app')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="text-xl font-bold tracking-tight mt-2">Sign in to Aether</h1>
          <p className="text-xs text-muted-foreground">Enter your email below to access your workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email Address">
            <Input type="email" placeholder="arjun@aether.dev" defaultValue="arjun@aether.dev" required />
          </Field>
          <Field label="Password">
            <Input type="password" placeholder="••••••••" defaultValue="password123" required />
          </Field>
          <PillButton type="submit" className="w-full justify-center mt-2">
            Sign In &rarr;
          </PillButton>
        </form>

        <div className="text-center text-xs text-muted-foreground pt-2">
          Don't have an account?{' '}
          <Link href="/signup" className="text-brand font-semibold hover:underline">
            Sign up free
          </Link>
        </div>
      </div>
    </div>
  )
}
