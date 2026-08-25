'use client'

import { create } from 'zustand'
import { COMPONENT_MAP, LAYERS, layerIndex, type LayerId } from '@/mock/layers'
import type { BotEdge, BotNode } from '@/mock/data'
import { computeNeedsConfig, makeNode } from '@/lib/workspace-store'
import { canConnect, createsCycle, type Issue } from '@/lib/validate'
import { slugId } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Canvas geometry                                                     */
/* ------------------------------------------------------------------ */

export const NODE_W = 224
export const NODE_H = 84
export const BAND_H = 168
export const BAND_COLLAPSED_H = 46
export const CANVAS_PAD = 48

export interface BandLayout {
  layer: LayerId
  top: number
  height: number
  collapsed: boolean
}

/** Vertical bands, shrinking for collapsed layers so the canvas stays compact. */
export function computeBands(collapsed: Set<LayerId>): BandLayout[] {
  let top = 0
  return LAYERS.map((l) => {
    const isCollapsed = collapsed.has(l.id)
    const height = isCollapsed ? BAND_COLLAPSED_H : BAND_H
    const band = { layer: l.id, top, height, collapsed: isCollapsed }
    top += height
    return band
  })
}

export function bandFor(bands: BandLayout[], layer: LayerId) {
  return bands.find((b) => b.layer === layer) ?? bands[0]
}

/** Absolute canvas position for a node, derived from its layer band. */
export function nodePosition(node: BotNode, bands: BandLayout[]) {
  const comp = COMPONENT_MAP[node.componentId]
  const band = bandFor(bands, comp?.layer ?? 'data')
  return { x: node.x, y: band.top + (BAND_H - NODE_H) / 2 }
}

/** Which layer band contains this canvas y coordinate. */
export function layerAtY(y: number, bands: BandLayout[]): LayerId {
  for (const b of bands) if (y >= b.top && y < b.top + b.height) return b.layer
  return y < 0 ? LAYERS[0].id : LAYERS[LAYERS.length - 1].id
}

/* ------------------------------------------------------------------ */
/* Undo/redo                                                           */
/* ------------------------------------------------------------------ */

interface Snapshot {
  nodes: BotNode[]
  edges: BotEdge[]
}

const HISTORY_LIMIT = 60

/* ------------------------------------------------------------------ */
/* Builder store                                                       */
/* ------------------------------------------------------------------ */

export type ConsoleTab = 'issues' | 'log'

interface BuilderState {
  botId: string | null
  nodes: BotNode[]
  edges: BotEdge[]
  selection: string[]
  collapsedLayers: LayerId[]
  dirty: boolean
  past: Snapshot[]
  future: Snapshot[]

  /** Validation output, refreshed explicitly by the Validate button. */
  issues: Issue[]
  validated: boolean
  consoleOpen: boolean
  consoleTab: ConsoleTab
  log: { id: string; at: string; level: 'info' | 'warn' | 'error'; message: string }[]

  /** Last rejected connection, surfaced as an inline canvas toast. */
  rejection: string | null

  load: (botId: string, nodes: BotNode[], edges: BotEdge[]) => void
  addNode: (componentId: string, x: number, y: number) => string | null
  addBlock: (nodes: BotNode[], edges: BotEdge[]) => void
  moveNodes: (moves: { id: string; x: number }[]) => void
  removeNodes: (ids: string[]) => void
  duplicateSelection: () => void
  setEnabled: (ids: string[], enabled: boolean) => void
  updateConfig: (id: string, key: string, value: unknown) => void
  connect: (source: string, target: string) => boolean
  disconnect: (edgeIds: string[]) => void
  setSelection: (ids: string[]) => void
  toggleLayer: (layer: LayerId) => void
  alignSelection: (mode: 'left' | 'center' | 'right') => void
  distributeSelection: () => void
  undo: () => void
  redo: () => void
  markSaved: () => void
  setIssues: (issues: Issue[]) => void
  setConsole: (open: boolean, tab?: ConsoleTab) => void
  pushLog: (level: 'info' | 'warn' | 'error', message: string) => void
  clearRejection: () => void
}

export const useBuilder = create<BuilderState>((set, get) => {
  /** Pushes the current graph onto the undo stack before a mutation. */
  const commit = (next: Partial<Snapshot>) => {
    const { nodes, edges, past } = get()
    set({
      past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      validated: false,
      ...next,
    })
  }

  return {
    botId: null,
    nodes: [],
    edges: [],
    selection: [],
    collapsedLayers: [],
    dirty: false,
    past: [],
    future: [],
    issues: [],
    validated: false,
    consoleOpen: false,
    consoleTab: 'issues',
    log: [],
    rejection: null,

    load: (botId, nodes, edges) =>
      set({
        botId,
        nodes,
        edges,
        selection: [],
        dirty: false,
        past: [],
        future: [],
        issues: [],
        validated: false,
        log: [
          {
            id: slugId('log'),
            at: new Date().toISOString(),
            level: 'info',
            message: `Loaded graph — ${nodes.length} nodes, ${edges.length} connections.`,
          },
        ],
      }),

    addNode: (componentId, x, y) => {
      const comp = COMPONENT_MAP[componentId]
      if (!comp) return null
      const node = makeNode(componentId, Math.max(CANVAS_PAD, Math.round(x)), layerIndex(comp.layer))
      void y
      commit({ nodes: [...get().nodes, node] })
      set({ selection: [node.id] })
      get().pushLog('info', `Added ${comp.name}.`)
      return node.id
    },

    addBlock: (nodes, edges) => {
      // Re-key so a block can be dropped repeatedly without id collisions.
      const map = new Map(nodes.map((n) => [n.id, slugId('n')]))
      const fresh = nodes.map((n) => ({ ...n, id: map.get(n.id)! }))
      const freshEdges = edges
        .filter((e) => map.has(e.source) && map.has(e.target))
        .map((e) => ({ id: slugId('e'), source: map.get(e.source)!, target: map.get(e.target)! }))
      commit({ nodes: [...get().nodes, ...fresh], edges: [...get().edges, ...freshEdges] })
      set({ selection: fresh.map((n) => n.id) })
    },

    moveNodes: (moves) => {
      const lookup = new Map(moves.map((m) => [m.id, m.x]))
      commit({
        nodes: get().nodes.map((n) =>
          lookup.has(n.id) ? { ...n, x: Math.max(0, Math.round(lookup.get(n.id)!)) } : n,
        ),
      })
    },

    removeNodes: (ids) => {
      const set_ = new Set(ids)
      commit({
        nodes: get().nodes.filter((n) => !set_.has(n.id)),
        edges: get().edges.filter((e) => !set_.has(e.source) && !set_.has(e.target)),
      })
      set({ selection: [] })
      get().pushLog('info', `Removed ${ids.length} node${ids.length > 1 ? 's' : ''}.`)
    },

    duplicateSelection: () => {
      const { nodes, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id))
      if (picked.length === 0) return
      const copies = picked.map((n) => ({ ...n, id: slugId('n'), x: n.x + 32 }))
      commit({ nodes: [...nodes, ...copies] })
      set({ selection: copies.map((c) => c.id) })
    },

    setEnabled: (ids, enabled) =>
      commit({
        nodes: get().nodes.map((n) => (ids.includes(n.id) ? { ...n, enabled } : n)),
      }),

    updateConfig: (id, key, value) =>
      commit({
        nodes: get().nodes.map((n) => {
          if (n.id !== id) return n
          const config = { ...n.config, [key]: value }
          const comp = COMPONENT_MAP[n.componentId]
          return { ...n, config, needsConfig: comp ? computeNeedsConfig(comp, config) : false }
        }),
      }),

    connect: (source, target) => {
      const { nodes, edges } = get()
      const s = nodes.find((n) => n.id === source)
      const t = nodes.find((n) => n.id === target)
      if (!s || !t) return false

      if (edges.some((e) => e.source === source && e.target === target)) {
        set({ rejection: 'These nodes are already connected.' })
        return false
      }

      const check = canConnect(s, t)
      if (!check.ok) {
        set({ rejection: check.reason ?? 'That connection is not allowed.' })
        get().pushLog('warn', `Rejected connection: ${check.reason}`)
        return false
      }

      if (createsCycle(edges, source, target)) {
        set({ rejection: 'That would create a loop — signal has to flow forward.' })
        return false
      }

      commit({ edges: [...edges, { id: slugId('e'), source, target }] })
      return true
    },

    disconnect: (edgeIds) =>
      commit({ edges: get().edges.filter((e) => !edgeIds.includes(e.id)) }),

    setSelection: (selection) => set({ selection }),

    toggleLayer: (layer) => {
      const current = get().collapsedLayers
      set({
        collapsedLayers: current.includes(layer)
          ? current.filter((l) => l !== layer)
          : [...current, layer],
      })
    },

    alignSelection: (mode) => {
      const { nodes, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id))
      if (picked.length < 2) return
      const lefts = picked.map((n) => n.x)
      const target =
        mode === 'left'
          ? Math.min(...lefts)
          : mode === 'right'
            ? Math.max(...lefts)
            : Math.round(lefts.reduce((a, b) => a + b, 0) / lefts.length)
      commit({
        nodes: nodes.map((n) => (selection.includes(n.id) ? { ...n, x: target } : n)),
      })
    },

    distributeSelection: () => {
      const { nodes, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id)).sort((a, b) => a.x - b.x)
      if (picked.length < 3) return
      const first = picked[0].x
      const last = picked[picked.length - 1].x
      const gap = (last - first) / (picked.length - 1)
      const positions = new Map(picked.map((n, i) => [n.id, Math.round(first + gap * i)]))
      commit({
        nodes: nodes.map((n) => (positions.has(n.id) ? { ...n, x: positions.get(n.id)! } : n)),
      })
    },

    undo: () => {
      const { past, future, nodes, edges } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({
        past: past.slice(0, -1),
        future: [{ nodes, edges }, ...future].slice(0, HISTORY_LIMIT),
        nodes: prev.nodes,
        edges: prev.edges,
        dirty: true,
        validated: false,
      })
    },

    redo: () => {
      const { past, future, nodes, edges } = get()
      const next = future[0]
      if (!next) return
      set({
        past: [...past, { nodes, edges }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        nodes: next.nodes,
        edges: next.edges,
        dirty: true,
        validated: false,
      })
    },

    markSaved: () => set({ dirty: false }),

    setIssues: (issues) => set({ issues, validated: true }),

    setConsole: (consoleOpen, consoleTab) =>
      set({ consoleOpen, ...(consoleTab ? { consoleTab } : {}) }),

    pushLog: (level, message) =>
      set({
        log: [
          ...get().log,
          { id: slugId('log'), at: new Date().toISOString(), level, message },
        ].slice(-200),
      }),

    clearRejection: () => set({ rejection: null }),
  }
})
