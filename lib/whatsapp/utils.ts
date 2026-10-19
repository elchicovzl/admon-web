import { Prisma } from "@prisma/client"

export type Json = Record<string, unknown>

/** Narrows an unknown value to a plain JSON object (arrays and null are not records). */
export function asRecord(value: unknown): Json | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : null
}

/** True for a Prisma unique-constraint violation (P2002), which racing writers treat as "someone else won". */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
}

/** Meta timestamps are epoch seconds as strings; anything unusable falls back to `fallback`. */
export function parseTimestamp(value: unknown, fallback: Date): Date {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0 ? new Date(seconds * 1000) : fallback
}
