'use client'

import { useState } from 'react'
import { Plus, Trash2, Copy, Check } from 'lucide-react'
import { API_KEYS } from '@/mock/data'
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

export default function AccountApiKeysPage() {
  const plan = useSession((s) => s.plan)
  const isPro = plan === 'pro'

  const [keys, setKeys] = useState(API_KEYS)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyScope, setNewKeyScope] = useState<'read' | 'read+write'>('read')
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState(false)

  const [deleteCandidate, setDeleteCandidate] = useState<typeof API_KEYS[0] | null>(null)

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
          Generate API credentials for headless simulation CI runners, automated scripts, and custom broker integrations
        </p>
      </div>

      <AccountNav />

      {/* Pro Gate Banner */}
      {!isPro && (
        <UpgradeNudge
          message="Programmatic REST API & SDK access is exclusive to Pro members. Upgrade your plan to generate secure live execution keys."
        />
      )}

      {/* API Keys Table */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Active API Keys</h2>
            <p className="text-xs text-muted-foreground">Authenticate requests via Bearer token in the Authorization header</p>
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

      {/* Generate Key Modal */}
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
