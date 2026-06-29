/**
 * Layout for the /dashboard/finances/* route segment.
 *
 * Centralizes the route-segment config so we don't have to repeat
 * `export const dynamic = 'force-dynamic'` in every page.tsx.
 * Next.js propagates this to all child pages (home, list, detail).
 *
 * Why force-dynamic: every page under this segment calls
 * getAlegraClient(), which validates env vars in its constructor.
 * Without force-dynamic, next build tries to evaluate the pages
 * during prerender and crashes on the missing env vars.
 *
 * Pure pass-through — no DOM, no styling. Does NOT add any wrapper
 * (the root /dashboard/layout.tsx already wraps this with sidebar + header).
 */
export const dynamic = 'force-dynamic'

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
