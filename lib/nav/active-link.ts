/**
 * Which sidebar link matches the current URL.
 *
 * Lives outside the sidebar component because it's pure decision logic with
 * non-obvious rules, and it has already been wrong twice:
 *
 *   1. Exact `pathname === href` matching meant DETAIL pages highlighted
 *      nothing — /finances/bills/2070 didn't match /finances/bills.
 *   2. Adding `?type=` to distinguish "Cobros" from "Pagos" meant the plain
 *      /finances/payments URL matched NEITHER, so the whole Finanzas tree
 *      sat collapsed with no selection.
 *
 * Both were invisible to the type checker and only showed up on screen,
 * which is exactly the kind of logic worth pulling out and unit testing.
 */

export interface NavLinkLike {
  /** May include a query string, e.g. "/x/payments?type=out". */
  href: string
  /**
   * Query param that distinguishes this entry from a sibling pointing at the
   * SAME path. Needed because `usePathname()` drops the query string.
   */
  matchParam?: { key: string; value: string }
  /** Wins when the path matches but `matchParam.key` is absent from the URL. */
  matchFallback?: boolean
}

export interface NavNodeLike<T extends NavLinkLike = NavLinkLike> {
  href?: string
  matchParam?: { key: string; value: string }
  matchFallback?: boolean
  subItems?: T[]
}

/** Minimal read interface — satisfied by URLSearchParams. */
export interface ReadonlyParams {
  get(key: string): string | null
}

/**
 * How well does this link describe the current URL? Higher wins; -1 = no match.
 *
 * Scored rather than boolean because several links can legitimately match at
 * once and only the MOST SPECIFIC should highlight:
 *
 *   /finances/invoices/2070  matches "Resumen" (/finances) AND
 *                            "Facturas de venta" (/finances/invoices)
 *
 * Ranking by path length picks the second, which is what a user expects.
 */
export function scoreLink(
  item: NavLinkLike,
  pathname: string,
  searchParams: ReadonlyParams,
): number {
  const [linkPath] = item.href.split('?')

  // Exact page, or a child of it (a detail page under its list).
  const pathMatches = pathname === linkPath || pathname.startsWith(`${linkPath}/`)
  if (!pathMatches) return -1

  // Longer path = deeper in the tree = more specific.
  let score = linkPath.length

  if (item.matchParam) {
    const actual = searchParams.get(item.matchParam.key)

    if (actual === item.matchParam.value) {
      // Exact query match beats any sibling sharing the path.
      score += 1000
    } else if (!item.matchFallback) {
      // Not our value and we're not the fallback: defer to the sibling.
      return -1
    }
    // The fallback stays a candidate at base score no matter what the param
    // says. Deliberately covers BOTH "param absent" and "param present but
    // matching no sibling" (a hand-edited ?type=garbage): bailing out on the
    // second let an ancestor win by prefix, so /finances/payments highlighted
    // "Resumen". Ranking handles the rest — a sibling with an exact match
    // outscores this by 1000.
  }

  return score
}

/**
 * href of the single link that should be highlighted, or null.
 *
 * Resolved across the whole menu at once: a node can't know whether a deeper
 * link elsewhere is a better match, so the winner has to be picked globally.
 */
export function findActiveHref<T extends NavLinkLike>(
  items: Array<NavNodeLike<T> & Partial<NavLinkLike>>,
  pathname: string,
  searchParams: ReadonlyParams,
): string | null {
  let bestHref: string | null = null
  let bestScore = -1

  const visit = (nodes: Array<NavNodeLike<T> & Partial<NavLinkLike>>) => {
    for (const node of nodes) {
      if (node.subItems) {
        visit(node.subItems as Array<NavNodeLike<T> & Partial<NavLinkLike>>)
        continue
      }
      if (!node.href) continue

      const score = scoreLink(node as NavLinkLike, pathname, searchParams)
      if (score > bestScore) {
        bestScore = score
        bestHref = node.href
      }
    }
  }

  visit(items)
  return bestHref
}

/**
 * Does this sub-tree contain the active link?
 *
 * Recursive because a nested group ("Egresos") must report its children's
 * state upward — otherwise landing on /finances/bills leaves both "Finanzas"
 * and "Egresos" collapsed and the user can't see where they are.
 */
export function containsActiveHref<T extends NavLinkLike>(
  items: Array<NavNodeLike<T> & Partial<NavLinkLike>>,
  activeHref: string | null,
): boolean {
  if (!activeHref) return false

  return items.some((item) =>
    item.subItems
      ? containsActiveHref(
          item.subItems as Array<NavNodeLike<T> & Partial<NavLinkLike>>,
          activeHref,
        )
      : item.href === activeHref,
  )
}
