'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Copy, Check, Key, ShieldCheck, Cpu, Loader2, Edit3 } from 'lucide-react'
import { API_KEYS } from '@/mock/data'
import { PROVIDERS } from '@/mock/models'
import { useSession, toast } from '@/lib/store'
import { AccountNav } from '@/components/account/account-nav'
import { PillButton } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { UpgradeNudge } from '@/components/ui/empty-state'
import { Table, THead, TBody, TR, TH, TD } from '@/components/ui/table'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input, Field } from '@/components/ui/input'
import { Segmented } from '@/components/ui/tabs'
import { formatDate, slugId } from '@/lib/utils'
import {
  fetchUserProviderKeys,
  saveUserProviderKey,
  deleteUserProviderKey,
  type ProviderKeyMeta,
} from '@/lib/provider-keys'

export default function AccountApiKeysPage() {
  const plan = useSession((s) => s.plan)
  const isPro = plan === 'pro'

  // Platform REST API keys state (mock)
  const [keys, setKeys] = useState(API_KEYS)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScope, setNewKeyScope] = useState<'read' | 'read+write'>('read')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)
  const [deleteCandidate, setDeleteCandidate] = useState<typeof API_KEYS[0] | null>(null)

  // LLM Provider Keys (Real Vault)
  const [providerKeys, setProviderKeys] = useState<ProviderKeyMeta[]>([])
  const [loadingProviderKeys, setLoadingProviderKeys] = useState(true)
  const [editProvider, setEditProvider] = useState<{ id: string; name: string } | null>(null)
  const [providerKeyInput, setProviderKeyInput] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [deleteProviderCandidate, setDeleteProviderCandidate] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState(false)

  const cloudProviders = PROVIDERS.filter((p) => p.kind === 'hosted')

  useEffect(() => {
    loadProviderKeys()
  }, [])

  async function loadProviderKeys() {
    setLoadingProviderKeys(true)
    try {
      const metas = await fetchUserProviderKeys()
      setProviderKeys(metas)
    } catch {
      // Ignored if unauthenticated
    } finally {
      setLoadingProviderKeys(false)
    }
  }

  const handleSaveProviderKey = async () => {
    if (!editProvider || !providerKeyInput.trim()) return
    setSavingKey(true)
    try {
      await saveUserProviderKey(editProvider.id, providerKeyInput.trim())
      toast.success(
        `${editProvider.name} Key Vaulted`,
        'Your custom API key was encrypted and stored securely in your private vault.',
      )
      setEditProvider(null)
      setProviderKeyInput('')
      await loadProviderKeys()
    } catch (err: any) {
      toast.error('Failed to Vault Key', err?.message || 'Network error saving provider key.')
    } finally {
      setSavingKey(false)
    }
  }

  const handleDeleteProviderKey = async () => {
    if (!deleteProviderCandidate) return
    setDeletingKey(true)
    try {
      await deleteUserProviderKey(deleteProviderCandidate)
      toast.success('Provider Key Removed', 'The stored key was permanently deleted from your vault.')
      setDeleteProviderCandidate(null)
      await loadProviderKeys()
    } catch (err: any) {
      toast.error('Failed to Delete Key', err?.message || 'Error removing provider key.')
    } finally {
      setDeletingKey(false)
    }
  }

  const handleGenerateKey = () => {
    if (!newKeyName.trim()) return
    const rawSecret = `ae_live_${slugId('key')}_${Math.random().toString(36).slice(2, 10)}`
    const prefix = rawSecret.slice(0, 12)

    const createdKey = {
      id: slugId('ak'),
      name: newKeyName.trim(),
      scope: newKeyScope,
      prefix,
      createdAt: new Date().toISOString(),
      lastUsed: 'Just now',
    }

    setKeys((prev) => [createdKey, ...prev])
    setRevealedKey(rawSecret)
    setNewKeyName('')
  }

  const handleRevoke = () => {
    if (!deleteCandidate) return
    setKeys((prev) => prev.filter((k) => k.id !== deleteCandidate.id))
    toast.success('API Key Revoked', `Key "${deleteCandidate.name}" has been disabled.`)
    setDeleteCandidate(null)
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1100px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage your secure LLM provider credentials (BYOK) and generate programmatic API keys for headless simulation
        </p>
      </div>

      <AccountNav />

      {/* 1. Real LLM Provider Keys (BYOK Vault) */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="size-5 text-brand" /> LLM Provider Keys (BYOK Vault)
            </h2>
            <p className="text-xs text-muted-foreground">
              Vault your personal AI provider API keys with Fernet application-layer encryption. Keys bypass credit billing and are never exposed in bot graphs or audit trails.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Provider</TH>
                <TH>Status</TH>
                <TH>Encryption & Storage</TH>
                <TH>Last Updated</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {cloudProviders.map((provider) => {
                const meta = providerKeys.find(
                  (k) => k.providerId.toLowerCase() === provider.id.toLowerCase() && k.hasKey,
                )
                const hasKey = Boolean(meta?.hasKey)

                return (
                  <TR key={provider.id}>
                    <TD className="pl-4 font-semibold text-xs text-foreground">
                      <div className="flex items-center gap-2">
                        <Cpu className="size-3.5 text-brand" />
                        <span>{provider.name}</span>
                      </div>
                    </TD>
                    <TD>
                      <Badge variant={hasKey ? 'profit' : 'neutral'} size="sm">
                        {hasKey ? 'Vaulted (Active)' : 'Not Configured'}
                      </Badge>
                    </TD>
                    <TD className="text-xs text-muted-foreground font-mono">
                      {hasKey ? '•••••••••••• (Encrypted)' : 'Using Managed Server Gateway'}
                    </TD>
                    <TD className="text-xs text-muted-foreground">
                      {meta?.updatedAt ? formatDate(meta.updatedAt) : '—'}
                    </TD>
                    <TD className="pr-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <PillButton
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditProvider({ id: provider.id, name: provider.name })
                            setProviderKeyInput('')
                          }}
                          className="h-7 text-xs gap-1"
                        >
                          <Edit3 className="size-3" />
                          {hasKey ? 'Update' : 'Add Key'}
                        </PillButton>
                        {hasKey && (
                          <button
                            type="button"
                            onClick={() => setDeleteProviderCandidate(provider.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                            title={`Remove ${provider.name} key`}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                )
              })}
            </TBody>
          </Table>
        </div>
      </div>

      {/* Pro Gate Banner for Platform API */}
      {!isPro && (
        <UpgradeNudge
          message="Programmatic REST API & SDK access is exclusive to Pro members. Upgrade your plan to generate secure live execution keys."
        />
      )}

      {/* 2. Platform REST API Keys Table */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Platform REST API Keys</h2>
            <p className="text-xs text-muted-foreground">Authenticate external requests via Bearer token in the Authorization header</p>
          </div>

          <PillButton
            onClick={() => setGenerateOpen(true)}
            disabled={!isPro}
            className="gap-2 shadow-lg shadow-brand/20"
          >
            <Plus className="size-4" /> Generate New Key
          </PillButton>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border bg-card">
          <Table>
            <THead>
              <TR>
                <TH className="pl-4">Name / Purpose</TH>
                <TH>Scope</TH>
                <TH>Key Prefix</TH>
                <TH>Created</TH>
                <TH>Last Used</TH>
                <TH className="pr-4 text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {keys.map((k) => (
                <TR key={k.id}>
                  <TD className="pl-4 font-semibold text-xs text-foreground">{k.name}</TD>
                  <TD>
                    <Badge variant={k.scope === 'read+write' ? 'gold' : 'brand'} size="sm">
                      {k.scope}
                    </Badge>
                  </TD>
                  <TD className="font-mono text-xs text-tertiary">{k.prefix}••••</TD>
                  <TD className="text-xs text-muted-foreground">{formatDate(k.createdAt)}</TD>
                  <TD className="text-xs text-muted-foreground">{k.lastUsed}</TD>
                  <TD className="pr-4 text-right">
                    <button
                      type="button"
                      onClick={() => setDeleteCandidate(k)}
                      className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
                      title="Revoke API key"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      </div>

      {/* Edit/Add Provider Key Modal */}
      {editProvider && (
        <Dialog
          open={Boolean(editProvider)}
          onOpenChange={(open) => {
            if (!open) {
              setEditProvider(null)
              setProviderKeyInput('')
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="size-4 text-brand" /> Vault {editProvider.name} API Key
              </DialogTitle>
              <DialogDescription>
                Paste your secret API key. It will be encrypted immediately and stored in your private BYOK vault.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Field
                label={`${editProvider.name} API Key`}
                htmlFor="provider-key-input"
                help="Your key is never logged, never returned to browsers in plaintext, and never stored in bot graphs."
              >
                <Input
                  id="provider-key-input"
                  type="password"
                  value={providerKeyInput}
                  onChange={(e) => setProviderKeyInput(e.target.value)}
                  placeholder="sk-... or gsk_..."
                  className="font-mono text-xs"
                />
              </Field>

              <div className="p-3 rounded-xl border border-border bg-secondary/40 text-xs text-muted-foreground leading-relaxed">
                Nodes with <strong>BYOK enabled</strong> will use this vaulted credential, reducing Aether credit costs to 0.
              </div>
            </div>

            <DialogFooter>
              <PillButton
                variant="secondary"
                disabled={savingKey}
                onClick={() => {
                  setEditProvider(null)
                  setProviderKeyInput('')
                }}
              >
                Cancel
              </PillButton>
              <PillButton
                disabled={!providerKeyInput.trim() || savingKey}
                onClick={handleSaveProviderKey}
                className="gap-1.5"
              >
                {savingKey ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
                Save to Vault
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Provider Key Confirmation */}
      {deleteProviderCandidate && (
        <ConfirmDialog
          open={Boolean(deleteProviderCandidate)}
          onOpenChange={(open) => !open && setDeleteProviderCandidate(null)}
          title="Remove Provider Key?"
          description="Are you sure you want to delete this vaulted API key? Any agent nodes configured for BYOK will automatically fall back to Aether's managed server gateway."
          confirmLabel={deletingKey ? 'Deleting...' : 'Delete Key'}
          destructive
          onConfirm={handleDeleteProviderKey}
        />
      )}

      {/* Generate Platform Key Modal */}
      {generateOpen && (
        <Dialog
          open={generateOpen}
          onOpenChange={(open) => {
            if (!open) {
              setGenerateOpen(false)
              setRevealedKey(null)
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{revealedKey ? 'API Key Generated' : 'Create API Key'}</DialogTitle>
              <DialogDescription>
                {revealedKey
                  ? 'Copy your secret key now. You will not be able to see it again!'
                  : 'Specify a descriptive name and access scope for your new API key.'}
              </DialogDescription>
            </DialogHeader>

            {revealedKey ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-profit flex items-center gap-1">
                    <Check className="size-4" /> Secret Key (One-time view)
                  </span>
                  <div className="flex items-center gap-2">
                    <Input readOnly value={revealedKey} className="text-xs font-mono select-all bg-secondary/80" />
                    <PillButton
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(revealedKey)
                        setCopiedKey(true)
                        toast.success('Key Copied to Clipboard')
                        setTimeout(() => setCopiedKey(false), 2000)
                      }}
                      className="gap-1 shrink-0"
                    >
                      {copiedKey ? <Check className="size-3.5 text-profit" /> : <Copy className="size-3.5" />}
                      {copiedKey ? 'Copied' : 'Copy'}
                    </PillButton>
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-warn/30 bg-warn/10 text-xs text-warn leading-relaxed">
                  Store this key securely in your environment variables. Never commit secrets to public repositories.
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-4 py-2">
                <Field label="Key Name / Identifier" htmlFor="key-name">
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g. Backtest CI Runner"
                  />
                </Field>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold">Access Scope</span>
                  <Segmented<'read' | 'read+write'>
                    value={newKeyScope}
                    onValueChange={setNewKeyScope}
                    options={[
                      { value: 'read', label: 'Read-Only' },
                      { value: 'read+write', label: 'Read & Write' },
                    ]}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {revealedKey ? (
                <PillButton
                  onClick={() => {
                    setGenerateOpen(false)
                    setRevealedKey(null)
                  }}
                >
                  Done
                </PillButton>
              ) : (
                <>
                  <PillButton variant="secondary" onClick={() => setGenerateOpen(false)}>
                    Cancel
                  </PillButton>
                  <PillButton onClick={handleGenerateKey} disabled={!newKeyName.trim()}>
                    Generate Key
                  </PillButton>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Revoke Confirmation */}
      {deleteCandidate && (
        <ConfirmDialog
          open={Boolean(deleteCandidate)}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Revoke API Key?"
          description={`Are you sure you want to revoke "${deleteCandidate.name}"? Any external runner or service using this key will immediately fail authentication.`}
          confirmLabel="Revoke Key"
          destructive
          onConfirm={handleRevoke}
        />
      )}
    </div>
  )
}
