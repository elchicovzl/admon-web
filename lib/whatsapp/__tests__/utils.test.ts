import { Prisma } from "@prisma/client"
import { describe, expect, it } from "vitest"
import { asRecord, isUniqueViolation, parseTimestamp } from "../utils"

describe("asRecord", () => {
  it("accepts plain objects only", () => {
    expect(asRecord({ a: 1 })).toEqual({ a: 1 })
    expect(asRecord([1])).toBeNull()
    expect(asRecord(null)).toBeNull()
    expect(asRecord("x")).toBeNull()
  })
})

describe("isUniqueViolation", () => {
  it("is true only for Prisma P2002", () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" })
    const other = new Prisma.PrismaClientKnownRequestError("missing", { code: "P2025", clientVersion: "test" })
    expect(isUniqueViolation(p2002)).toBe(true)
    expect(isUniqueViolation(other)).toBe(false)
    expect(isUniqueViolation(new Error("P2002"))).toBe(false)
  })
})

describe("parseTimestamp", () => {
  const fallback = new Date("2026-10-19T12:00:00Z")

  it("reads epoch seconds", () => {
    expect(parseTimestamp("1760000000", fallback)).toEqual(new Date(1760000000 * 1000))
  })

  it("falls back for missing, zero, negative or non-numeric values", () => {
    for (const value of [undefined, null, "", "abc", 0, -5]) {
      expect(parseTimestamp(value, fallback)).toBe(fallback)
    }
  })
})
