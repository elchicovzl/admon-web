import { describe, it, expect } from "vitest"
import { readdirSync, readFileSync, existsSync } from "node:fs"
import { join } from "node:path"

/**
 * Migration guard (XC-4): every public table must have Row Level Security enabled.
 * Prisma connects as a superuser and bypasses RLS, so enabling it with no policies
 * only locks out PostgREST (anon/authenticated). See 20260224000000_enable_rls_all_tables.
 *
 * Migrations from ENFORCED_FROM on must enable RLS in the SAME migration that creates
 * the table. Tables created earlier are covered by the baseline migration, except the
 * legacy ones listed in LEGACY_WITHOUT_RLS, which predate this guard and never got RLS
 * (follow-up: a dedicated migration enabling it; kept out of the WhatsApp slice on purpose).
 */
const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations")
const RLS_BASELINE = "20260224000000_enable_rls_all_tables"
const ENFORCED_FROM = "20261019"
const LEGACY_WITHOUT_RLS = [
  "20260504000000_sync_baseline: affiliation_subprocess_beneficiaries",
  "20260504000000_sync_baseline: administradoras",
  "20260504000000_sync_baseline: sent_emails",
  "20260504000000_sync_baseline: blog_categories",
  "20260504000000_sync_baseline: blog_tags",
  "20260504000000_sync_baseline: blog_posts",
  "20260504000000_sync_baseline: _BlogPostToBlogTag",
  "20260627034003: novedades",
  "20260701162932_add_employment_join_table: employments",
  "20261004000000_add_recibos_pago: recibos_pago",
  "20261004000000_add_recibos_pago: consecutivos",
  "20261006000000_add_configuracion_empresa: configuracion_empresa",
]

const CREATE_TABLE = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:"?public"?\.)?"?([A-Za-z0-9_]+)"?/gi
const ENABLE_RLS = /ALTER\s+TABLE\s+(?:ONLY\s+)?(?:"?public"?\.)?"?([A-Za-z0-9_]+)"?\s+ENABLE\s+ROW\s+LEVEL\s+SECURITY/gi

function stripSqlComments(sql: string): string {
  return sql.replace(/--[^\n]*/g, "")
}

function names(sql: string, pattern: RegExp): Set<string> {
  return new Set([...sql.matchAll(new RegExp(pattern.source, pattern.flags))].map((m) => m[1]))
}

/** Returns the tables a migration creates without enabling RLS in the same file. */
export function tablesMissingRls(sql: string): string[] {
  const clean = stripSqlComments(sql)
  const enabled = names(clean, ENABLE_RLS)
  return [...names(clean, CREATE_TABLE)].filter((table) => !enabled.has(table))
}

describe("tablesMissingRls", () => {
  it("flags a created table without RLS", () => {
    expect(tablesMissingRls('CREATE TABLE "things" ("id" TEXT NOT NULL);')).toEqual(["things"])
  })

  it("accepts a table whose RLS is enabled in the same migration", () => {
    const sql = `
      CREATE TABLE "things" ("id" TEXT NOT NULL);
      ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;`
    expect(tablesMissingRls(sql)).toEqual([])
  })

  it("ignores statements inside SQL comments", () => {
    const sql = `
      CREATE TABLE "things" ("id" TEXT NOT NULL);
      -- ALTER TABLE public.things ENABLE ROW LEVEL SECURITY;`
    expect(tablesMissingRls(sql)).toEqual(["things"])
  })

  it("handles schema-qualified and IF NOT EXISTS forms", () => {
    const sql = `
      CREATE TABLE IF NOT EXISTS public.otp ("id" TEXT);
      ALTER TABLE "public"."otp" ENABLE ROW LEVEL SECURITY;`
    expect(tablesMissingRls(sql)).toEqual([])
  })
})

describe("prisma migrations", () => {
  const dirs = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  it("includes the RLS baseline migration", () => {
    expect(dirs).toContain(RLS_BASELINE)
  })

  it("enables Row Level Security for every table created after the baseline", () => {
    const offenders: string[] = []
    for (const dir of dirs.filter((name) => name > RLS_BASELINE)) {
      const file = join(MIGRATIONS_DIR, dir, "migration.sql")
      if (!existsSync(file)) continue
      for (const table of tablesMissingRls(readFileSync(file, "utf8"))) {
        offenders.push(`${dir}: ${table}`)
      }
    }
    const unexpected = offenders.filter(
      (entry) => entry.split(":")[0] >= ENFORCED_FROM || !LEGACY_WITHOUT_RLS.includes(entry)
    )
    expect(unexpected).toEqual([])
  })

  it("does not keep stale entries in the legacy allowlist", () => {
    const current = new Set<string>()
    for (const dir of dirs) {
      const file = join(MIGRATIONS_DIR, dir, "migration.sql")
      if (!existsSync(file)) continue
      for (const table of tablesMissingRls(readFileSync(file, "utf8"))) current.add(`${dir}: ${table}`)
    }
    expect(LEGACY_WITHOUT_RLS.filter((entry) => !current.has(entry))).toEqual([])
  })

  it("covers the WhatsApp channel tables", () => {
    const dir = dirs.find((name) => name.endsWith("_whatsapp_channel_schema"))
    expect(dir).toBeDefined()
    const sql = readFileSync(join(MIGRATIONS_DIR, dir as string, "migration.sql"), "utf8")
    expect([...names(stripSqlComments(sql), ENABLE_RLS)]).toHaveLength(10)
    expect(tablesMissingRls(sql)).toEqual([])
  })
})
