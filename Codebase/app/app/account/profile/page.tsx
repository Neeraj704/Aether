'use client'

import { useState } from 'react'
import { User, Check, Sparkles, Shield, Save } from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { AccountNav } from '@/components/account/account-nav'
import { PillButton } from '@/components/ui/pill-button'
import { Input, Textarea, Field } from '@/components/ui/input'
import { CheckboxRow } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

const AVATAR_COLORS = [
  '#2997ff', // Brand Blue
  '#00b8c4', // Cyan
  '#ff6ac1', // Pink
  '#ff9f0a', // Orange / Gold
  '#30d158', // Green
  '#bf5af2', // Purple
]

export default function AccountProfilePage() {
  const profile = useSession((s) => s.profile)
  const updateProfile = useSession((s) => s.updateProfile)

  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [bio, setBio] = useState(profile.bio || '')
  const [publicProfile, setPublicProfile] = useState(profile.publicProfile ?? true)
  const [avatarColor, setAvatarColor] = useState(profile.avatarColor || AVATAR_COLORS[0])

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    updateProfile({
      name: name.trim(),
      email: email.trim(),
      bio: bio.trim(),
      publicProfile,
      avatarColor,
    })
    toast.success('Profile Saved', 'Your account profile has been updated.')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage your personal identity, login credentials, and public trader profile
        </p>
      </div>

      <AccountNav />

      {/* Form */}
      <form onSubmit={handleSave} className="flex flex-col gap-6">
        {/* Avatar Card */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div
              style={{ backgroundColor: avatarColor }}
              className="flex size-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-md transition-colors"
            >
              {profile.initials || name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-bold">Avatar Color & Initials</h2>
              <p className="text-xs text-muted-foreground">
                Displayed across your published presets, comment threads, and activity logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setAvatarColor(c)}
                style={{ backgroundColor: c }}
                className={cn(
                  'size-7 rounded-full transition-transform cursor-pointer flex items-center justify-center',
                  avatarColor === c ? 'scale-115 ring-2 ring-foreground shadow-md' : 'opacity-80 hover:opacity-100',
                )}
              >
                {avatarColor === c && <Check className="size-3.5 text-white" />}
              </button>
            ))}
          </div>
        </div>

        {/* Profile Info */}
        <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-5">
          <h2 className="text-base font-bold">Personal Information</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Full Name" htmlFor="name">
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Neeraj Sharma"
                required
              />
            </Field>

            <Field label="Email Address" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="arjun@aether.dev"
                required
              />
            </Field>
          </div>

          <Field label="Bio & Quantitative Background" htmlFor="bio">
            <Textarea
              id="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Systematic trader focusing on statistical arbitrage, options order flow, and volatility forecasting."
            />
          </Field>

          <div className="pt-2 border-t border-border">
            <CheckboxRow
              label="Public Trader Profile"
              description="Allow other researchers to view your public profile, ratings, and shared presets."
              checked={publicProfile}
              onCheckedChange={(checked) => setPublicProfile(Boolean(checked))}
            />
          </div>
        </div>

        <div className="flex justify-end">
          <PillButton type="submit" size="lg" className="gap-2 shadow-lg shadow-brand/20">
            <Save className="size-4" /> Save Profile Changes
          </PillButton>
        </div>
      </form>
    </div>
  )
}
