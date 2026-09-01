import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/app'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Determine if this is a first-time user (0 bots in database)
      let destination = next
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user && next === '/app') {
        const { count } = await supabase
          .from('bots')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)

        if (count === 0) {
          destination = '/onboarding/welcome'
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host')
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${destination}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${destination}`)
      } else {
        return NextResponse.redirect(`${origin}${destination}`)
      }
    }
  }

  // Return to login with error query param
  return NextResponse.redirect(`${origin}/login?error=Could+not+authenticate+user`)
}
