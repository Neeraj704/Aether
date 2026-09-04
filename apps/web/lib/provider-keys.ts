import { createClient } from '@/lib/supabase/client'

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8000'

export interface ProviderKeyMeta {
  providerId: string
  hasKey: boolean
  updatedAt: string
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session?.access_token) {
    throw new Error('Authentication required')
  }

  return {
    Authorization: `Bearer ${session.access_token}`,
  }
}

export async function fetchUserProviderKeys(): Promise<ProviderKeyMeta[]> {
  try {
    const headers = await getAuthHeader()
    const res = await fetch(`${ENGINE_URL}/account/provider-keys`, {
      headers,
      cache: 'no-store',
    })

    if (!res.ok) {
      console.warn('Failed to fetch provider keys from engine:', res.statusText)
      return []
    }

    const data = await res.json()
    return data as ProviderKeyMeta[]
  } catch (err) {
    console.error('Error in fetchUserProviderKeys:', err)
    return []
  }
}

export async function saveUserProviderKey(providerId: string, apiKey: string): Promise<ProviderKeyMeta> {
  const headers = await getAuthHeader()
  const res = await fetch(`${ENGINE_URL}/account/provider-keys`, {
    method: 'POST',
    headers: {
      ...headers,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      providerId,
      apiKey,
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || 'Failed to save provider key')
  }

  return (await res.json()) as ProviderKeyMeta
}

export async function deleteUserProviderKey(providerId: string): Promise<ProviderKeyMeta> {
  const headers = await getAuthHeader()
  const res = await fetch(`${ENGINE_URL}/account/provider-keys/${encodeURIComponent(providerId)}`, {
    method: 'DELETE',
    headers,
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(errText || 'Failed to delete provider key')
  }

  return (await res.json()) as ProviderKeyMeta
}
