'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/brand/logo'
import { useSession, toast } from '@/lib/store'
import { Input, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'

export default function SignupPage() {
  const router = useRouter()
  const setAuthed = useSession((s) => s.setAuthed)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setAuthed(true)
    toast.success('Account created!', 'Welcome to Aether quants.')
    router.push('/app')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md flex flex-col gap-6 rounded-2xl border border-border bg-card p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <Logo />
          <h1 className="text-xl font-bold tracking-tight mt-2">Create your Aether Account</h1>
          <p className="text-xs text-muted-foreground">Start building visual trading bots in seconds</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Full Name">
            <Input placeholder="Arjun Mehta" required />
          </Field>
          <Field label="Email Address">
            <Input type="email" placeholder="arjun@aether.dev" required />
          </Field>
          <Field label="Password">
            <Input type="password" placeholder="Create a strong password" required />
          </Field>
          <PillButton type="submit" className="w-full justify-center mt-2">
            Create Free Account &rarr;
          </PillButton>
        </form>

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
