'use client'

import React, { useState, useRef } from 'react'
import type { FieldDef, ModelSelection } from '@/mock/layers'
import { MOCK_DATASETS } from '@/mock/data'
import { ModelSelectField } from '@/components/builder/model-select-field'
import { Select } from '@/components/ui/select'
import { Input, Textarea, Field } from '@/components/ui/input'
import { SliderWithValue } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { CheckboxRow } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import {
  Check,
  X,
  Loader2,
  Plus,
  Trash2,
  Key,
  Code,
  Braces,
  Sparkles,
  Variable,
  GripVertical,
  MousePointerClick,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/store'

export interface FieldRendererProps {
  field: FieldDef
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
  /** Available variables for prompt insertion computed from connected input edges. */
  availableVariables?: { id: string; label: string; name: string }[]
}

export function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  availableVariables = [],
}: FieldRendererProps) {
  // 1. Text
  if (field.type === 'text') {
    return (
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <Input
          id={field.key}
          disabled={disabled}
          value={(value as string) ?? field.value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
        />
      </Field>
    )
  }

  // 2. Password
  if (field.type === 'password') {
    return (
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <Input
          id={field.key}
          type="password"
          disabled={disabled}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder ?? '••••••••'}
        />
      </Field>
    )
  }

  // 3. Select (using custom styled Select component)
  if (field.type === 'select') {
    const activeVal = (value as string) ?? field.value ?? field.options[0]
    return (
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <Select
          id={field.key}
          disabled={disabled}
          options={field.options}
          value={activeVal}
          onValueChange={onChange}
        />
      </Field>
    )
  }

  // 4. Slider
  if (field.type === 'slider') {
    return (
      <SliderWithValue
        label={field.label}
        value={typeof value === 'number' ? value : field.value}
        onValueChange={onChange}
        min={field.min}
        max={field.max}
        step={field.step}
        unit={field.unit}
        disabled={disabled}
      />
    )
  }

  // 5. Switch
  if (field.type === 'switch') {
    const isChecked = typeof value === 'boolean' ? value : field.value
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-foreground">{field.label}</span>
          {field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>}
        </div>
        <Switch
          checked={isChecked}
          onCheckedChange={onChange}
          disabled={disabled}
        />
      </div>
    )
  }

  // 6. Checklist
  if (field.type === 'checklist') {
    const currentList = Array.isArray(value) ? (value as string[]) : field.value || []
    return (
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground">{field.label}</span>
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-card/40 p-2">
          {field.options.map((opt) => {
            const isChecked = currentList.includes(opt)
            return (
              <CheckboxRow
                key={opt}
                label={opt}
                checked={isChecked}
                onCheckedChange={(checked) => {
                  if (checked) {
                    onChange([...currentList, opt])
                  } else {
                    onChange(currentList.filter((item) => item !== opt))
                  }
                }}
              />
            )
          })}
        </div>
        {field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>}
      </div>
    )
  }

  // 7. Number
  if (field.type === 'number') {
    return (
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <Input
          id={field.key}
          type="number"
          min={field.min}
          max={field.max}
          disabled={disabled}
          value={typeof value === 'number' ? value : field.value ?? 0}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        />
      </Field>
    )
  }

  // 8. Model Selection
  if (field.type === 'model-select') {
    return (
      <ModelSelectField
        value={value as ModelSelection}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 9. Prompt with drag-and-drop & click variable insertion
  if (field.type === 'prompt') {
    return (
      <PromptField
        field={field}
        value={(value as string) ?? field.value ?? ''}
        onChange={onChange}
        disabled={disabled}
        availableVariables={availableVariables}
      />
    )
  }

  // 10. Code with line gutter
  if (field.type === 'code') {
    return (
      <CodeField
        field={field}
        value={(value as string) ?? field.value ?? ''}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 11. JSON with validation
  if (field.type === 'json') {
    return (
      <JsonField
        field={field}
        value={(value as string) ?? field.value ?? ''}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 12. Key-Value List
  if (field.type === 'key-value') {
    const list = Array.isArray(value)
      ? (value as { key: string; value: string }[])
      : field.value || []
    return (
      <KeyValueField
        label={field.label}
        help={field.help}
        list={list}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 13. Weighted List
  if (field.type === 'weighted-list') {
    const weights = (value as Record<string, number>) || field.value || {}
    return (
      <WeightedListField
        field={field}
        weights={weights}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 14. Credential with connection test
  if (field.type === 'credential') {
    return (
      <CredentialField
        field={field}
        value={(value as string) ?? field.value ?? ''}
        onChange={onChange}
        disabled={disabled}
      />
    )
  }

  // 15. Dataset Reference (using custom styled Select)
  if (field.type === 'dataset-ref') {
    const activeDatasetId = (value as string) ?? field.value ?? ''
    const datasetOptions = [
      { value: '', label: '-- None (Live Realtime Stream) --' },
      ...MOCK_DATASETS.map((ds) => ({
        value: ds.id,
        label: `${ds.name} (${ds.format} · ${ds.rowCount.toLocaleString()} rows · ${ds.size})`,
      })),
    ]

    return (
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <Select
          id={field.key}
          disabled={disabled}
          options={datasetOptions}
          value={activeDatasetId || ''}
          onValueChange={(v) => onChange(v || null)}
        />
      </Field>
    )
  }

  return null
}

/* ------------------------------------------------------------------ */
/* Sub-components for rich field types                                */
/* ------------------------------------------------------------------ */

function PromptField({
  field,
  value,
  onChange,
  disabled,
  availableVariables = [],
}: {
  field: Extract<FieldDef, { type: 'prompt' }>
  value: string
  onChange: (val: string) => void
  disabled?: boolean
  availableVariables: { id: string; label: string; name: string }[]
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  // Default standard tokens always accessible
  const standardTokens = [
    { id: 'std-input', name: 'input', label: 'Wired Inputs' },
    { id: 'std-symbol', name: 'symbol', label: 'Active Ticker' },
    { id: 'std-regime', name: 'market_regime', label: 'Regime Tag' },
    { id: 'std-timestamp', name: 'bar_timestamp', label: 'Bar Time' },
  ]

  // Combined available tokens
  const allTokens = [
    ...availableVariables,
    ...standardTokens.filter((st) => !availableVariables.some((av) => av.name === st.name)),
  ]

  const insertToken = (tokenName: string) => {
    const tag = `{{${tokenName}}}`
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value ? `${value} ${tag}` : tag)
      return
    }

    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const before = value.substring(0, start)
    const after = value.substring(end)
    const updated = `${before}${before.endsWith(' ') || before.length === 0 ? '' : ' '}${tag}${after.startsWith(' ') || after.length === 0 ? '' : ' '}${after}`
    onChange(updated)

    setTimeout(() => {
      textarea.focus()
      const newPos = start + tag.length + (before.endsWith(' ') ? 0 : 1)
      textarea.setSelectionRange(newPos, newPos)
    }, 10)
  }

  const handleDragStart = (e: React.DragEvent, tokenName: string) => {
    e.dataTransfer.setData('text/plain', `{{${tokenName}}}`)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const droppedText = e.dataTransfer.getData('text/plain')
    if (!droppedText) return

    const textarea = textareaRef.current
    if (!textarea) {
      onChange(value ? `${value} ${droppedText}` : droppedText)
      return
    }

    // Insert at current cursor position
    const start = textarea.selectionStart ?? value.length
    const end = textarea.selectionEnd ?? value.length
    const before = value.substring(0, start)
    const after = value.substring(end)
    const updated = `${before}${before.endsWith(' ') || before.length === 0 ? '' : ' '}${droppedText}${after.startsWith(' ') || after.length === 0 ? '' : ' '}${after}`
    onChange(updated)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="size-3.5 text-brand" /> {field.label}
        </span>
        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
          <MousePointerClick className="size-3 text-brand" /> Click or drag variables to insert
        </span>
      </div>

      {/* Draggable Variable Chips Toolbar */}
      <div className="flex flex-col gap-1.5 p-3 rounded-2xl border border-border bg-secondary/40">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <Variable className="size-3 text-brand" /> Interpolation Tokens
          </span>
          <span className="text-[10px] text-tertiary">Drag into editor or tap to append</span>
        </div>

        <div className="flex items-center flex-wrap gap-2 pt-1">
          {allTokens.map((v) => (
            <div
              key={v.id}
              draggable={!disabled}
              onDragStart={(e) => handleDragStart(e, v.name)}
              onClick={() => !disabled && insertToken(v.name)}
              className={cn(
                'group flex items-center gap-1.5 px-2.5 py-1 rounded-xl border transition-all cursor-grab active:cursor-grabbing select-none',
                'border-brand/40 bg-brand/10 hover:bg-brand/20 hover:border-brand text-brand shadow-xs',
              )}
              title={`Drag into prompt or click to insert {{${v.name}}}`}
            >
              <GripVertical className="size-3 opacity-60 group-hover:opacity-100" />
              <span className="text-xs font-mono font-bold">{"{{"}{v.name}{"}}"}</span>
              <span className="text-[10px] text-muted-foreground hidden sm:inline">({v.label})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Textarea with Drag & Drop Target Support */}
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          'relative rounded-2xl border transition-all',
          isDragOver ? 'border-brand ring-2 ring-brand/30 bg-brand/5' : 'border-input bg-card',
        )}
      >
        <textarea
          ref={textareaRef}
          rows={7}
          disabled={disabled}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Write reasoning directives, persona prompts, and rules. Drag variables here..."
          className="w-full bg-transparent p-3.5 text-xs font-mono leading-relaxed outline-none resize-y text-foreground"
          spellCheck={false}
        />
        {isDragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-brand/10 backdrop-blur-xs rounded-2xl font-bold text-xs text-brand">
            Drop variable token here
          </div>
        )}
      </div>

      {field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>}
    </div>
  )
}

function CodeField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Extract<FieldDef, { type: 'code' }>
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const lineCount = Math.max(value.split('\n').length, 5)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Code className="size-3.5 text-brand" /> {field.label} ({field.language || 'python'})
        </span>
      </div>

      <div className="flex rounded-2xl border border-border bg-card/80 overflow-hidden font-mono text-xs shadow-xs">
        {/* Line Gutter */}
        <div className="select-none bg-secondary/60 text-muted-foreground/60 py-2.5 px-3 text-right border-r border-border leading-relaxed font-mono">
          {Array.from({ length: lineCount }).map((_, i) => (
            <div key={i}>{i + 1}</div>
          ))}
        </div>
        {/* Code Input */}
        <textarea
          disabled={disabled}
          rows={Math.max(lineCount, 6)}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="# Custom logic definition..."
          className="w-full bg-transparent p-2.5 outline-none resize-y leading-relaxed font-mono text-foreground"
          spellCheck={false}
        />
      </div>

      {field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>}
    </div>
  )
}

function JsonField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Extract<FieldDef, { type: 'json' }>
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const [jsonError, setJsonError] = useState<string | null>(null)

  const handleBlur = () => {
    if (!value.trim()) {
      setJsonError(null)
      return
    }
    try {
      JSON.parse(value)
      setJsonError(null)
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON syntax')
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Braces className="size-3.5 text-brand" /> {field.label}
        </span>
      </div>

      <Textarea
        rows={5}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        placeholder='{ "key": "value" }'
        className={cn('font-mono text-xs leading-relaxed', jsonError && 'border-destructive focus-visible:ring-destructive/30')}
        spellCheck={false}
      />

      {jsonError ? (
        <span className="text-[11px] font-semibold text-destructive flex items-center gap-1">
          <X className="size-3" /> JSON Parse Error: {jsonError}
        </span>
      ) : (
        field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>
      )}
    </div>
  )
}

function KeyValueField({
  label,
  help,
  list,
  onChange,
  disabled,
}: {
  label: string
  help?: string
  list: { key: string; value: string }[]
  onChange: (val: { key: string; value: string }[]) => void
  disabled?: boolean
}) {
  const handleAdd = () => {
    onChange([...list, { key: '', value: '' }])
  }

  const handleUpdate = (idx: number, patch: Partial<{ key: string; value: string }>) => {
    const next = [...list]
    next[idx] = { ...next[idx], ...patch }
    onChange(next)
  }

  const handleRemove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <button
          type="button"
          disabled={disabled}
          onClick={handleAdd}
          className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1 cursor-pointer"
        >
          <Plus className="size-3" /> Add Row
        </button>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
          No key-value pairs specified. Click &quot;Add Row&quot; to define headers or params.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {list.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                disabled={disabled}
                placeholder="Key / Header"
                value={item.key}
                onChange={(e) => handleUpdate(idx, { key: e.target.value })}
                className="font-mono text-xs h-8"
              />
              <Input
                disabled={disabled}
                placeholder="Value"
                value={item.value}
                onChange={(e) => handleUpdate(idx, { value: e.target.value })}
                className="font-mono text-xs h-8"
              />
              <button
                type="button"
                disabled={disabled}
                onClick={() => handleRemove(idx)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {help && <span className="text-[11px] text-muted-foreground">{help}</span>}
    </div>
  )
}

function WeightedListField({
  field,
  weights,
  onChange,
  disabled,
}: {
  field: Extract<FieldDef, { type: 'weighted-list' }>
  weights: Record<string, number>
  onChange: (val: Record<string, number>) => void
  disabled?: boolean
}) {
  const sum = Object.values(weights).reduce((acc, v) => acc + (typeof v === 'number' ? v : 0), 0)
  const isBalanced = sum >= 98 && sum <= 102

  const handleSlider = (opt: string, val: number) => {
    onChange({
      ...weights,
      [opt]: val,
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card/40 p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">{field.label}</span>
        <Badge variant={isBalanced ? 'profit' : 'warn'} size="sm">
          Total: {sum.toFixed(0)}%
        </Badge>
      </div>

      <div className="flex flex-col gap-3">
        {field.options.map((opt) => (
          <SliderWithValue
            key={opt}
            label={opt}
            value={weights[opt] ?? 0}
            onValueChange={(v: number) => handleSlider(opt, v)}
            min={0}
            max={100}
            step={5}
            unit="%"
            disabled={disabled}
          />
        ))}
      </div>

      {field.help && <span className="text-[11px] text-muted-foreground">{field.help}</span>}
    </div>
  )
}

function CredentialField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: Extract<FieldDef, { type: 'credential' }>
  value: string
  onChange: (val: string) => void
  disabled?: boolean
}) {
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)

  const handleTest = () => {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      if (value.trim().length > 3) {
        setTestResult('success')
        toast.success('Credential Validated', 'Authentication handshake succeeded with data gateway.')
      } else {
        setTestResult('error')
        toast.error('Credential Invalid', 'Please enter a valid API secret or token.')
      }
    }, 900)
  }

  return (
    <div className="flex flex-col gap-2">
      <Field label={field.label} htmlFor={field.key} help={field.help}>
        <div className="flex items-center gap-2">
          <Input
            id={field.key}
            type="password"
            disabled={disabled}
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setTestResult(null)
            }}
            placeholder="sk_live_••••••••"
            className="font-mono text-xs"
          />
          <PillButton
            type="button"
            variant="secondary"
            size="sm"
            disabled={disabled || testing}
            onClick={handleTest}
            className="gap-1 text-xs shrink-0 h-8"
          >
            {testing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : testResult === 'success' ? (
              <Check className="size-3 text-profit" />
            ) : testResult === 'error' ? (
              <X className="size-3 text-destructive" />
            ) : (
              <Key className="size-3" />
            )}
            {testing ? 'Testing...' : 'Test'}
          </PillButton>
        </div>
      </Field>

      {testResult === 'success' && (
        <span className="text-[11px] font-semibold text-profit flex items-center gap-1">
          <Check className="size-3" /> Authorized & active on provider gateway
        </span>
      )}
      {testResult === 'error' && (
        <span className="text-[11px] font-semibold text-destructive flex items-center gap-1">
          <X className="size-3" /> Authentication failed or empty key
        </span>
      )}
    </div>
  )
}
