import { createClient } from '@/lib/supabase/client'
import type { Bot, BotGraph, BotStatus, BotVersion } from '@/mock/data'
import { CURRENT_GRAPH_SCHEMA_VERSION, emptyGraph } from '@/mock/data'
import { cloneGraph } from '@/lib/graph-utils'

export interface CreateBotInput {
  name?: string
  description?: string
  status?: BotStatus
  graph?: BotGraph
  visibility?: 'private' | 'unlisted' | 'public'
  tags?: string[]
}

export interface UpdateBotMetaInput {
  name?: string
  description?: string
  status?: BotStatus
  visibility?: 'private' | 'unlisted' | 'public'
  tags?: string[]
  headline_metric?: { label: string; value: string; positive: boolean }
  archived?: boolean
}

function mapBotRow(row: any, versions: BotVersion[] = []): Bot {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    status: row.status as BotStatus,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    tags: row.tags || [],
    graph: row.graph || emptyGraph(),
    headlineMetric: row.headline_metric || { label: 'Return, 90d', value: '0.0%', positive: true },
    visibility: row.visibility || 'private',
    archived: row.archived ?? false,
    versions: versions,
    runIds: [],
  }
}

import { BOTS } from '@/mock/data'

export async function listBots(includeArchived = false): Promise<Bot[]> {
  let dbBots: Bot[] = []
  try {
    const supabase = createClient()
    let query = supabase
      .from('bots')
      .select('*')
      .order('updated_at', { ascending: false })

    if (!includeArchived) {
      query = query.eq('archived', false)
    }

    const { data, error } = await query

    if (data && !error && data.length > 0) {
      dbBots = data.map((b) => mapBotRow(b))
    }
  } catch (e) {
    // Ignore error
  }

  const existingIds = new Set(dbBots.map((b) => b.id))
  const fallbackBots = includeArchived
    ? BOTS
    : BOTS.filter((b) => !b.archived)

  return [...dbBots, ...fallbackBots.filter((b) => !existingIds.has(b.id))]
}

export async function getBot(id: string): Promise<Bot | null> {
  try {
    const supabase = createClient()
    const { data: botRow, error: botError } = await supabase
      .from('bots')
      .select('*')
      .eq('id', id)
      .single()

    if (botRow && !botError) {
      const { data: versionRows } = await supabase
        .from('bot_versions')
        .select('*')
        .eq('bot_id', id)
        .order('created_at', { ascending: false })

      const versions: BotVersion[] = (versionRows || []).map((v) => ({
        id: v.id,
        label: v.label,
        createdAt: v.created_at,
        note: v.note || '',
        nodeCount: v.node_count,
        graph: v.graph,
      }))

      return mapBotRow(botRow, versions)
    }
  } catch (e) {
    // Ignore error
  }

  const fallback = BOTS.find((b) => b.id === id)
  return fallback || null
}

export async function createBot(input: CreateBotInput = {}): Promise<Bot> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User must be authenticated to create a bot')
  }

  const initialGraph = input.graph || emptyGraph()

  const { data, error } = await supabase
    .from('bots')
    .insert({
      user_id: user.id,
      name: input.name || 'Untitled bot',
      description: input.description || '',
      status: input.status || 'draft',
      graph: initialGraph,
      visibility: input.visibility || 'private',
      tags: input.tags || [],
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create bot')
  }

  return mapBotRow(data, [])
}

export async function updateBotGraph(id: string, graph: BotGraph): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('bots')
    .update({
      graph,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to update bot graph:', error)
    throw new Error(error.message)
  }
}

export async function updateBotMeta(id: string, meta: UpdateBotMetaInput): Promise<void> {
  const supabase = createClient()
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (meta.name !== undefined) payload.name = meta.name
  if (meta.description !== undefined) payload.description = meta.description
  if (meta.status !== undefined) payload.status = meta.status
  if (meta.visibility !== undefined) payload.visibility = meta.visibility
  if (meta.tags !== undefined) payload.tags = meta.tags
  if (meta.headline_metric !== undefined) payload.headline_metric = meta.headline_metric
  if (meta.archived !== undefined) payload.archived = meta.archived

  const { error } = await supabase
    .from('bots')
    .update(payload)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function deleteBot(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('bots').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

/**
 * Option A (preferred, minimal schema change):
 * Uses the dedicated `archived` boolean column on `public.bots`
 * via migration 0005_bot_archive.sql.
 */
export async function archiveBot(id: string): Promise<void> {
  await updateBotMeta(id, { archived: true })
}

export async function unarchiveBot(id: string): Promise<void> {
  await updateBotMeta(id, { archived: false })
}

export async function duplicateBotRemote(id: string): Promise<Bot> {
  const source = await getBot(id)
  if (!source) {
    throw new Error(`Bot ${id} not found`)
  }

  const clonedGraph = cloneGraph(source.graph)
  const newBot = await createBot({
    name: `${source.name} copy`,
    description: source.description,
    graph: clonedGraph,
    tags: [...source.tags],
    visibility: source.visibility,
  })

  return newBot
}

export async function saveBotVersion(id: string, label: string, note = ''): Promise<BotVersion> {
  const supabase = createClient()
  const bot = await getBot(id)
  if (!bot) {
    throw new Error('Bot not found')
  }

  const nodeCount = bot.graph?.nodes?.length || 0

  const { data, error } = await supabase
    .from('bot_versions')
    .insert({
      bot_id: id,
      label,
      note,
      node_count: nodeCount,
      graph: bot.graph,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save bot version')
  }

  return {
    id: data.id,
    label: data.label,
    createdAt: data.created_at,
    note: data.note || '',
    nodeCount: data.node_count,
    graph: data.graph,
  }
}

export async function restoreBotVersion(botId: string, versionId: string): Promise<void> {
  const bot = await getBot(botId)
  if (!bot) {
    throw new Error(`Bot ${botId} not found`)
  }

  const version = bot.versions.find((v) => v.id === versionId)
  if (!version) {
    throw new Error(`Version ${versionId} not found on bot ${botId}`)
  }

  // Deep clone graph to never restore by reference
  const clonedGraph = cloneGraph(version.graph)
  await updateBotGraph(botId, clonedGraph)

  // Save new version snapshot recording the restoration
  await saveBotVersion(botId, 'Restored', `Restored from ${version.label}`)
}
