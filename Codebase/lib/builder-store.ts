'use client'

import { create } from 'zustand'
import { COMPONENT_MAP, LAYERS, type LayerId } from '@/mock/layers'
import type { BotEdge, BotNode, CanvasFrame, CanvasNote } from '@/mock/data'
import { computeNeedsConfig, makeNode } from '@/lib/workspace-store'
import { canConnect, createsCycle, type Issue } from '@/lib/validate'
import { slugId } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Canvas geometry                                                     */
/* ------------------------------------------------------------------ */

export const NODE_W = 240
export const NODE_H = 92
/** Height of one layer lane in the optional lane guide. */
export const LANE_H = 208
export const GRID = 8
export const LANE_LABEL_W = 168

export interface LaneLayout {
  layer: LayerId
  top: number
  height: number
}

export function computeLanes(): LaneLayout[] {
  return LAYERS.map((l, i) => ({ layer: l.id, top: i * LANE_H, height: LANE_H }))
}

/** Vertical centre of a lane, used by auto-layout and lane snapping. */
export function laneCenterY(index: number) {
  return index * LANE_H + (LANE_H - NODE_H) / 2
}

export function laneAtY(y: number) {
  const i = Math.max(0, Math.min(LAYERS.length - 1, Math.floor((y + NODE_H / 2) / LANE_H)))
  return LAYERS[i].id
}

export const CANVAS_HEIGHT = LAYERS.length * LANE_H

const snapTo = (v: number, on: boolean) => (on ? Math.round(v / GRID) * GRID : Math.round(v))

/* ------------------------------------------------------------------ */
/* Tools + view preferences                                            */
/* ------------------------------------------------------------------ */

export type ToolId = 'select' | 'hand' | 'connect' | 'note' | 'comment' | 'frame'
export type GridMode = 'dots' | 'lines' | 'off'
export type EdgeKind = 'bezier' | 'smooth' | 'straight'

export interface ViewPrefs {
  grid: GridMode
  snap: boolean
  lanes: boolean
  minimap: boolean
  edgeKind: EdgeKind
  animateEdges: boolean
}

/* ------------------------------------------------------------------ */
/* History                                                             */
/* ------------------------------------------------------------------ */

interface Snapshot {
  nodes: BotNode[]
  edges: BotEdge[]
  notes: CanvasNote[]
  frames: CanvasFrame[]
}

const HISTORY_LIMIT = 80

export type ConsoleTab = 'issues' | 'log'
export type AlignMode = 'left' | 'center-h' | 'right' | 'top' | 'middle' | 'bottom'

export const NOTE_COLORS = ['amber', 'blue', 'green', 'pink', 'slate'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

export const NOTE_HUES: Record<NoteColor, string> = {
  amber: '#f0b429',
  blue: '#2997ff',
  green: '#30d158',
  pink: '#ff6ac1',
  slate: '#8e8e93',
}

interface BuilderState extends Snapshot {
  botId: string | null
  selection: string[]
  selectedEdges: string[]
  tool: ToolId
  view: ViewPrefs
  collapsedLayers: LayerId[]
  dirty: boolean
  past: Snapshot[]
  future: Snapshot[]
  clipboard: Snapshot | null

  issues: Issue[]
  validated: boolean
  consoleOpen: boolean
  consoleTab: ConsoleTab
  log: { id: string; at: string; level: 'info' | 'warn' | 'error'; message: string }[]

  rejection: string | null
  /** Bumped whenever selection/positions are driven from outside the canvas. */
  focusToken: number

  load: (
    botId: string,
    nodes: BotNode[],
    edges: BotEdge[],
    notes?: CanvasNote[],
    frames?: CanvasFrame[],
  ) => void

  setTool: (tool: ToolId) => void
  setView: (patch: Partial<ViewPrefs>) => void

  addNode: (componentId: string, x: number, y: number) => string | null
  addBlock: (nodes: BotNode[], edges: BotEdge[], at?: { x: number; y: number }) => void
  moveNodes: (moves: { id: string; x: number; y: number }[]) => void
  updatePositionsLive: (moves: { id: string; x: number; y: number }[]) => void
  nudgeSelection: (dx: number, dy: number) => void
  removeNodes: (ids: string[]) => void
  duplicateSelection: () => void
  copySelection: () => void
  paste: (at?: { x: number; y: number }) => void
  setEnabled: (ids: string[], enabled: boolean) => void
  updateConfig: (id: string, key: string, value: unknown) => void

  connect: (source: string, target: string) => boolean
  disconnect: (edgeIds: string[]) => void

  addNote: (kind: CanvasNote['kind'], x: number, y: number) => string
  updateNote: (id: string, patch: Partial<CanvasNote>) => void
  moveNote: (id: string, x: number, y: number) => void
  removeNote: (id: string) => void

  addFrame: (x: number, y: number) => string
  updateFrame: (id: string, patch: Partial<CanvasFrame>) => void
  removeFrame: (id: string) => void

  setSelection: (ids: string[]) => void
  setSelectedEdges: (ids: string[]) => void
  selectAll: () => void
  focusNodes: (ids: string[]) => void
  toggleLayer: (layer: LayerId) => void

  align: (mode: AlignMode) => void
  distribute: (axis: 'h' | 'v') => void
  tidyUp: () => void

  undo: () => void
  redo: () => void
  markSaved: () => void
  setIssues: (issues: Issue[]) => void
  setConsole: (open: boolean, tab?: ConsoleTab) => void
  pushLog: (level: 'info' | 'warn' | 'error', message: string) => void
  clearRejection: () => void
}

/**
 * Older fixtures stored `y` as a layer index (0-9) rather than a pixel offset.
 * Anything that small can only be an index, so it is promoted to lane space.
 */
function migratePositions(nodes: BotNode[]): BotNode[] {
  const legacy =
    nodes.length > 0 && nodes.every((n) => Number.isInteger(n.y) && n.y >= 0 && n.y < LAYERS.length)
  if (!legacy) return nodes
  return nodes.map((n) => ({ ...n, y: laneCenterY(n.y) }))
}

export const useBuilder = create<BuilderState>((set, get) => {
  /** Pushes the current graph onto the undo stack before a mutation. */
  const commit = (next: Partial<Snapshot>) => {
    const { nodes, edges, notes, frames, past } = get()
    set({
      past: [...past, { nodes, edges, notes, frames }].slice(-HISTORY_LIMIT),
      future: [],
      dirty: true,
      validated: false,
      ...next,
    })
  }

  const snap = (v: number) => snapTo(v, get().view.snap)

  return {
    botId: null,
    nodes: [],
    edges: [],
    notes: [],
    frames: [],
    selection: [],
    selectedEdges: [],
    tool: 'select',
    view: {
      grid: 'dots',
      snap: true,
      lanes: false,
      minimap: true,
      edgeKind: 'bezier',
      animateEdges: true,
    },
    collapsedLayers: [],
    dirty: false,
    past: [],
    future: [],
    clipboard: null,
    issues: [],
    validated: false,
    consoleOpen: false,
    consoleTab: 'issues',
    log: [],
    rejection: null,
    focusToken: 0,

    load: (botId, nodes, edges, notes = [], frames = []) =>
      set({
        botId,
        nodes: migratePositions(nodes),
        edges,
        notes,
        frames,
        selection: [],
        selectedEdges: [],
        tool: 'select',
        dirty: false,
        past: [],
        future: [],
        issues: [],
        validated: false,
        focusToken: get().focusToken + 1,
        log: [
          {
            id: slugId('log'),
            at: new Date().toISOString(),
            level: 'info',
            message: `Loaded graph — ${nodes.length} nodes, ${edges.length} connections.`,
          },
        ],
      }),

    setTool: (tool) => set({ tool }),

    setView: (patch) => set({ view: { ...get().view, ...patch } }),

    addNode: (componentId, x, y) => {
      const comp = COMPONENT_MAP[componentId]
      if (!comp) return null
      const node = makeNode(componentId, snap(x), snap(y))
      commit({ nodes: [...get().nodes, node] })
      set({ selection: [node.id], selectedEdges: [], focusToken: get().focusToken + 1 })
      get().pushLog('info', `Added ${comp.name}.`)
      return node.id
    },

    addBlock: (nodes, edges, at) => {
      // Re-key so a block can be dropped repeatedly without id collisions.
      const map = new Map(nodes.map((n) => [n.id, slugId('n')]))
      const migrated = migratePositions(nodes)
      const minX = Math.min(...migrated.map((n) => n.x))
      const minY = Math.min(...migrated.map((n) => n.y))
      const dx = at ? snap(at.x) - minX : 40
      const dy = at ? snap(at.y) - minY : 40

      const fresh = migrated.map((n) => ({
        ...n,
        id: map.get(n.id)!,
        x: snap(n.x + dx),
        y: snap(n.y + dy),
      }))
      const freshEdges = edges
        .filter((e) => map.has(e.source) && map.has(e.target))
        .map((e) => ({ id: slugId('e'), source: map.get(e.source)!, target: map.get(e.target)! }))

      commit({ nodes: [...get().nodes, ...fresh], edges: [...get().edges, ...freshEdges] })
      set({ selection: fresh.map((n) => n.id), focusToken: get().focusToken + 1 })
      get().pushLog('info', `Inserted a block of ${fresh.length} nodes.`)
    },

    moveNodes: (moves) => {
      const lookup = new Map(moves.map((m) => [m.id, m]))
      commit({
        nodes: get().nodes.map((n) => {
          const m = lookup.get(n.id)
          return m ? { ...n, x: snap(m.x), y: snap(m.y) } : n
        }),
      })
    },

    updatePositionsLive: (moves) => {
      if (moves.length === 0) return
      const lookup = new Map(moves.map((m) => [m.id, m]))
      const snapFn = (v: number) => snapTo(v, get().view.snap)
      const noteIds = new Set(get().notes.map((n) => n.id))
      const frameIds = new Set(get().frames.map((f) => f.id))

      set({
        nodes: get().nodes.map((n) => {
          const m = lookup.get(n.id)
          return m && !noteIds.has(n.id) && !frameIds.has(n.id)
            ? { ...n, x: snapFn(m.x), y: snapFn(m.y) }
            : n
        }),
        notes: get().notes.map((n) => {
          const m = lookup.get(n.id)
          return m ? { ...n, x: snapFn(m.x), y: snapFn(m.y) } : n
        }),
        frames: get().frames.map((f) => {
          const m = lookup.get(f.id)
          return m ? { ...f, x: snapFn(m.x), y: snapFn(m.y) } : f
        }),
      })
    },

    nudgeSelection: (dx, dy) => {
      const { nodes, selection } = get()
      if (selection.length === 0) return
      commit({
        nodes: nodes.map((n) =>
          selection.includes(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n,
        ),
      })
      set({ focusToken: get().focusToken + 1 })
    },

    removeNodes: (ids) => {
      if (ids.length === 0) return
      const dead = new Set(ids)
      commit({
        nodes: get().nodes.filter((n) => !dead.has(n.id)),
        edges: get().edges.filter((e) => !dead.has(e.source) && !dead.has(e.target)),
      })
      set({ selection: [] })
      get().pushLog('info', `Removed ${ids.length} node${ids.length > 1 ? 's' : ''}.`)
    },

    duplicateSelection: () => {
      const { nodes, edges, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id))
      if (picked.length === 0) return
      const map = new Map(picked.map((n) => [n.id, slugId('n')]))
      const copies = picked.map((n) => ({ ...n, id: map.get(n.id)!, x: n.x + 32, y: n.y + 32 }))
      const copiedEdges = edges
        .filter((e) => map.has(e.source) && map.has(e.target))
        .map((e) => ({ id: slugId('e'), source: map.get(e.source)!, target: map.get(e.target)! }))
      commit({ nodes: [...nodes, ...copies], edges: [...edges, ...copiedEdges] })
      set({ selection: copies.map((c) => c.id), focusToken: get().focusToken + 1 })
    },

    copySelection: () => {
      const { nodes, edges, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id))
      if (picked.length === 0) return
      const ids = new Set(selection)
      set({
        clipboard: {
          nodes: picked,
          edges: edges.filter((e) => ids.has(e.source) && ids.has(e.target)),
          notes: [],
          frames: [],
        },
      })
      get().pushLog('info', `Copied ${picked.length} node${picked.length > 1 ? 's' : ''}.`)
    },

    paste: (at) => {
      const clip = get().clipboard
      if (!clip || clip.nodes.length === 0) return
      get().addBlock(clip.nodes, clip.edges, at)
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
      if (source === target) return false
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

    disconnect: (edgeIds) => {
      if (edgeIds.length === 0) return
      commit({ edges: get().edges.filter((e) => !edgeIds.includes(e.id)) })
      set({ selectedEdges: [] })
    },

    /* ---------------- Annotations ---------------- */

    addNote: (kind, x, y) => {
      const note: CanvasNote = {
        id: slugId('note'),
        kind,
        x: snap(x),
        y: snap(y),
        text: '',
        color: kind === 'comment' ? 'blue' : 'amber',
        createdAt: new Date().toISOString(),
      }
      commit({ notes: [...get().notes, note] })
      set({ tool: 'select' })
      return note.id
    },

    updateNote: (id, patch) =>
      commit({ notes: get().notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }),

    moveNote: (id, x, y) =>
      commit({
        notes: get().notes.map((n) => (n.id === id ? { ...n, x: snap(x), y: snap(y) } : n)),
      }),

    removeNote: (id) => commit({ notes: get().notes.filter((n) => n.id !== id) }),

    addFrame: (x, y) => {
      const frame: CanvasFrame = {
        id: slugId('frame'),
        x: snap(x),
        y: snap(y),
        w: 640,
        h: 320,
        label: 'Section',
        hue: '#2997ff',
      }
      commit({ frames: [...get().frames, frame] })
      set({ tool: 'select' })
      return frame.id
    },

    updateFrame: (id, patch) =>
      commit({ frames: get().frames.map((f) => (f.id === id ? { ...f, ...patch } : f)) }),

    removeFrame: (id) => commit({ frames: get().frames.filter((f) => f.id !== id) }),

    /* ---------------- Selection ---------------- */

    setSelection: (selection) => set({ selection }),
    setSelectedEdges: (selectedEdges) => set({ selectedEdges }),

    selectAll: () =>
      set({ selection: get().nodes.map((n) => n.id), focusToken: get().focusToken + 1 }),

    focusNodes: (ids) => {
      // Expand any collapsed layer holding a focused node, else it stays hidden.
      const layers = new Set(
        ids.map((id) => {
          const node = get().nodes.find((n) => n.id === id)
          return node ? COMPONENT_MAP[node.componentId]?.layer : undefined
        }),
      )
      set({
        selection: ids,
        selectedEdges: [],
        focusToken: get().focusToken + 1,
        collapsedLayers: get().collapsedLayers.filter((l) => !layers.has(l)),
      })
    },

    toggleLayer: (layer) => {
      const current = get().collapsedLayers
      set({
        collapsedLayers: current.includes(layer)
          ? current.filter((l) => l !== layer)
          : [...current, layer],
      })
    },

    /* ---------------- Arrangement ---------------- */

    align: (mode) => {
      const { nodes, selection } = get()
      const picked = nodes.filter((n) => selection.includes(n.id))
      if (picked.length < 2) return

      const xs = picked.map((n) => n.x)
      const ys = picked.map((n) => n.y)
      const avg = (list: number[]) => list.reduce((a, b) => a + b, 0) / list.length

      const patch = (n: BotNode): BotNode => {
        switch (mode) {
          case 'left':
            return { ...n, x: Math.min(...xs) }
          case 'right':
            return { ...n, x: Math.max(...xs) }
          case 'center-h':
            return { ...n, x: Math.round(avg(xs)) }
          case 'top':
            return { ...n, y: Math.min(...ys) }
          case 'bottom':
            return { ...n, y: Math.max(...ys) }
          case 'middle':
            return { ...n, y: Math.round(avg(ys)) }
        }
      }

      commit({ nodes: nodes.map((n) => (selection.includes(n.id) ? patch(n) : n)) })
      set({ focusToken: get().focusToken + 1 })
    },

    distribute: (axis) => {
      const { nodes, selection } = get()
      const key = axis === 'h' ? 'x' : 'y'
      const picked = nodes
        .filter((n) => selection.includes(n.id))
        .sort((a, b) => a[key] - b[key])
      if (picked.length < 3) return
      const first = picked[0][key]
      const last = picked[picked.length - 1][key]
      const gap = (last - first) / (picked.length - 1)
      const positions = new Map(picked.map((n, i) => [n.id, Math.round(first + gap * i)]))
      commit({
        nodes: nodes.map((n) =>
          positions.has(n.id) ? { ...n, [key]: positions.get(n.id)! } : n,
        ),
      })
      set({ focusToken: get().focusToken + 1 })
    },

    /** Snaps every node into its layer lane and spaces siblings evenly. */
    tidyUp: () => {
      const { nodes } = get()
      const byLayer = new Map<LayerId, BotNode[]>()
      for (const n of nodes) {
        const layer = COMPONENT_MAP[n.componentId]?.layer ?? 'data'
        byLayer.set(layer, [...(byLayer.get(layer) ?? []), n])
      }
      const next: BotNode[] = []
      LAYERS.forEach((layer, index) => {
        const row = (byLayer.get(layer.id) ?? []).sort((a, b) => a.x - b.x)
        row.forEach((n, i) => {
          next.push({ ...n, x: LANE_LABEL_W + i * (NODE_W + 56), y: laneCenterY(index) })
        })
      })
      // Preserve original array order so React Flow keys stay stable.
      const lookup = new Map(next.map((n) => [n.id, n]))
      commit({ nodes: nodes.map((n) => lookup.get(n.id) ?? n) })
      set({ focusToken: get().focusToken + 1 })
      get().pushLog('info', 'Tidied the canvas by layer.')
    },

    /* ---------------- History ---------------- */

    undo: () => {
      const { past, future, nodes, edges, notes, frames } = get()
      const prev = past[past.length - 1]
      if (!prev) return
      set({
        past: past.slice(0, -1),
        future: [{ nodes, edges, notes, frames }, ...future].slice(0, HISTORY_LIMIT),
        ...prev,
        dirty: true,
        validated: false,
        focusToken: get().focusToken + 1,
      })
    },

    redo: () => {
      const { past, future, nodes, edges, notes, frames } = get()
      const next = future[0]
      if (!next) return
      set({
        past: [...past, { nodes, edges, notes, frames }].slice(-HISTORY_LIMIT),
        future: future.slice(1),
        ...next,
        dirty: true,
        validated: false,
        focusToken: get().focusToken + 1,
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
