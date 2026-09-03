import { createClient } from '@/lib/supabase/client'
import type { PlanTier } from '@/mock/layers'
import { useSession, toast } from '@/lib/store'

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'

export interface BillingTransaction {
  id: string
  amount: number
  reason: string
  paymentId?: string | null
  createdAt: string
}

export interface BillingPayment {
  id: string
  orderId: string
  paymentId?: string | null
  amount: number
  currency: string
  kind: 'subscription' | 'credit_topup'
  status: 'created' | 'paid' | 'failed'
  createdAt: string
}

export interface BillingState {
  plan: PlanTier
  status: 'active' | 'cancelled' | 'past_due'
  currentPeriodEnd?: string | null
  creditBalance: number
  transactions: BillingTransaction[]
  payments: BillingPayment[]
}

export interface CheckoutOptions {
  kind: 'subscription' | 'credit_topup'
  plan?: PlanTier
  cycle?: 'monthly' | 'annual'
  creditAmount?: number
  name?: string
  description?: string
  onSuccess?: (state: BillingState) => void
  onError?: (error: Error) => void
}

/**
 * Load Razorpay checkout.js script asynchronously if not already loaded.
 */
function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') {
      resolve(false)
      return
    }
    if ((window as any).Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.async = true
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * Retrieve the current authenticated user's real billing state from the FastAPI engine.
 */
export async function getBillingState(): Promise<BillingState | null> {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (!session) return null

    const res = await fetch(`${ENGINE_URL}/billing/state`, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!res.ok) {
      console.warn('Failed to fetch billing state from engine:', res.statusText)
      return null
    }

    const data = await res.json()
    return data as BillingState
  } catch (err) {
    console.error('Error in getBillingState:', err)
    return null
  }
}

/**
 * Creates an authoritative order on the engine and launches the Razorpay Checkout modal.
 */
export async function startCheckout(options: CheckoutOptions): Promise<BillingState | null> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    toast.error('Authentication Required', 'Please log in to make a payment.')
    throw new Error('User not authenticated')
  }

  // 1. Create order on engine
  const res = await fetch(`${ENGINE_URL}/billing/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      kind: options.kind,
      plan: options.plan || 'pro',
      cycle: options.cycle || 'monthly',
      creditAmount: options.creditAmount || 100,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Failed to initialize checkout: ${errText}`)
  }

  const orderData = await res.json()
  const { orderId, amount, currency, keyId } = orderData

  const scriptLoaded = await loadRazorpayScript()
  if (!scriptLoaded) {
    throw new Error('Failed to load Razorpay payment gateway SDK.')
  }

  return new Promise((resolve, reject) => {
    const user = session.user
    const rzpOptions = {
      key: keyId || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_mockkeyid123',
      amount: amount,
      currency: currency || 'INR',
      name: 'AETHER Platform',
      description:
        options.description ||
        (options.kind === 'subscription'
          ? `AETHER ${(options.plan || 'pro').toUpperCase()} Plan (${options.cycle || 'monthly'})`
          : `${options.creditAmount || 100} Simulation Credits`),
      order_id: orderId,
      prefill: {
        name: user.user_metadata?.name || user.email?.split('@')[0] || 'Aether Trader',
        email: user.email || '',
      },
      theme: {
        color: '#3b82f6',
      },
      handler: async function (response: {
        razorpay_payment_id: string
        razorpay_order_id: string
        razorpay_signature: string
      }) {
        try {
          const verifyRes = await fetch(`${ENGINE_URL}/billing/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id || orderId,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          })

          if (!verifyRes.ok) {
            throw new Error('Server verification of payment signature failed')
          }

          const newState = (await verifyRes.json()) as BillingState

          // Update local session cache
          if (newState.plan) {
            useSession.getState().setPlan(newState.plan)
          }
          if (typeof newState.creditBalance === 'number') {
            useSession.getState().setCredits(newState.creditBalance)
          }

          options.onSuccess?.(newState)
          resolve(newState)
        } catch (vErr: any) {
          console.error('Payment verification error:', vErr)
          options.onError?.(vErr)
          reject(vErr)
        }
      },
      modal: {
        ondismiss: function () {
          const dismissErr = new Error('Checkout cancelled by user')
          options.onError?.(dismissErr)
          reject(dismissErr)
        },
      },
    }

    try {
      const rzpInstance = new (window as any).Razorpay(rzpOptions)
      rzpInstance.open()
    } catch (openErr) {
      console.error('Failed to open Razorpay modal:', openErr)
      reject(openErr)
    }
  })
}
