/**
 * Reciprocal Rank Fusion (KB-5): merges the vector and keyword rankings without comparing their
 * raw scores (cosine similarity and ts_rank live on different scales). Each id scores the sum of
 * 1 / (k + rank) over the lists it appears in (ranks start at 1). Pure and deterministic.
 */

export const RRF_K = 60

export interface RankedId {
  id: string
}

export interface FusedId {
  id: string
  rrfScore: number
  vectorRank: number | null
  keywordRank: number | null
}

function firstRanks(list: RankedId[]): Map<string, number> {
  const ranks = new Map<string, number>()
  list.forEach((item, index) => {
    if (!ranks.has(item.id)) ranks.set(item.id, index + 1)
  })
  return ranks
}

const orInfinity = (rank: number | null) => rank ?? Number.POSITIVE_INFINITY

export function fuseRrf(vector: RankedId[], keyword: RankedId[], k: number = RRF_K): FusedId[] {
  const vectorRanks = firstRanks(vector)
  const keywordRanks = firstRanks(keyword)
  const fused: FusedId[] = []
  for (const id of new Set([...vectorRanks.keys(), ...keywordRanks.keys()])) {
    const vectorRank = vectorRanks.get(id) ?? null
    const keywordRank = keywordRanks.get(id) ?? null
    const rrfScore = (vectorRank ? 1 / (k + vectorRank) : 0) + (keywordRank ? 1 / (k + keywordRank) : 0)
    fused.push({ id, rrfScore, vectorRank, keywordRank })
  }
  // Ties: the better single rank, then the better vector rank. Ranks are unique per list, so the
  // id comparison only guards against ever returning an unstable order.
  return fused.sort(
    (a, b) =>
      b.rrfScore - a.rrfScore ||
      Math.min(orInfinity(a.vectorRank), orInfinity(a.keywordRank)) -
        Math.min(orInfinity(b.vectorRank), orInfinity(b.keywordRank)) ||
      orInfinity(a.vectorRank) - orInfinity(b.vectorRank) ||
      a.id.localeCompare(b.id)
  )
}
