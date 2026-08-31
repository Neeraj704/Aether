'use client'

import { useState } from 'react'
import { Bell, Webhook, Save } from 'lucide-react'
import { NOTIFICATION_EVENTS } from '@/mock/data'
import { toast } from '@/lib/store'
import { AccountNav } from '@/components/account/account-nav'
import { PillButton } from '@/components/ui/pill-button'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { Input, Field } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'

export default function AccountNotificationsPage() {
  const [webhookUrl, setWebhookUrl] = useState('https://api.myfund.internal/hooks/aether')
  const [prefs, setPrefs] = useState<Record<string, { email: boolean; inApp: boolean; webhook: boolean }>>(() => {
    const initial: Record<string, { email: boolean; inApp: boolean; webhook: boolean }> = {}
    NOTIFICATION_EVENTS.forEach((e) => {
      initial[e.id] = { email: true, inApp: true, webhook: e.id === 'trade_executed' || e.id === 'risk_breach' }
    })
    return initial
  })

  const toggle = (eventId: string, channel: 'email' | 'inApp' | 'webhook') => {
    setPrefs((prev) => ({
      ...prev,
      [eventId]: {
        ...prev[eventId],
        [channel]: !prev[eventId]?.[channel],
      },
    }))
  }

  const handleSave = () => {
    toast.success('Notification Preferences Saved', 'Dispatch rules have been updated.')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Configure multi-channel event alerting, trade dispatch webhooks, and summary digests
        </p>
      </div>

      <AccountNav />

      {/* Webhook Configuration Card */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Webhook className="size-4 text-brand" /> Outbound Alert Webhooks (Pro)
        </h2>
        <p className="text-xs text-muted-foreground">
          Receive signed HMAC-SHA256 JSON payloads on your internal execution endpoints for trade fills and risk limits.
        </p>

        <Field label="Webhook Endpoint URL" htmlFor="webhook-url">
          <Input
            id="webhook-url"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-domain.com/api/webhooks"
            className="text-xs font-mono"
          />
        </Field>
      </div>

      {/* Matrix Table Card */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col gap-4">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Bell className="size-4 text-brand" /> Notification Event Matrix
        </h2>

        <div className="overflow-x-auto">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4 text-left w-96">Trigger Event</TH>
                <TH className="text-center w-28">Email</TH>
                <TH className="text-center w-28">In-App</TH>
                <TH className="text-center w-28 pr-4">Webhook</TH>
              </TR>
            </THead>
            <TBody>
              {NOTIFICATION_EVENTS.map((event) => {
                const setting = prefs[event.id] || { email: true, inApp: true, webhook: false }
                return (
                  <TR key={event.id}>
                    <TD className="pl-4 py-3">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{event.label}</span>
                        <span className="text-[11px] text-muted-foreground">{event.detail}</span>
                      </div>
                    </TD>
                    <TD className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={setting.email}
                          onCheckedChange={() => toggle(event.id, 'email')}
                        />
                      </div>
                    </TD>
                    <TD className="text-center">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={setting.inApp}
                          onCheckedChange={() => toggle(event.id, 'inApp')}
                        />
                      </div>
                    </TD>
                    <TD className="text-center pr-4">
                      <div className="flex justify-center">
                        <Checkbox
                          checked={setting.webhook}
                          onCheckedChange={() => toggle(event.id, 'webhook')}
                        />
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </div>

        <div className="flex justify-end pt-4 border-t border-border">
          <PillButton onClick={handleSave} className="gap-2 shadow-lg shadow-brand/20">
            <Save className="size-4" /> Save Dispatch Rules
          </PillButton>
        </div>
      </div>
    </div>
  )
}
