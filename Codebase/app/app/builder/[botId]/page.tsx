'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { Monitor } from 'lucide-react'
import { COMPONENT_MAP, type ComponentDef } from '@/mock/layers'
import { CURRENT_GRAPH_SCHEMA_VERSION } from '@/mock/data'
import { useBuilder } from '@/lib/builder-store'
import { useBot, useWorkspace, useHydrated } from '@/lib/workspace-store'
import { validateGraph, issueCounts, type Issue } from '@/lib/validate'
import { toast, useSession } from '@/lib/store'
import { BuilderToolbar } from '@/components/builder/builder-toolbar'
import { LibraryPanel } from '@/components/builder/library-panel'
import { LoomCanvas } from '@/components/builder/canvas'
import { Inspector } from '@/components/builder/inspector'
import { ConsolePanel } from '@/components/builder/console-panel'
import { UnlockDialog } from '@/components/builder/unlock-dialog'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Field, Input, Textarea } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'

export default function BuilderPage() {
  const { botId } = useParams<{ botId: string }>()
  const bot = useBot(botId)
  const hydrated = useHydrated()
  const { saveGraph, updateBot, savePreset, snapshotVersion } = useWorkspace()
  const { plan, unlocked } = useSession()
  const [isSmallScreen, setIsSmallScreen] = useState(false)

  const {
    load,
    nodes,
    edges,
    notes,
    frames,
    selection,
    dirty,
    setIssues,
    setConsole,
    focusNodes,
    markSaved,
    pushLog,
    undo,
    redo,
    duplicateSelection,
    removeNodes,
  } = useBuilder()

  const [unlockTarget, setUnlockTarget] = useState<ComponentDef | null>(null)
  const [blockOpen, setBlockOpen] = useState(false)
  const [blockName, setBlockName] = useState('')
  const [blockDesc, setBlockDesc] = useState('')
  const loadedFor = useRef<string | null>(null)

  /* Load the bot's graph into the builder once per bot. */
  useEffect(() => {
    if (!bot || loadedFor.current === bot.id) return
    loadedFor.current = bot.id
    if ((bot.graph?.schemaVersion ?? 1) < CURRENT_GRAPH_SCHEMA_VERSION) {
      toast.info("Canvas Upgraded", "This bot's canvas layout was upgraded to the current format.")
    }
    const g = bot.graph || {
      nodes: (bot as any).nodes || [],
      edges: (bot as any).edges || [],
      notes: (bot as any).notes || [],
      frames: (bot as any).frames || [],
      schemaVersion: 1,
    }
    load(bot.id, g.nodes, g.edges, g.notes, g.frames)
  }, [bot, load])

  const save = useCallback(
    (silent = false) => {
      if (!bot) return
      saveGraph(bot.id, {
        nodes,
        edges,
        notes,
        frames,
        schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
      })
      markSaved()
      if (!silent) {
        pushLog('info', 'Graph saved.')
        toast.success('Bot saved', `${nodes.length} nodes, ${edges.length} connections.`)
      }
    },
    [bot, nodes, edges, notes, frames, saveGraph, markSaved, pushLog],
  )

  /* Autosave a couple of seconds after the graph settles. */
  useEffect(() => {
    if (!dirty || !bot) return
    const timer = setTimeout(() => {
      saveGraph(bot.id, {
        nodes,
        edges,
        notes,
        frames,
        schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
      })
      markSaved()
      pushLog('info', 'Autosaved.')
    }, 2500)
    return () => clearTimeout(timer)
  }, [dirty, bot, nodes, edges, notes, frames, saveGraph, markSaved, pushLog])

  /* Warn on hard navigation while there are unsaved edits. */
  useEffect(() => {
    if (!dirty) return
    const handler = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const validate = useCallback(() => {
    const found = validateGraph(nodes, edges, { plan, unlocked })
    setIssues(found)
    setConsole(true, 'issues')
    const { errors, warnings } = issueCounts(found)
    if (errors === 0 && warnings === 0) {
      pushLog('info', 'Validation passed.')
      toast.success('Graph is valid', 'No blocking problems found.')
    } else {
      pushLog(
        errors > 0 ? 'error' : 'warn',
        `Validation finished — ${errors} error(s), ${warnings} warning(s).`,
      )
    }
  }, [nodes, edges, plan, unlocked, setIssues, setConsole, pushLog])

  /* Keyboard shortcuts. */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      const mod = e.metaKey || e.ctrlKey

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      } else if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelection()
      } else if (mod && e.key === 'Enter') {
        e.preventDefault()
        validate()
      } else if ((e.key === 'Backspace' || e.key === 'Delete') && selection.length > 0) {
        removeNodes(selection)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo, redo, save, duplicateSelection, validate, removeNodes, selection])

  const handleJump = useCallback((issue: Issue) => focusNodes(issue.nodeIds ?? []), [focusNodes])

  const handleSaveBlock = () => {
    setBlockName(`Block of ${selection.length}`)
    setBlockDesc('')
    setBlockOpen(true)
  }

  const commitBlock = () => {
    const picked = nodes.filter((n) => selection.includes(n.id))
    const ids = new Set(selection)
    savePreset({
      name: blockName.trim() || 'Untitled block',
      description: blockDesc.trim(),
      graph: {
        nodes: picked,
        edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
        notes: [],
        frames: [],
        schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
      },
    })
    setBlockOpen(false)
    toast.success('Block saved', 'Find it at the top of your node library.')
  }

  useEffect(() => {
    const checkViewport = () => setIsSmallScreen(window.innerWidth < 1024)
    checkViewport()
    window.addEventListener('resize', checkViewport)
    return () => window.removeEventListener('resize', checkViewport)
  }, [])

  if (!hydrated) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-xs text-muted-foreground animate-pulse font-mono">
        Loading strategy canvas...
      </div>
    )
  }

  if (isSmallScreen) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          icon={Monitor}
          title="Best experienced on a larger screen"
          description="The Builder needs room for the canvas, node library, and inspector side panels. Switch to a desktop or larger display for full editing capabilities."
          action={{ label: 'Back to bots', href: '/app/bots' }}
        />
      </div>
    )
  }

  if (!bot) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <EmptyState
          title="That bot no longer exists"
          description="It may have been deleted from another tab. Your other bots are unaffected."
          action={{ label: 'Back to bots', href: '/app/bots' }}
        />
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100svh-3.5rem)] flex-col">
      <BuilderToolbar
        bot={bot}
        onRename={(name) => {
          updateBot(bot.id, { name })
          snapshotVersion(bot.id, `Renamed to ${name}`)
        }}
        onSave={() => save()}
        onValidate={validate}
      />

      <div className="flex min-h-0 flex-1">
        <LibraryPanel onUnlockRequest={setUnlockTarget} />

        <div className="flex min-w-0 flex-1 flex-col">
          <LoomCanvas
            onRequestUnlock={(comp) => setUnlockTarget(COMPONENT_MAP[comp] ?? null)}
          />
          <ConsolePanel onJump={handleJump} />
        </div>

        <Inspector onUnlockRequest={setUnlockTarget} onSaveBlock={handleSaveBlock} />
      </div>

      <UnlockDialog
        comp={unlockTarget}
        onClose={() => setUnlockTarget(null)}
        onUnlocked={() => pushLog('info', 'Component unlocked.')}
      />

      <Dialog open={blockOpen} onOpenChange={setBlockOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Save as block</DialogTitle>
            <DialogDescription>
              Reusable across every bot. Drop it back on any canvas from the library.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <Field label="Name" htmlFor="block-name">
              <Input
                id="block-name"
                value={blockName}
                onChange={(e) => setBlockName(e.target.value)}
                placeholder="Momentum core"
              />
            </Field>
            <Field
              label="What it does"
              htmlFor="block-desc"
              help={`${selection.length} nodes will be captured.`}
            >
              <Textarea
                id="block-desc"
                rows={3}
                value={blockDesc}
                onChange={(e) => setBlockDesc(e.target.value)}
                placeholder="RSI and MACD feeding a confidence gate."
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBlockOpen(false)}>
              Cancel
            </Button>
            <Button onClick={commitBlock}>Save block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
