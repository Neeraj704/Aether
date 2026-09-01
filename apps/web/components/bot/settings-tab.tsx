'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertTriangle, Archive, Trash2 } from 'lucide-react'
import type { Bot } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { updateBotMeta, deleteBot as deleteBotDB } from '@/lib/bots'
import { toast } from '@/lib/store'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Field, Input, Textarea } from '@/components/ui/input'
import { PillButton } from '@/components/ui/pill-button'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/tabs'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function SettingsTab({ bot }: { bot: Bot }) {
  const router = useRouter()
  const updateBotLocal = useWorkspace((s) => s.updateBot)
  const deleteBotLocal = useWorkspace((s) => s.deleteBot)

  const [name, setName] = useState(bot.name)
  const [description, setDescription] = useState(bot.description)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const handleSave = async () => {
    const nextName = name.trim() || bot.name
    const nextDesc = description.trim()
    setSaving(true)

    try {
      await updateBotMeta(bot.id, { name: nextName, description: nextDesc })
      updateBotLocal(bot.id, { name: nextName, description: nextDesc })
      toast.success('Settings saved', 'Bot details have been updated in database.')
    } catch (err: any) {
      toast.error('Save failed', err?.message || 'Could not update bot settings.')
    } finally {
      setSaving(false)
    }
  }

  const handleVisibilityChange = async (v: 'private' | 'unlisted' | 'public') => {
    try {
      await updateBotMeta(bot.id, { visibility: v })
      updateBotLocal(bot.id, { visibility: v })
      toast.success('Visibility updated', `Bot is now ${v}.`)
    } catch (err: any) {
      toast.error('Update failed', err?.message || 'Could not update visibility.')
    }
  }

  const handleConfirmDelete = async () => {
    try {
      await deleteBotDB(bot.id)
      deleteBotLocal(bot.id)
      toast.success('Bot deleted', `"${bot.name}" has been removed.`)
      router.replace('/app/bots')
    } catch (err: any) {
      toast.error('Delete failed', err?.message || 'Could not delete bot.')
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* General Settings */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>General Settings</CardTitle>
          <PillButton onClick={handleSave} disabled={saving} size="sm">
            <Save className="size-3.5 mr-1" /> {saving ? 'Saving...' : 'Save Edits'}
          </PillButton>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field label="Bot Name" help="The display name for your strategy graph.">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. BTC Momentum Alpha" />
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
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="size-4" /> Danger Zone
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Irreversible actions that permanently delete this strategy and its simulation history.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-foreground">Delete this bot</p>
            <p className="text-xs text-muted-foreground">
              Once deleted, all historical backtests and configurations will be permanently removed.
            </p>
          </div>
          <Button onClick={() => setShowDeleteConfirm(true)} variant="destructive" size="sm">
            <Trash2 className="size-3.5 mr-1" /> Delete Bot
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete Strategy Bot"
        description={`Are you sure you want to delete "${bot.name}"? This action cannot be undone.`}
        confirmLabel="Delete Bot"
        destructive
        onConfirm={handleConfirmDelete}
      />
    </div>
  )
}
