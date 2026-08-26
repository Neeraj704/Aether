import {
  COMPONENT_MAP,
  CONNECTION_RULES,
  LAYER_MAP,
  layerIndex,
  type LayerId,
  type PortType,
} from '@/mock/layers'
import type { BotEdge, BotNode } from '@/mock/data'
import { hasComponent, nodeLimitFor, type Access } from '@/lib/entitlements'

export type IssueLevel = 'error' | 'warning' | 'info'

export interface Issue {
  id: string
  level: IssueLevel
  title: string
  detail: string
  /** Clicking the issue in the Console selects and centres these. */
  nodeIds?: string[]
  edgeIds?: string[]
}

/** Do these two components share at least one compatible port type? */
export function portsCompatible(sourceId: string, targetId: string): PortType[] {
  const s = COMPONENT_MAP[sourceId]
  const t = COMPONENT_MAP[targetId]
  if (!s || !t) return []
  return s.outputs.filter((o) => t.inputs.includes(o))
}

/** Layer-order rule: a node may not feed a layer earlier than its own. */
function isBackwardEdge(from: LayerId, to: LayerId) {
  return layerIndex(to) < layerIndex(from)
}

function bannedRule(from: LayerId, to: LayerId) {
  return CONNECTION_RULES.find((r) => r.from === from && r.to === to)
}

/**
 * Pre-flight check for a single proposed connection. Used to reject a drag
 * before it lands, so the canvas never holds an illegal edge.
 */
export function canConnect(
  source: BotNode,
  target: BotNode,
): { ok: boolean; reason?: string } {
  const s = COMPONENT_MAP[source.componentId]
  const t = COMPONENT_MAP[target.componentId]
  if (!s || !t) return { ok: false, reason: 'Unknown component.' }
  if (source.id === target.id) return { ok: false, reason: 'A node cannot feed itself.' }

  const banned = bannedRule(s.layer, t.layer)
  if (banned) return { ok: false, reason: banned.reason }

  if (isBackwardEdge(s.layer, t.layer)) {
    return {
      ok: false,
      reason: `${LAYER_MAP[t.layer].name} runs before ${LAYER_MAP[s.layer].name} — signal only flows forward.`,
    }
  }

  if (portsCompatible(source.componentId, target.componentId).length === 0) {
    return {
      ok: false,
      reason: `${s.name} emits ${s.outputs.join('/') || 'nothing'}, but ${t.name} expects ${t.inputs.join('/') || 'nothing'}.`,
    }
  }

  return { ok: true }
}

/** Would adding this edge create a cycle? */
export function createsCycle(edges: BotEdge[], source: string, target: string) {
  const adj = new Map<string, string[]>()
  for (const e of [...edges, { id: 'probe', source, target }]) {
    adj.set(e.source, [...(adj.get(e.source) ?? []), e.target])
  }
  const seen = new Set<string>()
  const stack = new Set<string>()

  const walk = (id: string): boolean => {
    if (stack.has(id)) return true
    if (seen.has(id)) return false
    seen.add(id)
    stack.add(id)
    for (const next of adj.get(id) ?? []) if (walk(next)) return true
    stack.delete(id)
    return false
  }

  return walk(source)
}

/**
 * Full graph validation, driving the Console panel. Ordered so the most
 * blocking problems surface first.
 */
export function validateGraph(
  nodes: BotNode[],
  edges: BotEdge[],
  access: Access,
): Issue[] {
  const issues: Issue[] = []
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const active = nodes.filter((n) => n.enabled)

  if (nodes.length === 0) {
    return [
      {
        id: 'empty',
        level: 'error',
        title: 'The canvas is empty',
        detail: 'Drag a node from the library on the left to start building. Most bots begin with a price feed.',
      },
    ]
  }

  /* ---- Plan ceilings ---- */
  const limit = nodeLimitFor(access.plan)
  if (nodes.length > limit) {
    issues.push({
      id: 'node-limit',
      level: 'error',
      title: `Over the ${limit}-node limit for your plan`,
      detail: `This graph has ${nodes.length} nodes. Upgrade, or disable ${nodes.length - limit} of them.`,
    })
  }

  /* ---- Locked nodes ---- */
  for (const node of nodes) {
    if (!hasComponent(node.componentId, access)) {
      const comp = COMPONENT_MAP[node.componentId]
      issues.push({
        id: `locked-${node.id}`,
        level: 'error',
        title: `${comp?.name ?? node.componentId} is locked`,
        detail: `Unlock it with credits or move to the ${comp?.tier ?? 'paid'} plan before running this bot.`,
        nodeIds: [node.id],
      })
    }
  }

  /* ---- Unconfigured nodes ---- */
  for (const node of nodes) {
    if (node.needsConfig) {
      const comp = COMPONENT_MAP[node.componentId]
      issues.push({
        id: `config-${node.id}`,
        level: 'error',
        title: `${comp?.name ?? node.componentId} needs configuration`,
        detail: 'One or more required fields are still empty. Open the Inspector to fill them in.',
        nodeIds: [node.id],
      })
    }
  }

  /* ---- Structural layer coverage ---- */
  const layersPresent = new Set(active.map((n) => COMPONENT_MAP[n.componentId]?.layer))

  if (!layersPresent.has('data')) {
    issues.push({
      id: 'no-data',
      level: 'error',
      title: 'No data source',
      detail: 'Every bot needs at least one Layer I node — without a feed there is nothing to trade on.',
    })
  }
  if (!layersPresent.has('risk')) {
    issues.push({
      id: 'no-risk',
      level: 'error',
      title: 'No risk management',
      detail: 'Execution must sit behind at least one Layer VIII node. This is the layer that says no.',
    })
  }
  if (!layersPresent.has('execution')) {
    issues.push({
      id: 'no-exec',
      level: 'warning',
      title: 'No execution node',
      detail: 'The bot can produce signals but cannot act on them. Add a Layer IX node to place orders.',
    })
  }
  if (!layersPresent.has('monitoring')) {
    issues.push({
      id: 'no-monitor',
      level: 'info',
      title: 'Nothing is watching this bot',
      detail: 'A Layer X node gives you live P&L and a decision audit trail. Strongly recommended before going live.',
    })
  }

  /* ---- Edge legality ---- */
  for (const edge of edges) {
    const s = byId.get(edge.source)
    const t = byId.get(edge.target)
    if (!s || !t) {
      issues.push({
        id: `dangling-${edge.id}`,
        level: 'warning',
        title: 'Dangling connection',
        detail: 'This edge points at a node that no longer exists.',
        edgeIds: [edge.id],
      })
      continue
    }
    const check = canConnect(s, t)
    if (!check.ok) {
      issues.push({
        id: `edge-${edge.id}`,
        level: 'error',
        title: 'Invalid connection',
        detail: check.reason ?? 'These nodes cannot be wired together.',
        nodeIds: [s.id, t.id],
        edgeIds: [edge.id],
      })
    }
  }

  /* ---- Orphans ---- */
  const connected = new Set(edges.flatMap((e) => [e.source, e.target]))
  const orphans = active.filter((n) => !connected.has(n.id))
  if (orphans.length > 0) {
    issues.push({
      id: 'orphans',
      level: 'warning',
      title: `${orphans.length} node${orphans.length > 1 ? 's' : ''} not connected`,
      detail: 'Unwired nodes are ignored at runtime. Connect them or disable them to silence this.',
      nodeIds: orphans.map((n) => n.id),
    })
  }

  /* ---- Dead ends: signal that never reaches execution ---- */
  const execIds = new Set(
    active.filter((n) => COMPONENT_MAP[n.componentId]?.layer === 'execution').map((n) => n.id),
  )
  if (execIds.size > 0) {
    const reachesExec = new Set<string>()
    const incoming = new Map<string, string[]>()
    for (const e of edges) incoming.set(e.target, [...(incoming.get(e.target) ?? []), e.source])
    const queue = [...execIds]
    while (queue.length) {
      const id = queue.pop()!
      for (const prev of incoming.get(id) ?? []) {
        if (!reachesExec.has(prev)) {
          reachesExec.add(prev)
          queue.push(prev)
        }
      }
    }
    const deadEnds = active.filter(
      (n) => !execIds.has(n.id) && connected.has(n.id) && !reachesExec.has(n.id),
    )
    if (deadEnds.length > 0) {
      issues.push({
        id: 'dead-ends',
        level: 'info',
        title: `${deadEnds.length} node${deadEnds.length > 1 ? 's' : ''} never reach execution`,
        detail: 'These nodes compute something the bot never trades on. Useful for monitoring, wasteful otherwise.',
        nodeIds: deadEnds.map((n) => n.id),
      })
    }
  }

  const order: Record<IssueLevel, number> = { error: 0, warning: 1, info: 2 }
  return issues.sort((a, b) => order[a.level] - order[b.level])
}

export function issueCounts(issues: Issue[]) {
  return {
    errors: issues.filter((i) => i.level === 'error').length,
    warnings: issues.filter((i) => i.level === 'warning').length,
    infos: issues.filter((i) => i.level === 'info').length,
  }
}
