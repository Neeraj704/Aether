'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { PlanTier } from '@/mock/layers'
import { CURRENT_USER } from '@/mock/data'
import { slugId } from '@/lib/utils'

/* ------------------------------------------------------------------ */
/* Session store — the dev-toggleable fake auth/plan/theme state       */
/* ------------------------------------------------------------------ */

export type ThemeMode = 'light' | 'dark' | 'system'

export interface UserProfile {
  name: string
  email: string
  bio: string
  publicProfile: boolean
  initials: string
  avatarColor?: string
}

export interface UserApiKeys {
  nseKey: string
  brokerKey: string
}

export interface UserNotificationPrefs {
  emailNotifs: boolean
  drawdownAlerts: boolean
}

export interface OnboardingState {
  experience: 'beginner' | 'intermediate' | 'advanced' | null
  startChoice: 'template' | 'blank' | null
  draftBotId: string | null
}

interface SessionState {
  hydrated: boolean
  authed: boolean
  plan: PlanTier
  credits: number
  onboardingComplete: boolean
  theme: ThemeMode
  sidebarCollapsed: boolean
  /** Component ids unlocked with credits, on top of plan entitlements. */
  unlocked: string[]
  lastBotId: string | null

  profile: UserProfile
  apiKeys: UserApiKeys
  notificationPrefs: UserNotificationPrefs
  onboarding: OnboardingState

  setAuthed: (v: boolean) => void
  setPlan: (p: PlanTier) => void
  setCredits: (n: number) => void
  spendCredits: (n: number) => boolean
  addCredits: (n: number) => void
  setOnboardingComplete: (v: boolean) => void
  setOnboardingAnswer: (patch: Partial<OnboardingState>) => void
  setTheme: (t: ThemeMode) => void
  toggleSidebar: () => void
  unlock: (componentId: string) => void
  setLastBotId: (id: string) => void
  updateProfile: (patch: Partial<UserProfile>) => void
  updateApiKeys: (patch: Partial<UserApiKeys>) => void
  updateNotificationPrefs: (patch: Partial<UserNotificationPrefs>) => void
  reset: () => void
  logout: () => void
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'AM'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

const INITIAL = {
  authed: true,
  plan: CURRENT_USER.plan,
  credits: CURRENT_USER.credits,
  onboardingComplete: true,
  theme: 'system' as ThemeMode,
  sidebarCollapsed: false,
  unlocked: CURRENT_USER.unlockedComponents,
  lastBotId: null as string | null,
  profile: {
    name: CURRENT_USER.name,
    email: CURRENT_USER.email,
    bio: CURRENT_USER.bio,
    publicProfile: CURRENT_USER.publicProfile,
    initials: CURRENT_USER.initials,
  },
  apiKeys: {
    nseKey: 'nse_live_89f104829a174c',
    brokerKey: 'zk_prod_9918237402',
  },
  notificationPrefs: {
    emailNotifs: true,
    drawdownAlerts: true,
  },
  onboarding: {
    experience: null as 'beginner' | 'intermediate' | 'advanced' | null,
    startChoice: null as 'template' | 'blank' | null,
    draftBotId: null as string | null,
  },
}

export const useSession = create<SessionState>()(
  persist(
    (set, get) => ({
      hydrated: false,
      ...INITIAL,

      setAuthed: (authed) => set({ authed }),
      setPlan: (plan) => set({ plan }),
      setCredits: (credits) => set({ credits }),
      spendCredits: (n) => {
        if (get().credits < n) return false
        set({ credits: get().credits - n })
        return true
      },
      addCredits: (n) => set({ credits: get().credits + n }),
      setOnboardingComplete: (onboardingComplete) => set({ onboardingComplete }),
      setOnboardingAnswer: (patch) =>
        set({ onboarding: { ...get().onboarding, ...patch } }),
      setTheme: (theme) => set({ theme }),
      toggleSidebar: () => set({ sidebarCollapsed: !get().sidebarCollapsed }),
      unlock: (componentId) =>
        set({ unlocked: Array.from(new Set([...get().unlocked, componentId])) }),
      setLastBotId: (lastBotId) => set({ lastBotId }),
      updateProfile: (patch) => {
        const current = get().profile
        const updatedName = patch.name !== undefined ? patch.name : current.name
        const updatedInitials =
          patch.initials !== undefined
            ? patch.initials
            : patch.name !== undefined
              ? computeInitials(patch.name)
              : current.initials
        set({
          profile: {
            ...current,
            ...patch,
            name: updatedName,
            initials: updatedInitials,
          },
        })
      },
      updateApiKeys: (patch) =>
        set({
          apiKeys: { ...get().apiKeys, ...patch },
        }),
      updateNotificationPrefs: (patch) =>
        set({
          notificationPrefs: { ...get().notificationPrefs, ...patch },
        }),
      reset: () => set(INITIAL),
      logout: () => set({ ...INITIAL, authed: false }),
    }),
    {
      name: 'aether.session',
      storage: createJSONStorage(() => localStorage),
      // `hydrated` is runtime-only: it must never be read back from storage.
      partialize: ({ hydrated, ...rest }) => rest,
      onRehydrateStorage: () => () => {
        useSession.setState({ hydrated: true })
      },
    },
  ),
)

/* ------------------------------------------------------------------ */
/* Toast store — bottom-right glass stack                              */
/* ------------------------------------------------------------------ */

export type ToastKind = 'success' | 'error' | 'info' | 'unlock'

export interface Toast {
  id: string
  kind: ToastKind
  title: string
  description?: string
  duration: number
  action?: { label: string; href: string }
}

interface ToastState {
  toasts: Toast[]
  push: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => string
  dismiss: (id: string) => void
}

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  push: ({ duration = 4800, ...rest }) => {
    const id = slugId('toast')
    set({ toasts: [...get().toasts, { id, duration, ...rest }].slice(-4) })
    return id
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}))

/** Imperative helper so non-component code can raise a toast. */
export const toast = {
  success: (title: string, description?: string) =>
    useToasts.getState().push({ kind: 'success', title, description }),
  error: (title: string, description?: string) =>
    useToasts.getState().push({ kind: 'error', title, description }),
  info: (title: string, description?: string) =>
    useToasts.getState().push({ kind: 'info', title, description }),
  unlock: (title: string, description?: string) =>
    useToasts.getState().push({ kind: 'unlock', title, description }),
}

/* ------------------------------------------------------------------ */
/* Dev panel visibility (Ctrl+Shift+D) — not persisted                 */
/* ------------------------------------------------------------------ */

interface DevState {
  open: boolean
  /** Forces skeleton/error states on data-driven pages, for demoing. */
  forceState: 'normal' | 'loading' | 'empty' | 'error'
  setOpen: (v: boolean) => void
  toggle: () => void
  setForceState: (s: DevState['forceState']) => void
}

export const useDev = create<DevState>((set, get) => ({
  open: false,
  forceState: 'normal',
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
  setForceState: (forceState) => set({ forceState }),
}))
