import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Create the Supabase client
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Resolve session
  const { data: { user } } = await supabase.auth.getUser()

  const { pathname, searchParams } = request.nextUrl

  // Force escape hatch for development
  if (searchParams.get('force_dashboard') === '1') {
    supabaseResponse.cookies.set('onboarding_complete', 'true', { path: '/' })
    return supabaseResponse
  }

  // Protected routes
  if (pathname.startsWith('/dashboard')) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    const onboardingComplete = request.cookies.get('onboarding_complete')?.value
    if (onboardingComplete !== 'true') {
      return NextResponse.redirect(new URL('/avatar-select', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/dashboard/:path*'],
}
