import { createClient } from '@/lib/supabase/client'
import type { Bot, BotGraph, BotStatus, BotVersion } from '@/mock/data'
import { CURRENT_GRAPH_SCHEMA_VERSION, emptyGraph } from '@/mock/data'

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
    versions: versions,
    runIds: [],
  }
}

export async function listBots(): Promise<Bot[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('bots')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching bots:', error)
    return []
  }

  return data.map((b) => mapBotRow(b))
}

export async function getBot(id: string): Promise<Bot | null> {
  const supabase = createClient()
  const { data: botRow, error: botError } = await supabase
    .from('bots')
    .select('*')
    .eq('id', id)
    .single()

  if (botError || !botRow) {
    return null
  }

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
