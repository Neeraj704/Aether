'use client'

import { useState } from 'react'
import {
  CreditCard,
  Plus,
  Trash2,
  Smartphone,
  CheckCircle2,
} from 'lucide-react'
import { PAYMENT_METHODS, type PaymentMethod } from '@/mock/data'
import { toast } from '@/lib/store'
import { BillingNav } from '@/components/billing/billing-nav'
import { PillButton } from '@/components/ui/pill-button'
import { Badge } from '@/components/ui/badge'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Segmented } from '@/components/ui/tabs'
import { Input, Field } from '@/components/ui/input'
import { cn, slugId } from '@/lib/utils'

export default function PaymentMethodsPage() {
  const [methods, setMethods] = useState<PaymentMethod[]>(PAYMENT_METHODS)
  const [deleteCandidate, setDeleteCandidate] = useState<PaymentMethod | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  const [addType, setAddType] = useState<'card' | 'upi'>('card')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardBank, setCardBank] = useState('HDFC Bank')
  const [upiId, setUpiId] = useState('')

  const handleSetDefault = (id: string) => {
    setMethods((prev) =>
      prev.map((m) => ({
        ...m,
        isDefault: m.id === id,
      })),
    )
    toast.success('Default Updated', 'Primary payment method changed successfully.')
  }

  const handleDelete = () => {
    if (!deleteCandidate) return
    setMethods((prev) => prev.filter((m) => m.id !== deleteCandidate.id))
    toast.success('Payment Method Removed', `${deleteCandidate.label} has been deleted.`)
    setDeleteCandidate(null)
  }

  const handleAddPaymentMethod = () => {
    let newMethod: PaymentMethod
    if (addType === 'card') {
      const last4 = cardNumber.slice(-4) || '1234'
      newMethod = {
        id: slugId('pm'),
        kind: 'card',
        label: `${cardBank} ·· ${last4}`,
        detail: `Visa, expires ${cardExpiry || '12/2030'}`,
        isDefault: methods.length === 0,
      }
    } else {
      newMethod = {
        id: slugId('pm'),
        kind: 'upi',
        label: upiId || 'user@okhdfcbank',
        detail: 'UPI autopay mandate, active',
        isDefault: methods.length === 0,
      }
    }

    setMethods((prev) => [newMethod, ...prev])
    toast.success('Payment Method Added', `${newMethod.label} added to your account.`)
    setAddOpen(false)
    setCardNumber('')
    setCardExpiry('')
    setUpiId('')
  }

  return (
    <div className="flex flex-col gap-8 p-6 lg:p-8 max-w-[1400px] mx-auto w-full">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Billing & Subscriptions</h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          Manage cards, UPI mandates, and default payment mechanisms for automatic billing
        </p>
      </div>

      <BillingNav />

      {/* Payment Methods Section */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Saved Payment Methods</h2>
            <p className="text-xs text-muted-foreground">Used for monthly plan renewals and instant credit top-ups</p>
          </div>

          <PillButton onClick={() => setAddOpen(true)} className="gap-2 shadow-lg shadow-brand/20">
            <Plus className="size-4" /> Add Payment Method
          </PillButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {methods.map((method) => (
            <div
              key={method.id}
              className={cn(
                'flex flex-col justify-between rounded-2xl border p-5 bg-card transition-all relative',
                method.isDefault ? 'border-brand/60 ring-1 ring-brand/30 shadow-md shadow-brand/5' : 'border-border',
              )}
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-brand">
                      {method.kind === 'card' ? <CreditCard className="size-5" /> : <Smartphone className="size-5" />}
                    </div>
                    <div className="flex flex-col">
                      <h3 className="font-bold text-sm text-foreground">{method.label}</h3>
                      <span className="text-xs text-muted-foreground">{method.detail}</span>
                    </div>
                  </div>

                  {method.isDefault && (
                    <Badge variant="brand" size="sm">
                      Default
                    </Badge>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-3 border-t border-border flex items-center justify-between">
                {method.isDefault ? (
                  <span className="text-xs font-semibold text-profit flex items-center gap-1">
                    <CheckCircle2 className="size-3.5" /> Primary Method
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(method.id)}
                    className="text-xs font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Set as Default
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setDeleteCandidate(method)}
                  disabled={method.isDefault && methods.length > 1}
                  className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:hover:text-muted-foreground disabled:hover:bg-transparent cursor-pointer"
                  title="Remove payment method"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation */}
      {deleteCandidate && (
        <ConfirmDialog
          open={Boolean(deleteCandidate)}
          onOpenChange={(open) => !open && setDeleteCandidate(null)}
          title="Remove Payment Method?"
          description={`Are you sure you want to remove ${deleteCandidate.label}? You will need to re-authorize before using it again.`}
          confirmLabel="Remove Method"
          destructive
          onConfirm={handleDelete}
        />
      )}

      {/* Add Payment Method Modal */}
      {addOpen && (
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Payment Method</DialogTitle>
              <DialogDescription>
                Add a new debit/credit card or UPI autopay mandate.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4 py-2">
              <Segmented<'card' | 'upi'>
                value={addType}
                onValueChange={setAddType}
                options={[
                  { value: 'card', label: 'Credit / Debit Card' },
                  { value: 'upi', label: 'UPI Autopay' },
                ]}
              />

              {addType === 'card' ? (
                <div className="flex flex-col gap-3">
                  <Field label="Card Number" htmlFor="card-num">
                    <Input
                      id="card-num"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="4242 •••• •••• 4242"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Expiry (MM/YY)" htmlFor="card-exp">
                      <Input
                        id="card-exp"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="12/28"
                      />
                    </Field>
                    <Field label="Bank Name" htmlFor="card-bank">
                      <Input
                        id="card-bank"
                        value={cardBank}
                        onChange={(e) => setCardBank(e.target.value)}
                        placeholder="ICICI / HDFC / SBI"
                      />
                    </Field>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <Field label="UPI ID / VPA" htmlFor="upi-id">
                    <Input
                      id="upi-id"
                      value={upiId}
                      onChange={(e) => setUpiId(e.target.value)}
                      placeholder="username@okhdfcbank"
                    />
                  </Field>
                  <span className="text-[11px] text-muted-foreground">
                    A ₹1 test mandate authorization will be sent to your UPI app.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter>
              <PillButton variant="secondary" onClick={() => setAddOpen(false)}>
                Cancel
              </PillButton>
              <PillButton onClick={handleAddPaymentMethod}>
                Save Payment Method
              </PillButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
