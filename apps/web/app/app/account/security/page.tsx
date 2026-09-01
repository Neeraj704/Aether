'use client'

import { useState } from 'react'
import { Shield, Laptop, Key, Smartphone } from 'lucide-react'
import { SESSIONS } from '@/mock/data'
import { toast } from '@/lib/store'
import { AccountNav } from '@/components/account/account-nav'
import { PillButton } from '@/components/ui/pill-button'
import { Input, Field } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export default function AccountSecurityPage() {
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')

  const [twoFactorEnabled, setTwoFactorEnabled] = useState(true)
  const [sessions, setSessions] = useState(SESSIONS)

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== confirmPw) {
      toast.error('Passwords do not match', 'Please verify your new password.')
      return
    }
    toast.success('Password Updated', 'Your account password was successfully changed.')
    setCurrentPw('')
    setNewPw('')
    setConfirmPw('')
  }

  const handleRevokeSession = (sessionId: string) => {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    toast.success('Session Revoked', 'Device has been signed out.')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage your authentication credentials, multi-factor security, and active device sessions
        </p>
      </div>

      <AccountNav />

      {/* Change Password Form */}
      <form onSubmit={handleChangePassword} className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Key className="size-4 text-brand" /> Change Password
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Current Password" htmlFor="curr-pw">
            <Input
              id="curr-pw"
              type="password"
              value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
          <Field label="New Password" htmlFor="new-pw">
            <Input
              id="new-pw"
              type="password"
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
          <Field label="Confirm New Password" htmlFor="conf-pw">
            <Input
              id="conf-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••••"
              required
            />
          </Field>
        </div>

        <div className="flex justify-end pt-2">
          <PillButton type="submit" size="sm">
            Update Password
          </PillButton>
        </div>
      </form>

      {/* Two-Factor Authentication Card */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-bold flex items-center gap-2">
              <Shield className="size-4 text-profit" /> Two-Factor Authentication (2FA)
            </h2>
            <p className="text-xs text-muted-foreground max-w-xl leading-relaxed">
              Require a time-based one-time password (TOTP) from an authenticator app like Google Authenticator or 1Password when signing in from unrecognized devices.
            </p>
          </div>

          <Badge variant={twoFactorEnabled ? 'profit' : 'neutral'} size="md">
            {twoFactorEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>

        <div className="pt-2 border-t border-border flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-medium">
            Authenticator App (TOTP)
          </span>
          <PillButton
            variant={twoFactorEnabled ? 'secondary' : 'primary'}
            size="sm"
            onClick={() => {
              setTwoFactorEnabled(!twoFactorEnabled)
              toast.success(
                twoFactorEnabled ? '2FA Disabled' : '2FA Enabled',
                twoFactorEnabled
                  ? 'Two-factor protection turned off.'
                  : 'Authenticator app verified and active.',
              )
            }}
          >
            {twoFactorEnabled ? 'Turn Off 2FA' : 'Configure 2FA'}
          </PillButton>
        </div>
      </div>

      {/* Active Sessions */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <div>
          <h2 className="text-base font-bold flex items-center gap-2">
            <Laptop className="size-4 text-brand" /> Active Authorized Sessions
          </h2>
          <p className="text-xs text-muted-foreground">
            Devices that are currently signed into your Aether trading account
          </p>
        </div>

        <div className="flex flex-col divide-y divide-border">
          {sessions.map((session) => (
            <div key={session.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-secondary text-foreground">
                  {session.device.includes('iPhone') ? <Smartphone className="size-4" /> : <Laptop className="size-4" />}
                </div>
                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{session.device}</span>
                    {session.current && (
                      <Badge variant="brand" size="sm">
                        This Device
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {session.location} · Active {formatDate(session.lastActive, { withTime: true })}
                  </span>
                </div>
              </div>

              {!session.current && (
                <button
                  type="button"
                  onClick={() => handleRevokeSession(session.id)}
                  className="text-xs text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
