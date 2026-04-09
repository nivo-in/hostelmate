import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// 1. Edge Rate Limiting (Phase 1)
const ratelimit = process.env.UPSTASH_REDIS_REST_URL
  ? new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(50, '10 s'),
      analytics: true,
    })
  : null;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Execute Edge Rate Limiting for all API routes
  if (ratelimit && pathname.startsWith('/api/')) {
    const ip = request.headers.get('x-forwarded-for') ?? '127.0.0.1';
    const { success, limit, reset, remaining } = await ratelimit.limit(`ratelimit_${ip}`);

    if (!success) {
      return new NextResponse(
        JSON.stringify({ error: 'Too Many Requests - Rate Limit Exceeded' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
          },
        }
      );
    }
  }

  // 2. Strict Middleware Role Enforcement (Zero Trust Architecture)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const publicPaths = ['/', '/login', '/demo'];
  const isPublicPath = publicPaths.includes(pathname);
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/favicon.ico') || pathname.includes('.');

  // If no user, only allow public paths or static assets
  if (!user) {
    if (!isPublicPath && !isStaticAsset) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return response;
  }

  // We have a user. If they are requesting a static asset, just let it pass
  if (isStaticAsset) {
    return response;
  }

  // Extract role securely. Fallback to profiles table if JWT metadata is missing the role.
  let role = user.user_metadata?.role;
  if (!role) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    role = profile?.role || 'student';
  }

  // Convenience redirect: If logged in and hitting /login, go to dashboard
  if (pathname === '/login') {
    return NextResponse.redirect(new URL(`/${role}/dashboard`, request.url));
  }

  // Zero Trust Cross-Role Boundary Violations
  // Drops the request at the edge with a 403-style redirect before hitting app logic
  if (pathname.startsWith('/warden') && role !== 'warden') {
    return NextResponse.redirect(new URL('/login?error=Forbidden', request.url));
  }
  if (pathname.startsWith('/student') && role !== 'student') {
    return NextResponse.redirect(new URL('/login?error=Forbidden', request.url));
  }
  if (pathname.startsWith('/parent') && role !== 'parent') {
    return NextResponse.redirect(new URL('/login?error=Forbidden', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
