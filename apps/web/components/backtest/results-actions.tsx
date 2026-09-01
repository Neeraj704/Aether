'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Bookmark, GitCompare, Play } from 'lucide-react'
import type { Bot, BacktestRun } from '@/mock/data'
import { useWorkspace } from '@/lib/workspace-store'
import { toast } from '@/lib/store'
import { startLiveSession } from '@/lib/engine'
import { PillButton } from '@/components/ui/pill-button'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Field, Input } from '@/components/ui/input'

export function ResultsActions({ bot, run }: { bot: Bot; run: BacktestRun }) {
  const router = useRouter()
  const savePreset = useWorkspace((s) => s.savePreset)
  const setBotStatus = useWorkspace((s) => s.setBotStatus)

  const [presetDialogOpen, setPresetDialogOpen] = useState(false)
  const [presetName, setPresetName] = useState(`${bot.name} — from this run`)
  const [promoting, setPromoting] = useState(false)

  const handleExport = () => {
    toast.info('Exporting Report', 'Generating summary download...')
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ bot: bot.name, run }, null, 2))}`
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `report-${run.id}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success('Report Exported', `Saved report-${run.id}.json`)
  }

  const handleCompare = () => {
    router.push(`/app/compare?run=${run.id}`)
  }

  const handleSavePreset = () => {
    savePreset({
      name: presetName.trim() || `${bot.name} preset`,
      description: bot.description,
      graph: bot.graph,
    })
    toast.success('Preset saved', `"${presetName}" added to My Presets.`)
    setPresetDialogOpen(false)
  }

  const handlePromoteLive = async () => {
    setPromoting(true)
    try {
      const symbol = run.config.symbols ? run.config.symbols.split(',')[0].trim() : 'BTCUSDT'
      const capital = run.config.capital || 100000
      await startLiveSession(bot.id, symbol, capital)
      setBotStatus(bot.id, 'live')
      toast.success('Bot Promoted to Live', `${bot.name} is now executing in live paper-trading mode.`)
      router.push(`/app/bots/${bot.id}?tab=live`)
    } catch (err: any) {
      toast.error('Could Not Promote Bot', err.message || 'Validation or engine error')
    } finally {
      setPromoting(false)
    }
  }


  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="size-3.5 mr-1" /> Export Report
          </Button>

          <Button variant="outline" size="sm" onClick={() => setPresetDialogOpen(true)}>
            <Bookmark className="size-3.5 mr-1" /> Save as Preset
          </Button>

          <Button variant="outline" size="sm" onClick={handleCompare}>
            <GitCompare className="size-3.5 mr-1" /> Compare to Run
          </Button>
        </div>

        <PillButton onClick={handlePromoteLive} size="sm">
          <Play className="size-3.5 mr-1 fill-current" /> Promote to Live
        </PillButton>
      </div>

      {/* Preset Dialog */}
      <Dialog open={presetDialogOpen} onOpenChange={setPresetDialogOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Save Strategy Preset</DialogTitle>
            <DialogDescription>
              Save this graph configuration to your personal preset library for quick reuse.
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <Field label="Preset Name">
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="e.g. My Preset"
              />
            </Field>
          </DialogBody>

          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPresetDialogOpen(false)}>
              Cancel
            </Button>
            <PillButton size="sm" onClick={handleSavePreset}>
              Save Preset
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
