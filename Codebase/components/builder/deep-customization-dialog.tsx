'use client'

import React, { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  COMPONENT_MAP,
  LAYER_MAP,
  type ComponentDef,
  type FieldDef,
} from '@/mock/layers'
import type { BotNode, BotEdge } from '@/mock/data'
import { useBuilder } from '@/lib/builder-store'
import { defaultConfig } from '@/lib/workspace-store'
import { FieldRenderer } from '@/components/builder/field-renderer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/tabs'
import { PillButton } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { Input, Textarea, Field } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  SlidersHorizontal,
  Sparkles,
  BookOpen,
  RotateCcw,
  Copy,
  Download,
  Upload,
  Check,
  Variable,
  Layers,
  ArrowRight,
  ShieldAlert,
  AlertTriangle,
} from 'lucide-react'
import { toast } from '@/lib/store'

interface DeepCustomizationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nodeId: string | null
}

export function DeepCustomizationDialog({
  open,
  onOpenChange,
  nodeId,
}: DeepCustomizationDialogProps) {
  const nodes = useBuilder((s) => s.nodes)
  const edges = useBuilder((s) => s.edges)
  const updateConfig = useBuilder((s) => s.updateConfig)

  const node = useMemo(() => nodes.find((n) => n.id === nodeId) || null, [nodes, nodeId])
  const comp = useMemo(() => (node ? COMPONENT_MAP[node.componentId] : null), [node])

  const [activeTab, setActiveTab] = useState<'config' | 'model' | 'docs' | 'advanced'>('config')
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [jsonImportOpen, setJsonImportOpen] = useState(false)
  const [jsonInput, setJsonInput] = useState('')

  if (!node || !comp) return null

  const layer = LAYER_MAP[comp.layer]
  const basicFields = comp.fields || []
  const advancedFields = comp.advancedFields || []
  const allFields = [...basicFields, ...advancedFields]

  const hasModelOrPrompt = allFields.some(
    (f) => f.type === 'model-select' || f.type === 'prompt',
  )

  // Compute incoming connected variables
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

  const handleUpdateField = (key: string, val: unknown) => {
    updateConfig(node.id, key, val)
  }

  const handleUpdateInputLabel = (sourceId: string, label: string) => {
    const nextLabels = { ...userLabels, [sourceId]: label }
    updateConfig(node.id, '__inputLabels', nextLabels)
  }

  const handleResetDefaults = () => {
    const defaults = defaultConfig(comp)
    Object.entries(defaults).forEach(([k, v]) => {
      updateConfig(node.id, k, v)
    })
    toast.success('Node Reset', `Reset "${comp.name}" to factory default parameters.`)
    setResetConfirmOpen(false)
  }

  const handleExportJson = () => {
    const exportObj = {
      componentId: comp.id,
      componentName: comp.name,
      config: node.config,
    }
    navigator.clipboard.writeText(JSON.stringify(exportObj, null, 2))
    toast.success('Config Copied', 'Node parameter JSON copied to clipboard.')
  }

  const handleImportJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      const importedConfig = parsed.config || parsed
      if (typeof importedConfig !== 'object' || !importedConfig) {
        throw new Error('Invalid JSON structure')
      }
      Object.entries(importedConfig).forEach(([k, v]) => {
        updateConfig(node.id, k, v)
      })
      toast.success('Config Imported', 'Applied parameters to node.')
      setJsonImportOpen(false)
      setJsonInput('')
    } catch (err: any) {
      toast.error('Import Failed', err.message || 'Malformed JSON string')
    }
  }

  const tabs = [
    { value: 'config' as const, label: 'Configuration' },
    ...(hasModelOrPrompt ? [{ value: 'model' as const, label: 'Model & Prompt' }] : []),
    { value: 'docs' as const, label: 'Documentation' },
    { value: 'advanced' as const, label: 'Advanced & Reset' },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Modal Header */}
        <div className="border-b border-border bg-card/90 p-6 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                style={{ backgroundColor: layer.hue }}
                className="flex size-10 items-center justify-center rounded-xl font-bold text-white shadow-sm"
              >
                {layer.roman}
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold">{comp.name}</DialogTitle>
                  <Badge variant="brand" size="sm">
                    {layer.roman}. {layer.name}
                  </Badge>
                </div>
                <DialogDescription className="text-xs text-muted-foreground">
                  {comp.tagline}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Segmented<'config' | 'model' | 'docs' | 'advanced'>
                value={activeTab}
                onValueChange={setActiveTab}
                options={tabs}
              />
            </div>
          </div>
        </div>

        {/* Modal Body with Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* TAB 1: Configuration (Basic + Advanced) */}
          {activeTab === 'config' && (
            <div className="flex flex-col gap-6">
              {/* Basic Fields */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 border-b border-border pb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Core Parameters
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-4">
                  {basicFields.map((f) => (
                    <FieldRenderer
                      key={f.key}
                      field={f}
                      value={node.config?.[f.key]}
                      onChange={(val) => handleUpdateField(f.key, val)}
                      availableVariables={availableVariables}
                    />
                  ))}
                </div>
              </div>

              {/* Advanced Fields */}
              {advancedFields.length > 0 && (
                <div className="flex flex-col gap-4 pt-2">
                  <div className="flex items-center gap-2 border-b border-border pb-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand flex items-center gap-1.5">
                      <SlidersHorizontal className="size-3.5" /> Advanced Customization
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4">
                    {advancedFields.map((f) => (
                      <FieldRenderer
                        key={f.key}
                        field={f}
                        value={node.config?.[f.key]}
                        onChange={(val) => handleUpdateField(f.key, val)}
                        availableVariables={availableVariables}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Model & Prompt */}
          {activeTab === 'model' && (
            <div className="flex flex-col gap-6">
              {/* Variable Mapping Sub-section */}
              <div className="rounded-2xl border border-border bg-card/60 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Variable className="size-3.5 text-brand" /> Connected Input Variables
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {incomingEdges.length} connected source{incomingEdges.length === 1 ? '' : 's'}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Variables wired into this node are dynamically injected into your prompt via <code>{"{{variable}}"}</code> tags.
                </p>

                {incomingEdges.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    No incoming edges wired to this node yet. Connect upstream Feature or Signal nodes on the canvas.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {availableVariables.map((v) => (
                      <div key={v.id} className="flex items-center gap-2 rounded-xl border border-border bg-secondary/40 p-2.5">
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-bold truncate">{v.label}</span>
                          <span className="text-[10px] text-tertiary">source node: {v.id}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-xs font-mono text-brand">{"{{"}</span>
                          <Input
                            value={v.name}
                            onChange={(e) => handleUpdateInputLabel(v.id, e.target.value)}
                            placeholder="var_name"
                            className="h-7 w-28 text-xs font-mono"
                          />
                          <span className="text-xs font-mono text-brand">{"}}"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Model Select and System Prompt */}
              {allFields
                .filter((f) => f.type === 'model-select' || f.type === 'prompt')
                .map((f) => (
                  <FieldRenderer
                    key={f.key}
                    field={f}
                    value={node.config?.[f.key]}
                    onChange={(val) => handleUpdateField(f.key, val)}
                    availableVariables={availableVariables}
                  />
                ))}
            </div>
          )}

          {/* TAB 3: Documentation */}
          {activeTab === 'docs' && (
            <div className="flex flex-col gap-6">
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-3">
                <h3 className="text-sm font-bold text-foreground">Recommended Use Case</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {comp.useCase}
                </p>
              </div>

              {comp.docs ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-profit/30 bg-profit/5 p-5 flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-profit uppercase tracking-wider">When to Use</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{comp.docs.whenToUse}</p>
                  </div>

                  <div className="rounded-2xl border border-warn/30 bg-warn/5 p-5 flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-warn uppercase tracking-wider">When to Skip</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{comp.docs.whenToSkip}</p>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-foreground">Best Practices</h4>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground flex flex-col gap-1.5">
                      {comp.docs.bestPractices.map((bp, i) => (
                        <li key={i}>{bp}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-2xl border border-border bg-card p-5 flex flex-col gap-2">
                    <h4 className="text-xs font-bold text-destructive">Common Mistakes</h4>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground flex flex-col gap-1.5">
                      {comp.docs.commonMistakes.map((cm, i) => (
                        <li key={i}>{cm}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  Detailed architectural reference available in the Component Library.
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <Link
                  href={`/app/library/${comp.id}`}
                  className="text-xs font-bold text-brand hover:underline inline-flex items-center gap-1"
                >
                  View full library specification entry &rarr;
                </Link>
              </div>
            </div>
          )}

          {/* TAB 4: Advanced & Reset */}
          {activeTab === 'advanced' && (
            <div className="flex flex-col gap-6">
              {/* JSON Import/Export */}
              <div className="rounded-2xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Copy className="size-4 text-brand" /> Export / Share Node Parameters
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Copy the complete serialized config object to share with other quantitative researchers.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PillButton variant="secondary" size="sm" onClick={handleExportJson} className="gap-1.5">
                    <Copy className="size-3.5" /> Copy JSON
                  </PillButton>
                  <PillButton variant="secondary" size="sm" onClick={() => setJsonImportOpen(true)} className="gap-1.5">
                    <Upload className="size-3.5" /> Import JSON
                  </PillButton>
                </div>
              </div>

              {/* JSON Import Box */}
              {jsonImportOpen && (
                <div className="rounded-2xl border border-brand/40 bg-card p-5 flex flex-col gap-3">
                  <h4 className="text-xs font-bold text-brand">Paste Configuration JSON</h4>
                  <Textarea
                    rows={4}
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    placeholder='{ "symbols": "NIFTY", "interval": 15 }'
                    className="font-mono text-xs"
                  />
                  <div className="flex justify-end gap-2">
                    <PillButton variant="secondary" size="sm" onClick={() => setJsonImportOpen(false)}>
                      Cancel
                    </PillButton>
                    <PillButton size="sm" onClick={handleImportJson}>
                      Apply Parameters
                    </PillButton>
                  </div>
                </div>
              )}

              {/* Reset to Factory Defaults */}
              <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-destructive flex items-center gap-2">
                    <RotateCcw className="size-4" /> Reset Node to Defaults
                  </h3>
                  <p className="text-xs text-muted-foreground max-w-md">
                    Discard all custom prompts, parameters, and credentials and restore original factory settings.
                  </p>
                </div>
                <PillButton
                  variant="destructive"
                  size="sm"
                  onClick={() => setResetConfirmOpen(true)}
                  className="gap-1.5 shrink-0"
                >
                  <RotateCcw className="size-3.5" /> Reset to Defaults
                </PillButton>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-card/90 px-6 py-4 flex items-center justify-between">
          <span className="text-xs text-muted-foreground font-mono">
            Node ID: {node.id} · Layer {layer.roman}
          </span>
          <PillButton onClick={() => onOpenChange(false)} size="sm">
            Done
          </PillButton>
        </div>
      </DialogContent>

      {/* Reset Confirmation Dialog */}
      {resetConfirmOpen && (
        <ConfirmDialog
          open={resetConfirmOpen}
          onOpenChange={setResetConfirmOpen}
          title={`Reset ${comp.name}?`}
          description="Are you sure you want to restore factory default parameters? All custom prompt tuning, hyperparameter overrides, and credentials for this node will be reverted."
          confirmLabel="Reset Parameters"
          destructive
          onConfirm={handleResetDefaults}
        />
      )}
    </Dialog>
  )
}
