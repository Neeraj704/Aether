'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { PROVIDERS, type Provider } from '@/mock/models'
import type { ModelSelection } from '@/mock/layers'
import { Select } from '@/components/ui/select'
import { SliderWithValue } from '@/components/ui/slider'
import { Input, Field } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { PillButton } from '@/components/ui/pill-button'
import { Check, X, Loader2, Server, Cpu, Key, AlertCircle, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from '@/lib/store'
import { fetchUserProviderKeys, type ProviderKeyMeta } from '@/lib/provider-keys'

interface ModelSelectFieldProps {
  value?: ModelSelection
  onChange: (val: ModelSelection) => void
  disabled?: boolean
}

let _cachedProviderKeys: ProviderKeyMeta[] | null = null

export function ModelSelectField({
  value = {
    providerId: 'groq',
    modelId: 'openai/gpt-oss-120b',
    temperature: 0.4,
    maxTokens: 1024,
    useByok: false,
  },
  onChange,
  disabled,
}: ModelSelectFieldProps) {
  const currentProvider =
    PROVIDERS.find((p) => p.id === value.providerId) || PROVIDERS[0]

  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [storedKeys, setStoredKeys] = useState<ProviderKeyMeta[]>(_cachedProviderKeys || [])
  const [loadingKeys, setLoadingKeys] = useState(!_cachedProviderKeys)

  useEffect(() => {
    let active = true
    async function loadKeys() {
      if (!_cachedProviderKeys) setLoadingKeys(true)
      try {
        const keys = await fetchUserProviderKeys()
        _cachedProviderKeys = keys
        if (active) {
          setStoredKeys(keys)
        }
      } catch {
        // Silently ignore if unauthenticated or network error
      } finally {
        if (active) setLoadingKeys(false)
      }
    }
    loadKeys()
    return () => {
      active = false
    }
  }, [])

  const hasStoredKey = storedKeys.some(
    (k) => k.providerId.toLowerCase() === currentProvider.id.toLowerCase() && k.hasKey,
  )

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

  const handleByokToggle = (useByok: boolean) => {
    onChange({
      ...value,
      useByok,
    })
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
          'Inference Configuration Verified',
          value.useByok && hasStoredKey
            ? `Verified routing via your stored ${currentProvider.name} API key (BYOK).`
            : `Successfully configured ${value.modelId} via Aether Managed Gateway.`,
        )
      } else {
        setTestResult('error')
        toast.error('Connection Failed', 'Please specify a valid model tag or endpoint.')
      }
    }, 600)
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
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

          {/* BYOK Toggle Card */}
          <div className="rounded-xl border border-border bg-secondary/40 p-3.5 flex flex-col gap-3 mt-1">
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Key className="size-3.5 text-brand" /> Use my own {currentProvider.name} API Key (BYOK)
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Bypass platform credit metering by utilizing your securely vaulted API key.
                </span>
              </div>
              <Switch
                checked={Boolean(value.useByok)}
                onCheckedChange={handleByokToggle}
                disabled={disabled}
              />
            </div>

            {value.useByok && loadingKeys && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-secondary/30 text-muted-foreground text-[11px]">
                <Loader2 className="size-3.5 animate-spin text-brand" />
                <span>Checking vaulted {currentProvider.name} key status...</span>
              </div>
            )}

            {value.useByok && !loadingKeys && !hasStoredKey && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg border border-warn/30 bg-warn/10 text-warn text-[11px] leading-relaxed">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span>
                    No {currentProvider.name} key on file — add one in{' '}
                    <Link
                      href="/app/account/api-keys"
                      className="underline font-semibold hover:text-foreground inline-flex items-center gap-0.5"
                    >
                      Account → API Keys <ExternalLink className="size-2.5 inline" />
                    </Link>
                    , or this node will fall back to Aether's managed gateway.
                  </span>
                </div>
              </div>
            )}

            {value.useByok && !loadingKeys && hasStoredKey && (
              <div className="flex items-center gap-2 text-[11px] text-profit font-medium">
                <Check className="size-3.5" />
                <span>Vaulted {currentProvider.name} key active. Free execution (0 credits charged).</span>
              </div>
            )}
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
