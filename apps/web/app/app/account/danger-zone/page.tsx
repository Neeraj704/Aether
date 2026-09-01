'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Download, Trash2, ShieldAlert } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-store'
import { useSession, toast } from '@/lib/store'
import { AccountNav } from '@/components/account/account-nav'
import { PillButton } from '@/components/ui/pill-button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input, Field } from '@/components/ui/input'

export default function AccountDangerZonePage() {
  const router = useRouter()
  const workspaceState = useWorkspace.getState()
  const sessionState = useSession.getState()
  const resetWorkspace = useWorkspace((s) => s.resetWorkspace)
  const logout = useSession((s) => s.logout)

  const [deleteOpen, setDeleteOpen] = useState(false)
  const [confirmInput, setConfirmInput] = useState('')

  const handleExportData = () => {
    const exportBundle = {
      exportedAt: new Date().toISOString(),
      user: sessionState.profile,
      plan: sessionState.plan,
      credits: sessionState.credits,
      bots: workspaceState.bots,
      runs: workspaceState.runs,
      myPresets: workspaceState.myPresets,
      publishedPresets: workspaceState.publishedPresets,
    }

    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportBundle, null, 2))}`
    const downloadAnchor = document.createElement('a')
    downloadAnchor.setAttribute('href', dataStr)
    downloadAnchor.setAttribute('download', `aether-workspace-export-${Date.now()}.json`)
    document.body.appendChild(downloadAnchor)
    downloadAnchor.click()
    downloadAnchor.remove()
    toast.success('Data Exported', 'Full workspace JSON archive downloaded.')
  }

  const handleDeleteAccount = () => {
    if (confirmInput.toLowerCase() !== 'delete my account') return
    resetWorkspace()
    logout()
    toast.info('Account Deleted', 'Your workspace and data have been wiped.')
    router.push('/')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1000px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Account & Security</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Export full quantitative archives or permanently destroy your account and all associated strategies
        </p>
      </div>

      <AccountNav />

      {/* Export Data */}
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold flex items-center gap-2">
            <Download className="size-4 text-brand" /> Export Complete Workspace Archive
          </h2>
          <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
            Download a portable JSON payload containing all trading bot graphs, saved presets, historical backtest logs, and node configurations.
          </p>
        </div>

        <PillButton variant="secondary" onClick={handleExportData} className="gap-2 shrink-0">
          <Download className="size-4" /> Export All Data (.json)
        </PillButton>
      </div>

      {/* Delete Account */}
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-bold flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-4" /> Permanently Delete Account
          </h2>
          <p className="text-xs text-muted-foreground max-w-lg leading-relaxed">
            Permanently erase your identity, subscription entitlements, private presets, and all backtest history. This action cannot be undone.
          </p>
        </div>

        <PillButton
          variant="destructive"
          onClick={() => setDeleteOpen(true)}
          className="gap-2 shrink-0 shadow-lg shadow-destructive/20"
        >
          <Trash2 className="size-4" /> Delete Account
        </PillButton>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteOpen && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-destructive flex items-center gap-2">
                <ShieldAlert className="size-5" /> Delete Account Confirmation
              </DialogTitle>
              <DialogDescription>
                This will immediately purge your entire workspace and erase all strategies. Type <strong>delete my account</strong> below to confirm.
              </DialogDescription>
            </DialogHeader>

            <DialogBody className="flex flex-col gap-3">
              <Field label="Confirmation Prompt" htmlFor="confirm-delete">
                <Input
                  id="confirm-delete"
                  value={confirmInput}
                  onChange={(e) => setConfirmInput(e.target.value)}
                  placeholder="delete my account"
                  className="border-destructive/40"
                  autoFocus
                />
              </Field>
            </DialogBody>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </PillButton>
              <PillButton
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={confirmInput.toLowerCase() !== 'delete my account'}
              >
                Permanently Delete Everything
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
