import { describe, expect, it } from "vitest"
import {
  isTemplateKey,
  listSelectableTemplates,
  listTemplateOptions,
  renderTemplateBody,
  resolveTemplate,
  suggestedFirstName,
  validateTemplateParams,
} from "../templates"

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

describe("template copy and variables (S-WI-8)", () => {
  it("substitutes {{1}} and {{2}} with the given values", () => {
    expect(renderTemplateBody("RESUME", ["Ana"])).toBe(
      "Hola Ana, le escribimos de Administracion Segura respecto a su consulta. Podemos continuar?"
    )
    expect(renderTemplateBody("PROCESS_UPDATE", ["Ana", "A-123"])).toBe(
      "Hola Ana, su tramite A-123 tiene novedades. Responda este mensaje para mas informacion."
    )
  })

  it("leaves a placeholder visible when a value is missing", () => {
    expect(renderTemplateBody("PROCESS_UPDATE", ["Ana"])).toContain("{{2}}")
  })

  it("describes selectable templates for the picker and nothing else", () => {
    const options = listTemplateOptions(templates({ approved: ["PROCESS_UPDATE"] }))
    expect(options).toEqual([
      {
        key: "PROCESS_UPDATE",
        label: "Novedades del trámite",
        body: expect.stringContaining("{{2}}"),
        paramLabels: ["Nombre", "Número de trámite"],
      },
    ])
    expect(listTemplateOptions(templates({ approved: [] }))).toEqual([])
  })

  it("accepts and trims valid variables", () => {
    expect(validateTemplateParams("PROCESS_UPDATE", ["  Ana ", "A-123"])).toEqual({ ok: true, params: ["Ana", "A-123"] })
  })

  it("rejects a wrong number of variables", () => {
    expect(validateTemplateParams("RESUME", [])).toEqual({ ok: false, error: "La plantilla requiere 1 dato(s)" })
    expect(validateTemplateParams("RESUME", ["Ana", "extra"]).ok).toBe(false)
  })

  it("rejects empty, over-long and Meta-invalid variables", () => {
    expect(validateTemplateParams("RESUME", ["   "])).toEqual({ ok: false, error: "Nombre es requerido" })
    expect(validateTemplateParams("RESUME", ["a".repeat(101)]).ok).toBe(false)
    expect(validateTemplateParams("RESUME", ["Ana\nPérez"]).ok).toBe(false)
    expect(validateTemplateParams("RESUME", ["Ana\tPérez"]).ok).toBe(false)
    expect(validateTemplateParams("RESUME", ["Ana     Pérez"]).ok).toBe(false)
  })
})

describe("suggestedFirstName", () => {
  it("takes the first word of a name", () => {
    expect(suggestedFirstName("Ana María Pérez")).toBe("Ana")
    expect(suggestedFirstName("  Édgar  ")).toBe("Édgar")
  })

  it("is empty when only a phone or nothing is known", () => {
    expect(suggestedFirstName("+573001112233")).toBe("")
    expect(suggestedFirstName("")).toBe("")
    expect(suggestedFirstName(null)).toBe("")
  })
})
