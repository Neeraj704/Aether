'use client'

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
import { Field, Input, Textarea } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SliderWithValue } from '@/components/ui/slider'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/misc'
import { Tooltip } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

/** One config control, driven entirely by the component's FieldDef. */
function ConfigField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FieldDef
  value: unknown
  onChange: (v: unknown) => void
  disabled: boolean
}) {
  const id = `cfg-${field.key}`

  switch (field.type) {
    case 'text':
      return (
        <Field label={field.label} help={field.help} htmlFor={id}>
          {field.key === 'symbols' || (field.placeholder ?? '').length > 24 ? (
            <Textarea
              id={id}
              rows={2}
              disabled={disabled}
              value={String(value ?? '')}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <Input
              id={id}
              disabled={disabled}
              value={String(value ?? '')}
              placeholder={field.placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          )}
        </Field>
      )

    case 'password':
      return (
        <Field label={field.label} help={field.help} htmlFor={id}>
          <Input
            id={id}
            type="password"
            disabled={disabled}
            value={String(value ?? '')}
            placeholder={field.placeholder ?? '••••••••'}
            onChange={(e) => onChange(e.target.value)}
          />
        </Field>
      )

    case 'select':
      return (
        <Field label={field.label} help={field.help} htmlFor={id}>
          <Select
            id={id}
            disabled={disabled}
            options={field.options}
            value={String(value ?? field.value ?? '')}
            onValueChange={onChange}
          />
        </Field>
      )

    case 'slider':
      return (
        <Field help={field.help}>
          <SliderWithValue
            label={field.label}
            min={field.min}
            max={field.max}
            step={field.step}
            unit={field.unit}
            value={Number(value ?? field.value)}
            onValueChange={onChange}
          />
        </Field>
      )

    case 'number':
      return (
        <Field
          label={field.unit ? `${field.label} (${field.unit})` : field.label}
          help={field.help}
          htmlFor={id}
        >
          <Input
            id={id}
            type="number"
            disabled={disabled}
            min={field.min}
            max={field.max}
            value={Number(value ?? field.value)}
            onChange={(e) => onChange(Number(e.target.value))}
          />
        </Field>
      )

    case 'switch':
      return (
        <div className="flex items-start justify-between gap-3 py-0.5">
          <div className="min-w-0">
            <p className="text-[13px] font-medium">{field.label}</p>
            {field.help ? (
              <p className="mt-0.5 text-xs leading-relaxed text-tertiary">{field.help}</p>
            ) : null}
          </div>
          <Switch
            disabled={disabled}
            checked={Boolean(value ?? field.value)}
            onCheckedChange={onChange}
            className="mt-0.5 shrink-0"
          />
        </div>
      )

    case 'checklist': {
      const selected = Array.isArray(value) ? (value as string[]) : field.value
      return (
        <Field label={field.label} help={field.help}>
          <div className="flex flex-col">
            {field.options.map((opt) => (
              <CheckboxRow
                key={opt}
                label={opt}
                checked={selected.includes(opt)}
                onCheckedChange={(on) =>
                  onChange(on ? [...selected, opt] : selected.filter((s) => s !== opt))
                }
              />
            ))}
          </div>
        </Field>
      )
    }
  }
}

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
  const { updateConfig, setEnabled, removeNodes, duplicateSelection } = useBuilder()
  const { plan, unlocked } = useSession()
  const locked = !hasComponent(comp.id, { plan, unlocked })
  const layer = LAYER_MAP[comp.layer]

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
                Configuration
              </p>
              {comp.fields.map((field) => (
                <ConfigField
                  key={field.key}
                  field={field}
                  value={node.config[field.key]}
                  disabled={locked}
                  onChange={(v) => updateConfig(node.id, field.key, v)}
                />
              ))}
            </>
          ) : (
            <p className="text-xs text-tertiary">This node has nothing to configure.</p>
          )}

          <Separator />

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
