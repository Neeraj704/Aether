'use client'

import { useState } from 'react'
import {
  User,
  Key,
  Bell,
  Sliders,
  Shield,
  Save,
  Moon,
  Sun,
  Check,
} from 'lucide-react'
import { CURRENT_USER } from '@/mock/data'
import { useSession, toast } from '@/lib/store'
import { Input, Textarea, Field } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Switch } from '@/components/ui/switch'

export default function SettingsPage() {
  const theme = useSession((s) => s.theme)
  const setTheme = useSession((s) => s.setTheme)

  const [name, setName] = useState(CURRENT_USER.name)
  const [email, setEmail] = useState(CURRENT_USER.email)
  const [bio, setBio] = useState(CURRENT_USER.bio)
  const [publicProfile, setPublicProfile] = useState(CURRENT_USER.publicProfile)

  const [nseKey, setNseKey] = useState('nse_live_89f104829a174c')
  const [brokerKey, setBrokerKey] = useState('zk_prod_9918237402')

  const [emailNotifs, setEmailNotifs] = useState(true)
  const [drawdownAlerts, setDrawdownAlerts] = useState(true)

  const handleSave = () => {
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
            <span className="text-[11px] text-muted-foreground">Allow other quants to view your published strategy presets</span>
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
              <span className="text-[11px] text-muted-foreground">Receive email digests after long-running Monte Carlo simulations</span>
            </div>
            <Switch checked={emailNotifs} onCheckedChange={setEmailNotifs} />
          </div>

          <div className="flex items-center justify-between pt-3">
            <div className="flex flex-col">
              <span className="text-xs font-semibold">Drawdown & Loss Brakes</span>
              <span className="text-[11px] text-muted-foreground">Instant alert when a live bot hits its drawdown threshold</span>
            </div>
            <Switch checked={drawdownAlerts} onCheckedChange={setDrawdownAlerts} />
          </div>
        </div>
      </div>
    </div>
  )
}
