import { auth } from '@/lib/auth/auth'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { UserRole } from '@prisma/client'

// Routes that require authentication
const protectedRoutes = ['/dashboard']

// Routes that require SUPER_ADMIN role
const superAdminRoutes = ['/dashboard/users']

// Routes that require access to the Control module (caja interna).
// Open to SUPER_ADMIN, or to any active user with the canAccessControl flag.
const controlRoutes = ['/dashboard/control']

// Public routes (accessible without authentication)
const publicRoutes = ['/login', '/']

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Get session
  const session = await auth()

  // Check if route is protected
  const isProtectedRoute = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Check if route requires SUPER_ADMIN
  const requiresSuperAdmin = superAdminRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Check if route requires Control module access
  const requiresControlAccess = controlRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Check if route is public
  const isPublicRoute = publicRoutes.some((route) => pathname === route)

  // Redirect to login if trying to access protected route without session
  if (isProtectedRoute && !session) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect to dashboard if already logged in and trying to access login
  if (pathname === '/login' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Check SUPER_ADMIN authorization
  if (requiresSuperAdmin && session) {
    if (session.user.role !== UserRole.SUPER_ADMIN) {
      // Redirect to dashboard with error
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(dashboardUrl)
    }
  }

  // Check Control module authorization.
  //
  // This reads the JWT, which can be up to 30 days stale — it is a cheap gate
  // that keeps unauthorized users from ever seeing the UI, NOT the real
  // authorization. Every page and Server Action under /dashboard/control must
  // call requireControlAccess() from lib/auth/rbac.ts, which hits the database.
  if (requiresControlAccess && session) {
    const allowed =
      session.user.role === UserRole.SUPER_ADMIN ||
      session.user.canAccessControl === true

    if (!allowed) {
      const dashboardUrl = new URL('/dashboard', request.url)
      dashboardUrl.searchParams.set('error', 'unauthorized')
      return NextResponse.redirect(dashboardUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (images, etc)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.png|.*\\.jpg|.*\\.jpeg|.*\\.gif|.*\\.svg|.*\\.webp).*)',
  ],
}
