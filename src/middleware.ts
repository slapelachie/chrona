import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_PATHS = [
  '/setup',
  '/api/setup/status',
  '/api/setup/init',
]

const PUBLIC_PREFIXES = [
  '/_next',
  '/favicon',
  '/icon',
  '/images',
  '/fonts',
  '/robots.txt',
  '/sitemap.xml',
  '/manifest.webmanifest',
]

const INTERNAL_PROBE_HEADER = 'x-internal-setup-probe'

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.includes(pathname) ||
  PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
  /\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|bmp|css|js)$/.test(pathname)

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (request.headers.get(INTERNAL_PROBE_HEADER) === '1') {
    return NextResponse.next()
  }

  if (isPublicPath(pathname) || request.method === 'OPTIONS') {
    return NextResponse.next()
  }

  let initialized = false

  try {
    const statusUrl = new URL('/api/setup/status', request.url)
    const statusResponse = await fetch(statusUrl, {
      headers: { [INTERNAL_PROBE_HEADER]: '1' },
      cache: 'no-store',
    })

    if (statusResponse.ok) {
      const body = await statusResponse.json()
      initialized = Boolean(body?.data?.initialized)
    }
  } catch (error) {
    initialized = false
  }

  if (initialized) {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api')) {
    return NextResponse.json(
      { error: 'Application setup required', redirectTo: '/setup' },
      { status: 503 },
    )
  }

  if (pathname !== '/setup') {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/setup'
    redirectUrl.search = ''
    return NextResponse.redirect(redirectUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
