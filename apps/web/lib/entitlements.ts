import { COMPONENT_MAP, type ComponentDef, type PlanTier } from '@/mock/layers'

export const TIER_RANK: Record<PlanTier, number> = { free: 0, starter: 1, pro: 2 }

/** Node-count ceiling per plan, surfaced in the Builder header and paywalls. */
export const NODE_LIMIT: Record<PlanTier, number> = { free: 8, starter: 25, pro: Infinity }

/** Concurrent live bots allowed per plan. */
export const LIVE_LIMIT: Record<PlanTier, number> = { free: 0, starter: 1, pro: 5 }

/** Monthly simulation credit grant per plan. */
export const CREDIT_GRANT: Record<PlanTier, number> = { free: 20, starter: 120, pro: 400 }

/** Monthly backtest simulation runs allowed per plan. */
export const MONTHLY_BACKTEST_LIMIT: Record<PlanTier, number> = { free: 10, starter: 150, pro: Infinity }

export interface Access {
  plan: PlanTier
  unlocked: string[]
}

/**
 * A component is usable when the plan covers its tier, or the user bought it
 * outright with credits. Free components are always available.
 */
export function hasComponent(componentId: string, { plan, unlocked }: Access) {
  const comp = COMPONENT_MAP[componentId]
  if (!comp) return false
  if (comp.tier === 'free') return true
  if (unlocked.includes(componentId)) return true
  return TIER_RANK[plan] >= TIER_RANK[comp.tier]
}

export function isLocked(comp: ComponentDef, access: Access) {
  return !hasComponent(comp.id, access)
}

/** Cheapest plan that would grant this component without spending credits. */
export function requiredPlan(comp: ComponentDef): PlanTier {
  return comp.tier
}

export function nodeLimitFor(plan: PlanTier) {
  return NODE_LIMIT[plan]
}

/** Credits charged for a simulation, scaled by run type and graph size. */
export function creditCost(type: string, nodeCount: number) {
  const base =
    type === 'monte-carlo' ? 12 : type === 'walk-forward' ? 8 : type === 'ab' ? 10 : 4
  return base + Math.ceil(nodeCount / 6)
}
