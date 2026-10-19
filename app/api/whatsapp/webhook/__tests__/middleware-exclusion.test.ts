import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/auth/auth", () => ({ auth: vi.fn() }))

import { config } from "@/middleware"

/** Next.js matcher entries are path-to-regexp; this one is a negative lookahead we can run as a regex. */
function matches(pathname: string): boolean {
  const [pattern] = config.matcher
  return new RegExp(`^${pattern}$`).test(pathname)
}

describe("middleware matcher", () => {
  it("does not run on the WhatsApp webhook (it authenticates only by signature)", () => {
    expect(matches("/api/whatsapp/webhook")).toBe(false)
  })

  it("still runs on dashboard pages", () => {
    expect(matches("/dashboard")).toBe(true)
    expect(matches("/dashboard/whatsapp")).toBe(true)
  })
})
