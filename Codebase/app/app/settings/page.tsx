'use client'

import { useState } from 'react'
import {
  User,
  Key,
  Bell,
  Save,
} from 'lucide-react'
import { useSession, toast } from '@/lib/store'
import { Input, Textarea, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  const profile = useSession((s) => s.profile)
  const apiKeys = useSession((s) => s.apiKeys)
  const notificationPrefs = useSession((s) => s.notificationPrefs)
  const updateProfile = useSession((s) => s.updateProfile)
  const updateApiKeys = useSession((s) => s.updateApiKeys)
  const updateNotificationPrefs = useSession((s) => s.updateNotificationPrefs)

  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [bio, setBio] = useState(profile.bio)
  const [publicProfile, setPublicProfile] = useState(profile.publicProfile)

  const [nseKey, setNseKey] = useState(apiKeys.nseKey)
  const [brokerKey, setBrokerKey] = useState(apiKeys.brokerKey)

  const [emailNotifs, setEmailNotifs] = useState(notificationPrefs.emailNotifs)
  const [drawdownAlerts, setDrawdownAlerts] = useState(notificationPrefs.drawdownAlerts)

  const handleSave = () => {
    updateProfile({
      name: name.trim() || profile.name,
      email: email.trim() || profile.email,
      bio: bio.trim(),
      publicProfile,
    })
    updateApiKeys({
      nseKey: nseKey.trim(),
      brokerKey: brokerKey.trim(),
    })
    updateNotificationPrefs({
      emailNotifs,
      drawdownAlerts,
    })
    toast.success('Settings Saved', 'Your workspace preferences have been updated.')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      <div className="flex items-center justify-between border-b border-border pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Workspace Settings</h1>
          <p className="text-xs text-muted-foreground">
            Manage profile details, API integrations, and system alerts
          </p>
        </div>
        <PillButton onClick={handleSave} className="gap-2">
          <Save className="size-4" /> Save Edits
        </PillButton>
      </div>

      {/* Profile Section */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold flex items-center gap-2">
          <User className="size-4 text-brand" /> Profile & Identity
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Full Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email Address">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
        <Field label="Trader Bio">
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
        </Field>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <div className="flex flex-col">
            <span className="text-xs font-semibold">Public Profile</span>
            <span className="text-[11px] text-muted-foreground">
              Allow other quants to view your published strategy presets
            </span>
          </div>
          <Switch checked={publicProfile} onCheckedChange={setPublicProfile} />
        </div>
      </div>

      {/* API Credentials */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Key className="size-4 text-brand" /> Market Data & Broker API Keys
        </h2>
        <div className="flex flex-col gap-4">
          <Field label="NSE Realtime Datafeed Key" help="Used by OHLCV and Orderbook feeds in Layer I">
            <Input type="password" value={nseKey} onChange={(e) => setNseKey(e.target.value)} />
          </Field>
          <Field label="Broker Execution API Key (Kite / IBKR)" help="Used for paper and live order placement in Layer IX">
            <Input type="password" value={brokerKey} onChange={(e) => setBrokerKey(e.target.value)} />
          </Field>
        </div>
      </div>

      {/* Notifications */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Bell className="size-4 text-brand" /> Notification Preferences
        </h2>
        <div className="flex flex-col gap-4 divide-y divide-border">
          <div className="flex items-center justify-between pt-2">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Backtest Summaries</span>
              <span className="text-[11px] text-muted-foreground">
                Receive email digests after long-running Monte Carlo simulations
              </span>
            </div>
            <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Drawdown & Loss Brakes</span>
              <span className="text-[11px] text-muted-foreground">
                Instant alert when a live bot hits its drawdown threshold
              </span>
            </div>
            <Switch checked={drawdownAlerts} onCheckedChange={setDrawdownAlerts} />
          </div>
        </div>
      </div>
    </div>
  )
}
