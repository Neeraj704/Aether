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
  type BotGraph,
  type BotStatus,
  type CanvasFrame,
  type CanvasNote,
  type BacktestRun,
  type MyPreset,
  type Notification,
  type Preset,
  type PublishedPreset,
  emptyGraph,
} from '@/mock/data'
import { slugId } from '@/lib/utils'
import { cloneGraph, migrateGraph } from '@/lib/graph-utils'

/* ------------------------------------------------------------------ */
/* Storage Normalization & Migration Helpers                           */
/* ------------------------------------------------------------------ */

/** Normalizes a bot loaded from storage, migrating legacy loose fields if graph is absent. */
export function normalizeBot(bot: any): Bot {
  if (!bot) return bot
  if (bot.graph && bot.graph.nodes) {
    const { graph } = migrateGraph(bot.graph)
    return {
      ...bot,
      graph,
      versions: (bot.versions || []).map((v: any) => ({
        ...v,
        graph: v.graph ? migrateGraph(v.graph).graph : cloneGraph(graph),
      })),
    }
  }
  const rawGraph: BotGraph = {
    nodes: bot.nodes || [],
    edges: bot.edges || [],
    notes: bot.notes || [],
    frames: bot.frames || [],
    schemaVersion: 1,
  }
  const { graph } = migrateGraph(rawGraph)
  return {
    ...bot,
    graph,
    versions: (bot.versions || []).map((v: any) => ({
      ...v,
      graph: v.graph ? migrateGraph(v.graph).graph : cloneGraph(graph),
    })),
  }
}

/** Normalizes a preset loaded from storage, migrating legacy loose fields if graph is absent. */
export function normalizePreset<T extends { graph?: BotGraph; nodes?: BotNode[]; edges?: BotEdge[] }>(preset: T): T {
  if (!preset) return preset
  if (preset.graph && preset.graph.nodes) {
    const { graph } = migrateGraph(preset.graph)
    return { ...preset, graph }
  }
  const rawGraph: BotGraph = {
    nodes: (preset as any).nodes || [],
    edges: (preset as any).edges || [],
    notes: (preset as any).notes || [],
    frames: (preset as any).frames || [],
    schemaVersion: 1,
  }
  const { graph } = migrateGraph(rawGraph)
  return { ...preset, graph }
}

/* ------------------------------------------------------------------ */
/* Node helpers                                                        */
/* ------------------------------------------------------------------ */

/** Seeds a node's config from the component's declared field defaults (basic + advanced). */
export function defaultConfig(comp: ComponentDef): Record<string, unknown> {
  const config: Record<string, unknown> = {}
  const allFields = [...comp.fields, ...(comp.advancedFields || [])]
  for (const f of allFields) {
    if (f.type === 'model-select') {
      config[f.key] = f.value || {
        providerId: 'openai',
        modelId: 'gpt-5-mini',
        temperature: 0.7,
        maxTokens: 1024,
      }
    } else if (f.type === 'credential') {
      config[f.key] = f.value || ''
    } else if (f.type === 'dataset-ref') {
      config[f.key] = f.value || null
    } else if (f.type === 'key-value') {
      config[f.key] = f.value || []
    } else if (f.type === 'weighted-list') {
      config[f.key] = f.value || {}
    } else if (f.type === 'prompt' || f.type === 'code' || f.type === 'json') {
      config[f.key] = f.value || ''
    } else if (f.type === 'switch') {
      config[f.key] = typeof f.value === 'boolean' ? f.value : false
    } else if (f.type === 'select') {
      config[f.key] = f.value || f.options[0] || ''
    } else if ('value' in f && (f as any).value !== undefined) {
      config[f.key] = (f as any).value
    } else {
      config[f.key] = ''
    }
  }
  return config
}

/** A node is "needs config" while any required field is still blank. */
export function computeNeedsConfig(comp: ComponentDef, config: Record<string, unknown>) {
  const allFields = [...comp.fields, ...(comp.advancedFields || [])]
  return allFields.some((f) => {
    if (f.type === 'text' || f.type === 'password' || f.type === 'credential') {
      return String(config[f.key] ?? '').trim().length === 0
    }
    if (f.type === 'model-select') {
      const ms = config[f.key] as any
      return !ms || !ms.modelId || String(ms.modelId).trim().length === 0
    }
    if (f.type === 'dataset-ref') {
      return config[f.key] === null || config[f.key] === undefined || String(config[f.key]).trim().length === 0
    }
    return false
  })
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

interface WorkspaceState {
  hydrated: boolean
  bots: Bot[]
  runs: BacktestRun[]
  myPresets: MyPreset[]
  publishedPresets: PublishedPreset[]
  creatorEarnings: typeof CREATOR_EARNINGS
  notifications: Notification[]
  /** Preset ids the user has forked, so the marketplace can show "Forked". */
  forkedPresets: string[]
  /** Preset ids the user has liked. */
  likedPresets: string[]

  /* Bots */
  createBot: (input?: { name?: string; description?: string; graph?: BotGraph; tags?: string[] }) => Bot
  duplicateBot: (id: string) => Bot | null
  deleteBot: (id: string) => void
  updateBot: (id: string, patch: Partial<Omit<Bot, 'id'>>) => void
  saveGraph: (id: string, graph: BotGraph) => void
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
  savePreset: (input: { name: string; description: string; graph: BotGraph }) => void
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
  myPresets: MY_PRESETS,
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
        const graph = input.graph ? cloneGraph(input.graph) : emptyGraph()
        const bot: Bot = {
          id: slugId('bot'),
          name: input.name?.trim() || 'Untitled bot',
          description: input.description ?? '',
          status: 'draft',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          tags: input.tags ?? [],
          graph,
          headlineMetric: { label: 'Not run yet', value: '—', positive: true },
          visibility: 'private',
          versions: [
            {
              id: slugId('v'),
              label: 'v1',
              createdAt: nowISO(),
              note: 'Created',
              nodeCount: graph.nodes.length,
              graph: cloneGraph(graph),
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
        const graph = cloneGraph(source.graph)
        const copy: Bot = {
          ...source,
          id: slugId('bot'),
          name: `${source.name} copy`,
          status: 'draft',
          createdAt: nowISO(),
          updatedAt: nowISO(),
          visibility: 'private',
          runIds: [],
          graph,
          versions: [
            {
              id: slugId('v'),
              label: 'v1',
              createdAt: nowISO(),
              note: `Duplicated from ${source.name}`,
              nodeCount: graph.nodes.length,
              graph: cloneGraph(graph),
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

      saveGraph: (id, graph) =>
        set({
          bots: get().bots.map((b) =>
            b.id === id
              ? {
                  ...b,
                  graph,
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
                      nodeCount: b.graph.nodes.length,
                      graph: cloneGraph(b.graph),
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

      forkPreset: (preset: Preset) => {
        const bot = get().createBot({
          name: preset.name,
          description: preset.description,
          graph: preset.graph,
          tags: preset.tags,
        })
        set({ forkedPresets: Array.from(new Set([...get().forkedPresets, preset.id])) })
        return bot
      },

      createBotFromPreset: (presetId: string) => {
        const preset = get().myPresets.find((p) => p.id === presetId)
        const bot = get().createBot({
          name: preset ? `${preset.name} (Instance)` : 'New Strategy Bot',
          description: preset?.description || 'Created from saved preset.',
          graph: preset?.graph,
          tags: ['preset', 'custom'],
        })
        return bot
      },

      duplicatePreset: (id: string) => {
        const preset = get().myPresets.find((p) => p.id === id)
        if (!preset) return
        const clone: MyPreset = {
          ...preset,
          id: slugId('mp'),
          name: `Copy of ${preset.name}`,
          createdAt: nowISO(),
          graph: cloneGraph(preset.graph),
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

      savePreset: ({ name, description, graph }) => {
        const clonedGraph = cloneGraph(graph)
        const preset: MyPreset = {
          id: slugId('mp'),
          name,
          description,
          createdAt: nowISO(),
          visibility: 'private',
          nodeCount: clonedGraph.nodes.length,
          layers: Array.from(
            new Set(
              clonedGraph.nodes
                .map((n) => COMPONENT_MAP[n.componentId]?.layer)
                .filter((l): l is NonNullable<typeof l> => Boolean(l)),
            ),
          ),
          versions: [
            { id: slugId('mpv'), label: 'v1', createdAt: nowISO(), note: 'Initial save' },
          ],
          graph: clonedGraph,
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
      version: 2,
      partialize: ({ hydrated, ...rest }) => rest,
      migrate: (persistedState: any) => {
        if (!persistedState) return persistedState
        return {
          ...persistedState,
          bots: (persistedState.bots || []).map(normalizeBot),
          myPresets: (persistedState.myPresets || []).map(normalizePreset),
          publishedPresets: (persistedState.publishedPresets || []).map(normalizePreset),
        }
      },
      onRehydrateStorage: () => (state) => {
        if (!state || !state.bots || state.bots.length === 0) {
          useWorkspace.setState(seed())
        } else {
          const bots = (state.bots || []).map(normalizeBot)
          const myPresets = (state.myPresets || []).map(normalizePreset)
          const publishedPresets = (state.publishedPresets || []).map(normalizePreset)
          useWorkspace.setState({ bots, myPresets, publishedPresets })
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
