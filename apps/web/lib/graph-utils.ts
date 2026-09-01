import type { Bot, BotGraph, BotNode, BotEdge, CanvasNote, CanvasFrame } from '@/mock/data'
import { slugId } from '@/lib/utils'
import { CURRENT_GRAPH_SCHEMA_VERSION } from '@/mock/data'
import { LAYERS } from '@/mock/layers'

/** Height of one layer lane in the canvas guide. */
const LANE_H = 208
const NODE_H = 92

function laneCenterY(index: number) {
  return index * LANE_H + (LANE_H - NODE_H) / 2
}

/**
 * Deep-clones a graph into a fully independent copy with new IDs, while
 * preserving every visual and semantic property EXACTLY:
 *  - x, y for every node, note — untouched, pixel-identical
 *  - x, y, w, h for every frame — untouched, pixel-identical
 *  - config, enabled, needsConfig for every node — deep-cloned, untouched values
 *  - text, color, kind, resolved for every note — untouched
 *  - label, hue for every frame — untouched
 *  - edge topology — preserved exactly, remapped through the new node IDs
 *
 * Only IDs change (nodes, edges, notes, frames all get fresh slugIds), because
 * IDs must be unique per-bot-instance to avoid collisions when the same
 * preset is forked by many users or duplicated multiple times by one user.
 * componentId on each node is NEVER changed — that's what makes the node
 * "the same kind of node," and it must survive the clone unchanged so the
 * cloned node still resolves to the right ComponentDef/FieldDef set.
 */
export function cloneGraph(source: BotGraph): BotGraph {
  const nodeIdMap = new Map<string, string>()
  for (const n of source.nodes) nodeIdMap.set(n.id, slugId('node'))

  const nodes: BotNode[] = source.nodes.map((n) => ({
    ...n,
    id: nodeIdMap.get(n.id)!,
    config: JSON.parse(JSON.stringify(n.config ?? {})),
    // x, y, componentId, enabled, needsConfig all pass through unchanged via ...n
  }))

  const edges: BotEdge[] = source.edges
    .filter((e) => {
      const valid = nodeIdMap.has(e.source) && nodeIdMap.has(e.target)
      if (!valid) {
        console.warn(`[cloneGraph] Dropped orphaned edge ${e.id} (source: ${e.source}, target: ${e.target})`)
      }
      return valid
    })
    .map((e) => ({
      id: slugId('edge'),
      source: nodeIdMap.get(e.source)!,
      target: nodeIdMap.get(e.target)!,
    }))

  const notes: CanvasNote[] = (source.notes ?? []).map((note) => ({
    ...note,
    id: slugId('note'),
    // x, y, text, color, kind, resolved, createdAt all pass through unchanged
  }))

  const frames: CanvasFrame[] = (source.frames ?? []).map((frame) => ({
    ...frame,
    id: slugId('frame'),
    // x, y, w, h, label, hue all pass through unchanged
  }))

  return {
    nodes,
    edges,
    notes,
    frames,
    schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
  }
}

/** Structural sanity check — every edge must reference nodes that exist. Used by import and by dev-time assertions. */
export function validateGraphIntegrity(graph: BotGraph): string[] {
  const problems: string[] = []
  const ids = new Set(graph.nodes.map((n) => n.id))
  for (const e of graph.edges) {
    if (!ids.has(e.source)) problems.push(`Edge ${e.id} references missing source node ${e.source}`)
    if (!ids.has(e.target)) problems.push(`Edge ${e.id} references missing target node ${e.target}`)
  }
  return problems
}

/**
 * Migrates a graph to the current schema version. Handles the legacy case
 * (schemaVersion missing or 1: y stored as lane index 0–9 instead of pixel offset).
 */
export function migrateGraph(graph: BotGraph): { graph: BotGraph; changed: boolean } {
  if (graph.schemaVersion >= CURRENT_GRAPH_SCHEMA_VERSION) {
    return {
      graph: {
        ...graph,
        notes: graph.notes ?? [],
        frames: graph.frames ?? [],
        schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
      },
      changed: false,
    }
  }

  const legacyPositions =
    graph.nodes.length > 0 &&
    graph.nodes.every((n) => Number.isInteger(n.y) && n.y >= 0 && n.y < LAYERS.length)

  const nodes = legacyPositions
    ? graph.nodes.map((n) => ({ ...n, y: laneCenterY(n.y) }))
    : graph.nodes

  const changed = legacyPositions || graph.schemaVersion < CURRENT_GRAPH_SCHEMA_VERSION

  return {
    graph: {
      ...graph,
      nodes,
      notes: graph.notes ?? [],
      frames: graph.frames ?? [],
      schemaVersion: CURRENT_GRAPH_SCHEMA_VERSION,
    },
    changed,
  }
}

export interface BotExport {
  exportVersion: 1
  exportedAt: string
  bot: {
    name: string
    description: string
    tags: string[]
  }
  graph: BotGraph
}

export function exportBot(bot: Bot): BotExport {
  return {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    bot: {
      name: bot.name,
      description: bot.description,
      tags: bot.tags,
    },
    graph: cloneGraph(bot.graph),
  }
}

export function downloadBotExport(bot: Bot) {
  const data = exportBot(bot)
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${bot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.aether.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Throws a descriptive error if the file isn't a valid Aether bot export. */
export function parseBotImport(raw: string): BotExport {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }

  const data = parsed as Partial<BotExport>
  if (data.exportVersion !== 1 || !data.graph || !Array.isArray(data.graph.nodes)) {
    throw new Error("That file doesn't look like an Aether bot export.")
  }

  // Ensure arrays are at least initialized
  const normalizedGraph: BotGraph = {
    nodes: data.graph.nodes || [],
    edges: data.graph.edges || [],
    notes: data.graph.notes || [],
    frames: data.graph.frames || [],
    schemaVersion: data.graph.schemaVersion ?? CURRENT_GRAPH_SCHEMA_VERSION,
  }

  const problems = validateGraphIntegrity(normalizedGraph)
  if (problems.length > 0) {
    throw new Error(`This export has structural problems: ${problems.join('; ')}`)
  }

  return {
    exportVersion: 1,
    exportedAt: data.exportedAt || new Date().toISOString(),
    bot: {
      name: data.bot?.name || 'Imported Bot',
      description: data.bot?.description || '',
      tags: Array.isArray(data.bot?.tags) ? data.bot.tags : ['imported'],
    },
    graph: normalizedGraph,
  }
}
