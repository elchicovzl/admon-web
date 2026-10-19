import { describe, expect, it } from "vitest"
import { isTemplateKey, listSelectableTemplates, resolveTemplate } from "../templates"

const templates = (overrides: Partial<Parameters<typeof resolveTemplate>[1]> = {}) => ({
  resume: "resume_conversation",
  processUpdate: "process_update",
  language: "es",
  approved: ["RESUME", "PROCESS_UPDATE"],
  ...overrides,
})

describe("template registry (WI-10)", () => {
  it("resolves approved and configured templates with their Meta name and language", () => {
    expect(resolveTemplate("RESUME", templates())).toEqual({
      key: "RESUME",
      name: "resume_conversation",
      language: "es",
      paramCount: 1,
    })
    expect(resolveTemplate("PROCESS_UPDATE", templates())?.paramCount).toBe(2)
  })

  it("does not resolve an unapproved template", () => {
    expect(resolveTemplate("PROCESS_UPDATE", templates({ approved: ["RESUME"] }))).toBeNull()
  })

  it("does not resolve an approved template that has no Meta name configured", () => {
    expect(resolveTemplate("RESUME", templates({ resume: undefined }))).toBeNull()
  })

  it("never resolves keys outside the closed set", () => {
    expect(isTemplateKey("RESUME")).toBe(true)
    for (const key of ["resume", "OTHER", "", null, undefined, 1]) {
      expect(isTemplateKey(key)).toBe(false)
      expect(resolveTemplate(key, templates({ approved: ["OTHER", "resume"] }))).toBeNull()
    }
  })

  it("only lists selectable templates; nothing is selectable by default", () => {
    expect(listSelectableTemplates(templates({ approved: ["PROCESS_UPDATE"] })).map((t) => t.key)).toEqual([
      "PROCESS_UPDATE",
    ])
    expect(listSelectableTemplates(templates({ approved: [] }))).toEqual([])
  })
})
