import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"
import { verifySignature } from "../signature"

const SECRET = "app-secret"
const BODY = '{"object":"whatsapp_business_account","entry":[]}'

function sign(body: string, secret = SECRET) {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`
}

describe("verifySignature", () => {
  it("accepts a valid signature over the exact raw body", () => {
    expect(verifySignature(BODY, sign(BODY), SECRET)).toBe(true)
  })

  it("accepts raw bytes as well as strings", () => {
    expect(verifySignature(Buffer.from(BODY), sign(BODY), SECRET)).toBe(true)
  })

  it("rejects a signature made with another secret", () => {
    expect(verifySignature(BODY, sign(BODY, "other"), SECRET)).toBe(false)
  })

  it("rejects a tampered body", () => {
    expect(verifySignature(`${BODY} `, sign(BODY), SECRET)).toBe(false)
  })

  it("rejects a re-serialized body (whitespace changed)", () => {
    const pretty = JSON.stringify(JSON.parse(BODY), null, 2)
    expect(verifySignature(pretty, sign(BODY), SECRET)).toBe(false)
  })

  it.each([null, undefined, ""])("rejects a missing header (%j)", (header) => {
    expect(verifySignature(BODY, header, SECRET)).toBe(false)
  })

  it("rejects a header without the sha256= prefix", () => {
    expect(verifySignature(BODY, sign(BODY).replace("sha256=", ""), SECRET)).toBe(false)
    expect(verifySignature(BODY, sign(BODY).replace("sha256=", "sha1="), SECRET)).toBe(false)
  })

  it("rejects wrong-length and non-hex digests without throwing", () => {
    expect(verifySignature(BODY, "sha256=abcd", SECRET)).toBe(false)
    expect(verifySignature(BODY, `${sign(BODY)}00`, SECRET)).toBe(false)
    expect(verifySignature(BODY, `sha256=${"z".repeat(64)}`, SECRET)).toBe(false)
  })

  it("rejects everything when the secret is empty", () => {
    expect(verifySignature(BODY, sign(BODY, ""), "")).toBe(false)
  })
})
