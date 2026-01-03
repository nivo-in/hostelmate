import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

const PUBLIC_ROUTES = ['/login']

export async function middleware(request: NextRequest) {
  const { supabase, response } = createClient(request, NextResponse.next({ request }))

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isPublicRoute = PUBLIC_ROUTES.includes(request.nextUrl.pathname)

  if (!session) {
    if (!isPublicRoute) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
    return response
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single()

  const role = profile?.role

  if (isPublicRoute && role) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = `/${role}/dashboard`
    return NextResponse.redirect(redirectUrl)
  }

  const pathname = request.nextUrl.pathname

  if (pathname.startsWith('/student') && role !== 'student') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? `/${role}/dashboard` : '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.startsWith('/warden') && role !== 'warden') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? `/${role}/dashboard` : '/login'
    return NextResponse.redirect(redirectUrl)
  }

  if (pathname.startsWith('/parent') && role !== 'parent') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = role ? `/${role}/dashboard` : '/login'
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
