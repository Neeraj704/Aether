'use client'

import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { COMPONENT_MAP, type ComponentDef, type FieldDef } from '@/mock/layers'
import {
  BACKTEST_RUNS,
  BOTS,
  MY_PRESETS,
  NOTIFICATIONS,
  PUBLISHED_PRESETS,
  CREATOR_EARNINGS,
  type Bot,
  type BotEdge,
  type BotNode,
  type BotStatus,
  type CanvasFrame,
  type CanvasNote,
  type BacktestRun,
  type MyPreset,
  type Notification,
  type Preset,
  type PublishedPreset,
} from '@/mock/data'
import { slugId } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Node helpers                                                        */
/* ------------------------------------------------------------------ */

/** Seeds a node's config from the component's declared field defaults. */
export function defaultConfig(comp: ComponentDef): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  for (const f of comp.fields) {
    const raw = f as Record<string, unknown>
    if (raw.value !== undefined) {
      config[raw.key as string] = raw.value
    } else if (raw.type === 'checklist') {
      config[raw.key as string] = []
    } else {
      config[raw.key as string] = ''
    }
  }
  return config
}

/** A node is "needs config" while any free-text field is still blank. */
export function computeNeedsConfig(comp: ComponentDef, config: Record<string, unknown>) {
  return comp.fields.some(
    (f) =>
      (f.type === 'text' || f.type === 'password') &&
      String(config[f.key] ?? '').trim().length === 0,
  )
}

export function makeNode(componentId: string, x: number, y: number): BotNode {
  const comp = COMPONENT_MAP[componentId]
  const config = comp ? defaultConfig(comp) : {}
  return {
    id: slugId('n'),
    componentId,
    x,
    y,
    enabled: true,
    config,
    needsConfig: comp ? computeNeedsConfig(comp, config) : false,
  }
}

/* ------------------------------------------------------------------ */
/* Workspace store — everything the user can actually change           */
/* ------------------------------------------------------------------ */

/**
 * Saved mini-presets carry their own graph so they can be re-instantiated on
 * the canvas. The seeded fixtures describe blocks only, hence the optionals.
 */
export type StoredPreset = MyPreset & {
  nodes?: BotNode[]
  edges?: BotEdge[]
}

interface WorkspaceState {
  hydrated: boolean
  bots: Bot[]
  runs: BacktestRun[]
  myPresets: StoredPreset[]
  publishedPresets: PublishedPreset[]
  creatorEarnings: typeof CREATOR_EARNINGS
  notifications: Notification[]
  /** Preset ids the user has forked, so the marketplace can show "Forked". */
  forkedPresets: string[]
  /** Preset ids the user has liked. */
  likedPresets: string[]

  /* Bots */
  createBot: (input?: { name?: string; description?: string; nodes?: BotNode[]; edges?: BotEdge[]; tags?: string[] }) => Bot
  duplicateBot: (id: string) => Bot | null
  deleteBot: (id: string) => void
  updateBot: (id: string, patch: Partial<Omit<Bot, 'id'>>) => void
  saveGraph: (
    id: string,
    nodes: BotNode[],
    edges: BotEdge[],
    annotations?: { notes: CanvasNote[]; frames: CanvasFrame[] },
  ) => void
  setBotStatus: (id: string, status: BotStatus) => void
  snapshotVersion: (id: string, note: string) => void

  /* Runs */
  addRun: (run: BacktestRun) => void
  deleteRun: (id: string) => void

  /* Presets */
  forkPreset: (preset: Preset) => Bot
  createBotFromPreset: (presetId: string) => Bot
  duplicatePreset: (id: string) => void
  updatePresetVisibility: (id: string, visibility: 'private' | 'unlisted' | 'public') => void
  renamePreset: (id: string, name: string) => void
  toggleLikePreset: (id: string) => void
  savePreset: (input: { name: string; description: string; nodes: BotNode[]; edges: BotEdge[] }) => void
  deletePreset: (id: string) => void
  publishPreset: (preset: PublishedPreset) => void
  requestCreatorPayout: () => void

  /* Notifications */
  markRead: (id: string) => void
  markAllRead: () => void
  dismissNotification: (id: string) => void
  pushNotification: (n: Omit<Notification, 'id' | 'createdAt' | 'read'>) => void

  resetWorkspace: () => void
}

const seed = () => ({
  bots: BOTS,
  runs: BACKTEST_RUNS,
  myPresets: MY_PRESETS as StoredPreset[],
  publishedPresets: PUBLISHED_PRESETS,
  creatorEarnings: CREATOR_EARNINGS,
  notifications: NOTIFICATIONS,
  forkedPresets: [] as string[],
  likedPresets: [] as string[],
})

const nowISO = () => new Date().toISOString()

export const useWorkspace = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...seed(),

      /* ---------------- Bots ---------------- */

      createBot: (input = {}) => {
        const bot: Bot = {
          id: slugId('bot'),
          name: input.name?.trim() || 'Untitled bot',
          description: input.description ?? '',
          status: 'draft',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          tags: input.tags ?? [],
          nodes: input.nodes ?? [],
          edges: input.edges ?? [],
          headlineMetric: { label: 'Not run yet', value: '—', positive: true },
          visibility: 'private',
          versions: [
            {
              id: slugId('v'),
              label: 'v1',
              createdAt: nowISO(),
              note: 'Created',
              nodeCount: input.nodes?.length ?? 0,
            },
          ],
          runIds: [],
        }
        set({ bots: [bot, ...get().bots] })
        return bot
      },

      duplicateBot: (id) => {
        const source = get().bots.find((b) => b.id === id)
        if (!source) return null
        const copy: Bot = {
          ...source,
          id: slugId('bot'),
          name: `${source.name} copy`,
          status: 'draft',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          visibility: 'private',
          runIds: [],
          versions: [
            {
              id: slugId('v'),
              label: 'v1',
              createdAt: nowISO(),
              note: `Duplicated from ${source.name}`,
              nodeCount: source.nodes.length,
            },
          ],
        }
        set({ bots: [copy, ...get().bots] })
        return copy
      },

      deleteBot: (id) =>
        set({
          bots: get().bots.filter((b) => b.id !== id),
          runs: get().runs.filter((r) => r.botId !== id),
        }),

      updateBot: (id, patch) =>
        set({
          bots: get().bots.map((b) =>
            b.id === id ? { ...b, ...patch, updatedAt: nowISO() } : b,
          ),
        }),

    saveGraph: (id, nodes, edges, annotations) =>
      set({
        bots: get().bots.map((b) =>
          b.id === id
            ? {
                ...b,
                nodes,
                edges,
                notes: annotations?.notes ?? b.notes,
                frames: annotations?.frames ?? b.frames,
                updatedAt: nowISO(),
              }
            : b,
        ),
      }),

      setBotStatus: (id, status) =>
        set({
          bots: get().bots.map((b) => (b.id === id ? { ...b, status, updatedAt: nowISO() } : b)),
        }),

      snapshotVersion: (id, note) =>
        set({
          bots: get().bots.map((b) =>
            b.id === id
              ? {
                  ...b,
                  updatedAt: nowISO(),
                  versions: [
                    {
                      id: slugId('v'),
                      label: `v${b.versions.length + 1}`,
                      createdAt: nowISO(),
                      note,
                      nodeCount: b.nodes.length,
                      nodes: JSON.parse(JSON.stringify(b.nodes)),
                      edges: JSON.parse(JSON.stringify(b.edges)),
                    },
                    ...b.versions,
                  ],
                }
              : b,
          ),
        }),

      /* ---------------- Runs ---------------- */

      addRun: (run) =>
        set({
          runs: [run, ...get().runs],
          bots: get().bots.map((b) =>
            b.id === run.botId
              ? {
                  ...b,
                  status: b.status === 'draft' ? 'backtested' : b.status,
                  updatedAt: nowISO(),
                  runIds: [run.id, ...b.runIds],
                  headlineMetric: {
                    label: 'Total return',
                    value: `${run.metrics.totalReturn > 0 ? '+' : ''}${run.metrics.totalReturn.toFixed(1)}%`,
                    positive: run.metrics.totalReturn >= 0,
                  },
                }
              : b,
          ),
        }),

      deleteRun: (id) =>
        set({
          runs: get().runs.filter((r) => r.id !== id),
          bots: get().bots.map((b) => ({ ...b, runIds: b.runIds.filter((r) => r !== id) })),
        }),

      /* ---------------- Presets ---------------- */

      forkPreset: (preset) => {
        const bot = get().createBot({
          name: preset.name,
          description: preset.description,
          nodes: preset.nodes,
          edges: preset.edges,
          tags: preset.tags,
        })
        set({ forkedPresets: Array.from(new Set([...get().forkedPresets, preset.id])) })
        return bot
      },

      createBotFromPreset: (presetId) => {
        const preset = get().myPresets.find((p) => p.id === presetId)
        const nodes = preset && preset.nodes ? JSON.parse(JSON.stringify(preset.nodes)) : []
        const edges = preset && preset.edges ? JSON.parse(JSON.stringify(preset.edges)) : []
        const bot = get().createBot({
          name: preset ? `${preset.name} (Instance)` : 'New Strategy Bot',
          description: preset?.description || 'Created from saved preset.',
          nodes,
          edges,
          tags: ['preset', 'custom'],
        })
        return bot
      },

      duplicatePreset: (id) => {
        const preset = get().myPresets.find((p) => p.id === id)
        if (!preset) return
        const clone: StoredPreset = {
          ...preset,
          id: slugId('mp'),
          name: `Copy of ${preset.name}`,
          createdAt: nowISO(),
        }
        set({ myPresets: [clone, ...get().myPresets] })
      },

      updatePresetVisibility: (id, visibility) => {
        set({
          myPresets: get().myPresets.map((p) => (p.id === id ? { ...p, visibility } : p)),
        })
      },

      renamePreset: (id, name) => {
        set({
          myPresets: get().myPresets.map((p) => (p.id === id ? { ...p, name } : p)),
        })
      },

      toggleLikePreset: (id) => {
        const liked = get().likedPresets
        set({
          likedPresets: liked.includes(id) ? liked.filter((p) => p !== id) : [...liked, id],
        })
      },

      savePreset: ({ name, description, nodes, edges }) => {
        const preset: StoredPreset = {
          id: slugId('mp'),
          name,
          description,
          createdAt: nowISO(),
          visibility: 'private',
          nodeCount: nodes.length,
          layers: Array.from(
            new Set(
              nodes
                .map((n) => COMPONENT_MAP[n.componentId]?.layer)
                .filter((l): l is NonNullable<typeof l> => Boolean(l)),
            ),
          ),
          versions: [
            { id: slugId('mpv'), label: 'v1', createdAt: nowISO(), note: 'Initial save' },
          ],
          nodes,
          edges,
        }
        set({ myPresets: [preset, ...get().myPresets] })
      },

      deletePreset: (id) => set({ myPresets: get().myPresets.filter((p) => p.id !== id) }),

      publishPreset: (preset) =>
        set({
          publishedPresets: [preset, ...get().publishedPresets],
        }),

      requestCreatorPayout: () =>
        set({
          creatorEarnings: {
            ...get().creatorEarnings,
            pendingPayout: 0,
            lastPayout: {
              amount: get().creatorEarnings.pendingPayout,
              date: nowISO(),
              status: 'paid',
            },
          },
        }),

      /* ---------------- Notifications ---------------- */

      markRead: (id) =>
        set({
          notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
        }),

      markAllRead: () =>
        set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) }),

      dismissNotification: (id) =>
        set({ notifications: get().notifications.filter((n) => n.id !== id) }),

      pushNotification: (n) =>
        set({
          notifications: [
            { ...n, id: slugId('nt'), createdAt: nowISO(), read: false } as Notification,
            ...get().notifications,
          ],
        }),

      resetWorkspace: () => set(seed()),
    }),
    {
      name: 'aether.workspace',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => (state) => {
        if (!state || !state.bots || state.bots.length === 0) {
          useWorkspace.setState(seed())
        }
        useWorkspace.setState({ hydrated: true })
      },
    },
  ),
)

/* ------------------------------------------------------------------ */
/* Selectors                                                           */
/* ------------------------------------------------------------------ */

export function useBot(id: string | undefined) {
  return useWorkspace((s) => (id ? s.bots.find((b) => b.id === id) : undefined))
}

export function useRun(id: string | undefined) {
  return useWorkspace((s) => (id ? s.runs.find((r) => r.id === id) : undefined))
}

export function useUnreadCount() {
  return useWorkspace((s) => s.notifications.filter((n) => !n.read).length)
}

export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    setHydrated(true)
  }, [])
  return hydrated
}
