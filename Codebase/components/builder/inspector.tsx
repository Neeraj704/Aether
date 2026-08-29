'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  AlignCenterHorizontal,
  AlignStartVertical,
  AlignEndVertical,
  BookOpen,
  Copy,
  Lock,
  Package,
  Rows3,
  Trash2,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react'
import {
  COMPONENT_MAP,
  LAYER_MAP,
  PORT_COLORS,
  type ComponentDef,
  type FieldDef,
} from '@/mock/layers'
import type { BotNode } from '@/mock/data'
import { useBuilder } from '@/lib/builder-store'
import { hasComponent } from '@/lib/entitlements'
import { useSession } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge, TierBadge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { FieldRenderer } from '@/components/builder/field-renderer'
import { DeepCustomizationDialog } from '@/components/builder/deep-customization-dialog'
import { cn } from '@/lib/utils'

function PortList({ label, types }: { label: string; types: string[] }) {
  if (types.length === 0) return null
  return (
    <div className="flex items-baseline gap-2">
      <span className="w-14 shrink-0 text-[11px] text-tertiary">{label}</span>
      <span className="flex flex-wrap gap-1">
        {types.map((t) => (
          <span
            key={t}
            className="flex items-center gap-1 rounded-[var(--radius-pill)] px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              background: `${PORT_COLORS[t as keyof typeof PORT_COLORS]}1a`,
              color: PORT_COLORS[t as keyof typeof PORT_COLORS],
            }}
          >
            {t}
          </span>
        ))}
      </span>
    </div>
  )
}

/** Shown when 2+ nodes are selected: bulk ops instead of config. */
function MultiSelectPanel({
  count,
  onSaveBlock,
}: {
  count: number
  onSaveBlock: () => void
}) {
  const { align, distribute, duplicateSelection, removeNodes, setEnabled, selection } =
    useBuilder()

  return (
    <div className="flex flex-col gap-4 p-4">
      <div>
        <p className="text-sm font-medium">{count} nodes selected</p>
        <p className="mt-0.5 text-xs text-tertiary">
          Alignment and bulk actions apply to all of them.
        </p>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium tracking-wide text-tertiary uppercase">Align</p>
        <div className="flex gap-1">
          <Tooltip content="Align left">
            <Button variant="outline" size="icon-sm" onClick={() => align('left')}>
              <AlignStartVertical />
              <span className="sr-only">Align left</span>
            </Button>
          </Tooltip>
          <Tooltip content="Align centre">
            <Button variant="outline" size="icon-sm" onClick={() => align('center-h')}>
              <AlignCenterHorizontal />
              <span className="sr-only">Align centre</span>
            </Button>
          </Tooltip>
          <Tooltip content="Align right">
            <Button variant="outline" size="icon-sm" onClick={() => align('right')}>
              <AlignEndVertical />
              <span className="sr-only">Align right</span>
            </Button>
          </Tooltip>
          <Tooltip content="Distribute evenly">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={count < 3}
              onClick={() => distribute('h')}
            >
              <Rows3 />
              <span className="sr-only">Distribute evenly</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <Button variant="outline" size="sm" onClick={onSaveBlock}>
          <Package data-icon="inline-start" />
          Save as block
        </Button>
        <Button variant="outline" size="sm" onClick={duplicateSelection}>
          <Copy data-icon="inline-start" />
          Duplicate
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setEnabled(selection, false)}
          >
            Disable
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => setEnabled(selection, true)}
          >
            Enable
          </Button>
        </div>
        <Button variant="destructive" size="sm" onClick={() => removeNodes(selection)}>
          <Trash2 data-icon="inline-start" />
          Delete {count} nodes
        </Button>
      </div>
    </div>
  )
}

function SingleNodePanel({
  node,
  comp,
  onUnlockRequest,
}: {
  node: BotNode
  comp: ComponentDef
  onUnlockRequest: (comp: ComponentDef) => void
}) {
  const { updateConfig, setEnabled, removeNodes, duplicateSelection, edges, nodes } = useBuilder()
  const { plan, unlocked, onboarding } = useSession()
  const locked = !hasComponent(comp.id, { plan, unlocked })
  const layer = LAYER_MAP[comp.layer]
  const [deepCustomizationOpen, setDeepCustomizationOpen] = useState(false)

  // Compute incoming variables
  const incomingEdges = edges.filter((e) => e.target === node.id)
  const userLabels = (node.config?.__inputLabels as Record<string, string>) || {}
  const availableVariables = incomingEdges.map((e) => {
    const srcNode = nodes.find((n) => n.id === e.source)
    const srcComp = srcNode ? COMPONENT_MAP[srcNode.componentId] : null
    const defaultLabel = srcComp ? srcComp.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') : 'input'
    const customLabel = userLabels[e.source] || defaultLabel
    return {
      id: e.source,
      label: srcComp ? srcComp.name : e.source,
      name: customLabel,
    }
  })

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="mb-2 flex items-center gap-2">
          <span
            className="tabular flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[10px] font-semibold"
            style={{ background: `${layer.hue}1f`, color: layer.hue }}
          >
            {layer.roman}
          </span>
          <TierBadge tier={comp.tier} />
          {node.needsConfig ? <Badge variant="warning">Needs config</Badge> : null}
          {!node.enabled ? <Badge variant="outline">Disabled</Badge> : null}
        </div>
        <h2 className="text-sm font-semibold text-balance">{comp.name}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{comp.description}</p>

        <div className="mt-3 flex flex-col gap-1.5">
          <PortList label="Accepts" types={comp.inputs} />
          <PortList label="Emits" types={comp.outputs} />
        </div>
      </div>

      {locked ? (
        <div className="border-b border-border bg-warning/6 p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-medium text-warning">
            <Lock className="size-3.5" />
            This node is locked
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            It stays on the canvas but will not run until you unlock it.
          </p>
          <Button size="sm" className="mt-3 w-full" onClick={() => onUnlockRequest(comp)}>
            Unlock {comp.name}
          </Button>
        </div>
      ) : null}

      <div className="no-scrollbar flex-1 overflow-y-auto">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[13px] font-medium">Node enabled</p>
              <p className="mt-0.5 text-xs text-tertiary">Disabled nodes are skipped at runtime.</p>
            </div>
            <Switch
              checked={node.enabled}
              onCheckedChange={(v) => setEnabled([node.id], v)}
              className="shrink-0"
            />
          </div>

          {comp.fields.length > 0 ? (
            <>
              <Separator />
              <p className="text-[11px] font-medium tracking-wide text-tertiary uppercase">
                Core Parameters
              </p>
              {comp.fields.map((field) => (
                <FieldRenderer
                  key={field.key}
                  field={field}
                  value={node.config[field.key]}
                  disabled={locked}
                  onChange={(v) => updateConfig(node.id, field.key, v)}
                  availableVariables={availableVariables}
                />
              ))}
            </>
          ) : (
            <p className="text-xs text-tertiary">This node has no basic parameters.</p>
          )}

          <Separator />

          {/* Deep Customization Action */}
          <Button
            variant={onboarding.experience === 'beginner' ? 'outline' : 'secondary'}
            size="sm"
            className="w-full gap-2 border border-border"
            onClick={() => setDeepCustomizationOpen(true)}
          >
            <SlidersHorizontal className="size-3.5 text-brand" />
            Deep Customization
          </Button>

          <div className="rounded-[var(--radius-md)] bg-secondary p-3">
            <p className="text-[11px] font-medium tracking-wide text-tertiary uppercase">
              When to use it
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{comp.useCase}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t border-border p-3">
        <Button
          render={<Link href={`/app/library/${comp.id}`} />}
          variant="outline"
          size="sm"
          className="flex-1"
        >
          <BookOpen data-icon="inline-start" />
          Docs
        </Button>
        <Tooltip content="Duplicate node">
          <Button variant="outline" size="icon-sm" onClick={duplicateSelection}>
            <Copy />
            <span className="sr-only">Duplicate node</span>
          </Button>
        </Tooltip>
        <Tooltip content="Delete node">
          <Button variant="destructive" size="icon-sm" onClick={() => removeNodes([node.id])}>
            <Trash2 />
            <span className="sr-only">Delete node</span>
          </Button>
        </Tooltip>
      </div>

      {/* Deep Customization Dialog */}
      {deepCustomizationOpen && (
        <DeepCustomizationDialog
          open={deepCustomizationOpen}
          onOpenChange={setDeepCustomizationOpen}
          nodeId={node.id}
        />
      )}
    </div>
  )
}

export function Inspector({
  onUnlockRequest,
  onSaveBlock,
}: {
  onUnlockRequest: (comp: ComponentDef) => void
  onSaveBlock: () => void
}) {
  const { nodes, selection } = useBuilder()

  const selected = nodes.filter((n) => selection.includes(n.id))
  const single = selected.length === 1 ? selected[0] : null
  const comp = single ? COMPONENT_MAP[single.componentId] : null
  const hasSelection = selected.length > 0

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col bg-background transition-[width,border-color] duration-200 ease-out overflow-hidden',
        hasSelection ? 'w-80 border-l border-border' : 'w-0 border-l-0',
      )}
    >
      <div className="w-80 h-full flex flex-col">
        {selected.length > 1 ? (
          <MultiSelectPanel count={selected.length} onSaveBlock={onSaveBlock} />
        ) : single && comp ? (
          <SingleNodePanel node={single} comp={comp} onUnlockRequest={onUnlockRequest} />
        ) : null}
      </div>
    </aside>
  )
}
