'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertTriangle, Archive, Trash2 } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/tabs'

export function SettingsTab({ bot }: { bot: Bot }) {
  const router = useRouter()
  const updateBot = useWorkspace((s) => s.updateBot)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)
  const deleteBot = useWorkspace((s) => s.deleteBot)

  const [name, setName] = useState(bot.name)
  const [description, setDescription] = useState(bot.description)

  const handleSave = () => {
    updateBot(bot.id, { name: name.trim() || bot.name, description: description.trim() })
    toast.success('Settings saved', 'Bot details have been updated.')
  }

  const handleVisibilityChange = (v: 'private' | 'unlisted' | 'public') => {
    updateBot(bot.id, { visibility: v })
    toast.success('Visibility updated', `Bot is now ${v}.`)
  }

  const handleArchive = () => {
    setBotStatus(bot.id, 'paused')
    toast.info('Bot paused', "Archiving isn't modeled separately yet — this pauses the bot.")
  }

  const handleDelete = () => {
    if (confirm(`Are you sure you want to permanently delete "${bot.name}"? This action cannot be undone.`)) {
      deleteBot(bot.id)
      toast.info('Bot deleted', `${bot.name} was removed.`)
      router.push('/app/bots')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* General Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>General Settings</CardTitle>
          <PillButton onClick={handleSave} size="sm">
            <Save className="size-3.5 mr-1" /> Save Edits
          </PillButton>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field label="Bot Name" help="The display name for your strategy graph.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Nifty Momentum v4" />
          </Field>

          <Field label="Description" help="Detailed explanation of strategy logic and market context.">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your strategy..."
              rows={4}
            />
          </Field>

          <Field label="Visibility" help="Control who can discover or clone your strategy.">
            <div className="pt-1">
              <Segmented<'private' | 'unlisted' | 'public'>
                options={[
                  { value: 'private', label: 'Private' },
                  { value: 'unlisted', label: 'Unlisted' },
                  { value: 'public', label: 'Public' },
                ]}
                value={bot.visibility}
                onValueChange={handleVisibilityChange}
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
          <AlertTriangle className="size-4" /> Danger Zone
        </div>
        <p className="text-xs text-muted-foreground">
          Actions here directly impact bot execution state and stored backtest artifacts.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleArchive}>
            <Archive className="size-3.5 mr-1 text-muted-foreground" /> Archive Bot
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="size-3.5 mr-1" /> Delete Bot
          </Button>
        </div>
      </div>
    </div>
  )
}
