import 'server-only'
import { createClient } from '@/lib/supabase/server'
import type { PlanTier } from '@/mock/layers'

export interface Profile {
  id: string
  display_name: string | null
  bio: string | null
  plan: PlanTier
  credits: number
  public_profile: boolean
  avatar_color: string | null
  created_at: string
  updated_at: string
  email?: string
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (error || !data) {
    return {
      id: user.id,
      display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Trader',
      bio: '',
      plan: 'free',
      credits: 240,
      public_profile: false,
      avatar_color: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      email: user.email,
    }
  }

  return {
    ...data,
    email: user.email,
  }
}
