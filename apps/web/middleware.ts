import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabaseResponse, user } = await updateSession(request)
  const pathname = request.nextUrl.pathname

  const authRoutes = ['/login', '/signup', '/forgot-password', '/reset-password']

  // If path starts with /app and there is no authenticated user, redirect to /login
  if (pathname.startsWith('/app') && !user) {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(redirectUrl)
  }

  // If authenticated user tries to access auth pages, redirect to /app
  if (authRoutes.includes(pathname) && user) {
    return NextResponse.redirect(new URL('/app', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
