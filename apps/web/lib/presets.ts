import { createClient } from '@/lib/supabase/client'
import type { MyPreset, BotGraph } from '@/mock/data'
import { emptyGraph } from '@/mock/data'
import { cloneGraph } from '@/lib/graph-utils'
import { COMPONENT_MAP, type LayerId } from '@/mock/layers'

export interface CreatePresetInput {
  name: string
  description?: string
  visibility?: 'private' | 'unlisted' | 'public'
  graph?: BotGraph
  layers?: LayerId[]
}

export interface UpdatePresetMetaInput {
  name?: string
  description?: string
  visibility?: 'private' | 'unlisted' | 'public'
  publishedId?: string | null
}

function extractLayersFromGraph(graph?: BotGraph): LayerId[] {
  if (!graph?.nodes) return []
  return Array.from(
    new Set(
      graph.nodes
        .map((n) => COMPONENT_MAP[n.componentId]?.layer)
        .filter((l): l is LayerId => Boolean(l)),
    ),
  )
}

function mapPresetRow(
  row: any,
  versions: { id: string; label: string; createdAt: string; note: string }[] = [],
): MyPreset {
  const graph = row.graph || emptyGraph()
  const layers = (row.layers && row.layers.length > 0)
    ? (row.layers as LayerId[])
    : extractLayersFromGraph(graph)

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    createdAt: row.created_at,
    visibility: (row.visibility || 'private') as 'private' | 'unlisted' | 'public',
    nodeCount: row.node_count ?? graph.nodes?.length ?? 0,
    layers,
    publishedId: row.published_id || undefined,
    graph,
    versions,
  }
}

export async function listMyPresets(): Promise<MyPreset[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('presets')
    .select(`
      *,
      preset_versions (
        id,
        label,
        note,
        created_at
      )
    `)
    .order('updated_at', { ascending: false })

  if (error || !data) {
    console.error('Error fetching presets:', error)
    return []
  }

  return data.map((row) => {
    const versions = (row.preset_versions || []).map((v: any) => ({
      id: v.id,
      label: v.label,
      createdAt: v.created_at,
      note: v.note || '',
    })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return mapPresetRow(row, versions)
  })
}

export async function getPreset(id: string): Promise<MyPreset | null> {
  const supabase = createClient()
  const { data: row, error } = await supabase
    .from('presets')
    .select(`
      *,
      preset_versions (
        id,
        label,
        note,
        created_at,
        graph
      )
    `)
    .eq('id', id)
    .single()

  if (error || !row) {
    return null
  }

  const versions = (row.preset_versions || []).map((v: any) => ({
    id: v.id,
    label: v.label,
    createdAt: v.created_at,
    note: v.note || '',
  })).sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return mapPresetRow(row, versions)
}

export async function createPreset(input: CreatePresetInput): Promise<MyPreset> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('User must be authenticated to create a preset')
  }

  const initialGraph = input.graph ? cloneGraph(input.graph) : emptyGraph()
  const layers = input.layers || extractLayersFromGraph(initialGraph)
  const nodeCount = initialGraph.nodes?.length ?? 0

  const { data, error } = await supabase
    .from('presets')
    .insert({
      owner_id: user.id,
      name: input.name?.trim() || 'Untitled Preset',
      description: input.description || '',
      visibility: input.visibility || 'private',
      graph: initialGraph,
      node_count: nodeCount,
      layers,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create preset')
  }

  // Create initial v1 version snapshot
  try {
    await supabase.from('preset_versions').insert({
      preset_id: data.id,
      label: 'v1',
      note: 'Initial save',
      graph: initialGraph,
    })
  } catch (verErr) {
    console.warn('Initial preset version creation notice:', verErr)
  }

  return mapPresetRow(data, [
    {
      id: `${data.id}-v1`,
      label: 'v1',
      createdAt: data.created_at,
      note: 'Initial save',
    },
  ])
}

export async function updatePresetGraph(id: string, graph: BotGraph): Promise<void> {
  const supabase = createClient()
  const layers = extractLayersFromGraph(graph)
  const nodeCount = graph.nodes?.length ?? 0

  const { error } = await supabase
    .from('presets')
    .update({
      graph,
      layers,
      node_count: nodeCount,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) {
    console.error('Failed to update preset graph:', error)
    throw new Error(error.message)
  }
}

export async function updatePresetMeta(id: string, meta: UpdatePresetMetaInput): Promise<void> {
  const supabase = createClient()
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  }

  if (meta.name !== undefined) payload.name = meta.name.trim()
  if (meta.description !== undefined) payload.description = meta.description
  if (meta.visibility !== undefined) payload.visibility = meta.visibility
  if (meta.publishedId !== undefined) payload.published_id = meta.publishedId

  const { error } = await supabase
    .from('presets')
    .update(payload)
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function duplicatePreset(id: string): Promise<MyPreset> {
  const source = await getPreset(id)
  if (!source) {
    throw new Error(`Preset ${id} not found`)
  }

  const clonedGraph = cloneGraph(source.graph)
  const newPreset = await createPreset({
    name: `${source.name} (Copy)`,
    description: source.description,
    graph: clonedGraph,
    layers: [...source.layers],
    visibility: source.visibility,
  })

  return newPreset
}

export async function deletePreset(id: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('presets').delete().eq('id', id)

  if (error) {
    throw new Error(error.message)
  }
}

export async function savePresetVersion(
  id: string,
  label: string,
  note = '',
): Promise<{ id: string; label: string; createdAt: string; note: string }> {
  const supabase = createClient()
  const preset = await getPreset(id)
  if (!preset) {
    throw new Error('Preset not found')
  }

  const { data, error } = await supabase
    .from('preset_versions')
    .insert({
      preset_id: id,
      label,
      note,
      graph: preset.graph,
    })
    .select()
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Failed to save preset version')
  }

  return {
    id: data.id,
    label: data.label,
    createdAt: data.created_at,
    note: data.note || '',
  }
}

export async function restorePresetVersion(id: string, versionId: string): Promise<void> {
  const supabase = createClient()
  const { data: versionRow, error } = await supabase
    .from('preset_versions')
    .select('*')
    .eq('id', versionId)
    .eq('preset_id', id)
    .single()

  if (error || !versionRow) {
    throw new Error(`Version ${versionId} not found for preset ${id}`)
  }

  const clonedGraph = cloneGraph(versionRow.graph)
  await updatePresetGraph(id, clonedGraph)

  // Record restoration as new version
  await savePresetVersion(id, 'Restored', `Restored from ${versionRow.label}`)
}
