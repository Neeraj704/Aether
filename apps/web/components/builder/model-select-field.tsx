'use client'

import { useState } from 'react'
import { PROVIDERS, type Provider } from '@/mock/models'
import type { ModelSelection } from '@/mock/layers'
import { Select } from '@/components/ui/select'
import { SliderWithValue } from '@/components/ui/slider'
import { Input, Field } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { Check, X, Loader2, Server, Cpu, Key, Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/store'

interface ModelSelectFieldProps {
  value?: ModelSelection
  onChange: (val: ModelSelection) => void
  disabled?: boolean
}

export function ModelSelectField({
  value = {
    providerId: 'openai',
    modelId: 'gpt-5-mini',
    temperature: 0.7,
    maxTokens: 1024,
  },
  onChange,
  disabled,
}: ModelSelectFieldProps) {
  const currentProvider =
    PROVIDERS.find((p) => p.id === value.providerId) || PROVIDERS[0]

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [showKey, setShowKey] = useState(false)

  const handleProviderSelect = (p: Provider) => {
    const defaultModel = p.models[0]?.id || (p.kind === 'local' ? 'llama3.1:8b' : '')
    onChange({
      ...value,
      providerId: p.id,
      modelId: defaultModel,
      endpoint: p.kind === 'local' ? value.endpoint || 'http://localhost:11434' : undefined,
    })
    setTestResult(null)
  }

  const handleModelSelect = (modelId: string) => {
    onChange({
      ...value,
      modelId,
    })
  }

  const handleEndpointChange = (endpoint: string) => {
    onChange({
      ...value,
      endpoint,
    })
    setTestResult(null)
  }

  const handleApiKeyChange = (apiKey: string) => {
    onChange({
      ...value,
      apiKey,
    })
    setTestResult(null)
  }

  const handleTemperatureChange = (temperature: number) => {
    onChange({
      ...value,
      temperature,
    })
  }

  const handleMaxTokensChange = (maxTokens: number) => {
    onChange({
      ...value,
      maxTokens,
    })
  }

  const handleTestConnection = () => {
    setTesting(true)
    setTestResult(null)
    setTimeout(() => {
      setTesting(false)
      const hasModel = Boolean(value.modelId?.trim())
      if (hasModel) {
        setTestResult('success')
        toast.success(
          'Inference Connection Verified',
          value.apiKey?.trim()
            ? `Successfully authenticated with custom key for ${value.modelId}.`
            : `Successfully routed ${value.modelId} via Aether Server Gateway.`,
        )
      } else {
        setTestResult('error')
        toast.error('Connection Failed', 'Please specify a valid model tag or endpoint.')
      }
    }, 900)
  }

  const activeModelMeta = currentProvider.models.find((m) => m.id === value.modelId)

  const modelSelectOptions = currentProvider.models.map((m) => ({
    value: m.id,
    label: `${m.label} (${m.contextWindow} · ${m.speed} · ${m.costTier} cost)`,
  }))

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-4 sm:p-5">
      {/* Provider Chips */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Cpu className="size-3.5 text-brand" /> LLM Reasoning Provider
        </span>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
          {PROVIDERS.map((p) => {
            const isSelected = p.id === currentProvider.id
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                onClick={() => handleProviderSelect(p)}
                className={cn(
                  'flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer select-none text-center gap-1',
                  isSelected
                    ? 'border-brand/60 bg-brand/15 text-brand font-bold shadow-xs ring-1 ring-brand/30'
                    : 'border-border bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary',
                )}
              >
                <span className="text-[11px] truncate font-semibold">{p.name}</span>
                {p.kind === 'local' ? (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-tertiary">Local</span>
                ) : (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-brand/10 text-brand">Cloud</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Model Selection */}
      {currentProvider.kind === 'local' ? (
        <div className="flex flex-col gap-3 pt-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Ollama Model Tag" htmlFor="model-tag" help="Local model identifier in Ollama library">
              <Input
                id="model-tag"
                disabled={disabled}
                value={value.modelId || ''}
                onChange={(e) => handleModelSelect(e.target.value)}
                placeholder="llama3.1:8b"
                className="font-mono text-xs"
              />
            </Field>

            <Field label="Endpoint URL" htmlFor="endpoint-url" help="Local Ollama daemon HTTP REST endpoint">
              <Input
                id="endpoint-url"
                disabled={disabled}
                value={value.endpoint || 'http://localhost:11434'}
                onChange={(e) => handleEndpointChange(e.target.value)}
                placeholder="http://localhost:11434"
                className="font-mono text-xs"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <PillButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={disabled || testing}
              onClick={handleTestConnection}
              className="gap-1.5 text-xs h-7.5"
            >
              {testing ? (
                <Loader2 className="size-3 animate-spin" />
              ) : testResult === 'success' ? (
                <Check className="size-3 text-profit" />
              ) : testResult === 'error' ? (
                <X className="size-3 text-destructive" />
              ) : (
                <Server className="size-3" />
              )}
              {testing ? 'Testing...' : 'Test Connection'}
            </PillButton>

            {testResult === 'success' && (
              <span className="text-[11px] font-semibold text-profit flex items-center gap-1">
                <Check className="size-3" /> Endpoint reachable (0.4ms latency)
              </span>
            )}
            {testResult === 'error' && (
              <span className="text-[11px] font-semibold text-destructive flex items-center gap-1">
                <X className="size-3" /> Daemon connection refused
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-1">
          <Field label="Model Variant" htmlFor="model-select" help="Choose inference tier, context window, and latency">
            <Select
              id="model-select"
              disabled={disabled}
              options={modelSelectOptions}
              value={value.modelId}
              onValueChange={handleModelSelect}
            />
          </Field>

          {/* Model Meta Badges */}
          {activeModelMeta && (
            <div className="flex items-center gap-2 pt-0.5 text-[10px]">
              <Badge variant="brand" size="sm">
                Context: {activeModelMeta.contextWindow}
              </Badge>
              <Badge variant={activeModelMeta.speed === 'fast' ? 'profit' : 'neutral'} size="sm">
                Speed: {activeModelMeta.speed}
              </Badge>
              <Badge variant={activeModelMeta.costTier === 'low' ? 'profit' : activeModelMeta.costTier === 'high' ? 'warn' : 'neutral'} size="sm">
                Cost: {activeModelMeta.costTier}
              </Badge>
            </div>
          )}

          {/* BYOK Custom API Key Input */}
          <div className="rounded-xl border border-border bg-secondary/40 p-3 flex flex-col gap-2.5 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Key className="size-3 text-brand" /> Custom Provider API Key (Optional)
              </span>
              <Badge variant={value.apiKey?.trim() ? 'brand' : 'neutral'} size="sm">
                {value.apiKey?.trim() ? 'BYOK Active' : 'Aether Server Model Gateway'}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? 'text' : 'password'}
                  disabled={disabled}
                  value={value.apiKey || ''}
                  onChange={(e) => handleApiKeyChange(e.target.value)}
                  placeholder={`Leave blank to use Aether server or enter ${currentProvider.name} key (sk-...)`}
                  className="font-mono text-xs pr-9 h-8"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  title={showKey ? 'Hide key' : 'Show key'}
                >
                  {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              </div>

              <PillButton
                type="button"
                variant="secondary"
                size="sm"
                disabled={disabled || testing}
                onClick={handleTestConnection}
                className="gap-1 text-xs shrink-0 h-8"
              >
                {testing ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
                Verify
              </PillButton>
            </div>

            <span className="text-[11px] text-muted-foreground leading-relaxed">
              {value.apiKey?.trim()
                ? 'Direct client BYOK active. Requests bypass server model quota and billing.'
                : 'No custom key entered. Uses Aether managed cluster tokens seamlessly with zero setup.'}
            </span>
          </div>
        </div>
      )}

      {/* Hyperparameters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/60">
        <SliderWithValue
          label="Sampling Temperature"
          value={value.temperature ?? 0.7}
          onValueChange={handleTemperatureChange}
          min={0}
          max={2}
          step={0.05}
          disabled={disabled}
        />

        <SliderWithValue
          label="Max Output Tokens"
          value={value.maxTokens ?? 1024}
          onValueChange={handleMaxTokensChange}
          min={128}
          max={8192}
          step={128}
          unit=" tok"
          disabled={disabled}
        />
      </div>
    </div>
  )
}
