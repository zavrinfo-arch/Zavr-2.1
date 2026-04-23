import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Force escape hatch — set cookie and proceed
  if (searchParams.get('force_dashboard') === '1') {
    console.log('[middleware] force_dashboard — bypassing');
    const res = NextResponse.next();
    res.cookies.set('onboarding_complete', 'true', {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
      sameSite: 'strict',
    });
    return res;
  }

  const onboardingComplete = request.cookies.get('onboarding_complete')?.value;
  console.log('[middleware] /dashboard hit — cookie:', onboardingComplete);

  if (onboardingComplete !== 'true') {
    console.log('[middleware] no cookie — redirecting to /avatar-select');
    return NextResponse.redirect(new URL('/avatar-select', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};