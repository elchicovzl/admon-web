/**
 * Manual evaluation of knowledge-base retrieval (PR3.4; extended for the AI responder in PR3.6).
 *
 *   pnpm eval:assistant scripts/eval-set.example.json
 *
 * Runs every question of an eval set through `retrieveKnowledge` against the database in
 * DATABASE_URL (with the configured embedding model, so it needs OPENAI_API_KEY) and prints the
 * status, the sources and their scores. It never writes anything. Exit code 1 when an expectation
 * fails, so it can gate the go-live checklist (OPS-G6).
 *
 * Eval set: a JSON array of
 *   { "question": string, "expectSources"?: string[] (document titles), "expectNoMatch"?: boolean }
 */
import { readFileSync } from "node:fs"
import { retrieveKnowledge } from "@/lib/knowledge/retrieve"

interface EvalCase {
  question: string
  expectSources?: string[]
  expectNoMatch?: boolean
}

function loadCases(path: string): EvalCase[] {
  const parsed: unknown = JSON.parse(readFileSync(path, "utf8"))
  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item?.question === "string")) {
    throw new Error("The eval set must be a JSON array of { question, expectSources?, expectNoMatch? }")
  }
  return parsed as EvalCase[]
}

async function main() {
  const path = process.argv[2]
  if (!path) {
    console.error("Usage: pnpm eval:assistant <eval-set.json>")
    process.exit(2)
  }

  let failures = 0
  for (const item of loadCases(path)) {
    const result = await retrieveKnowledge(item.question)
    const sources = result.status === "OK" ? [...new Set(result.chunks.map((chunk) => chunk.documentTitle))] : []
    const problems: string[] = []
    if (item.expectNoMatch && result.status === "OK") problems.push("expected no match")
    for (const expected of item.expectSources ?? []) {
      if (!sources.includes(expected)) problems.push(`missing source «${expected}»`)
    }
    if (problems.length > 0) failures++

    console.log(`\n${problems.length === 0 ? "PASS" : "FAIL"}  ${item.question}`)
    console.log(`  status: ${result.status}${"topSimilarity" in result ? `  top similarity: ${result.topSimilarity?.toFixed(3) ?? "—"}` : ""}`)
    if (result.status === "OK") {
      for (const chunk of result.chunks) {
        console.log(
          `  - ${chunk.documentTitle}${chunk.heading ? ` › ${chunk.heading}` : ""} #${chunk.ordinal}  sim ${chunk.similarity.toFixed(3)}  rrf ${chunk.rrfScore.toFixed(4)}`
        )
      }
    }
    for (const problem of problems) console.log(`  ! ${problem}`)
  }

  console.log(`\n${failures === 0 ? "All cases passed" : `${failures} case(s) failed`}`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Evaluation failed")
  process.exit(2)
})
