import type { WhatsAppConfig } from "@/lib/config/runtime-config"

/**
 * Registry of the approved outbound templates (WI-10). Meta names and approval live in
 * config, so a template becomes selectable only when it is both configured with a Meta
 * name AND listed in WHATSAPP_APPROVED_TEMPLATES. The set is closed: unknown keys are
 * never resolvable, which keeps client-supplied template names out of the send path.
 *
 * The body texts below are the Spanish copy submitted to Meta (WI-10). Meta sends its own
 * approved version; ours is used to preview the message in the composer and to show what was
 * sent in the thread, so keep it in step with the approved template.
 */
export const TEMPLATE_KEYS = ["RESUME", "PROCESS_UPDATE"] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

interface TemplateDefinition {
  /** Number of positional body variables Meta expects ({{1}}, {{2}}...). */
  paramCount: number
  /** Picker label (Spanish). */
  label: string
  /** Body with Meta-style positional variables {{1}}, {{2}}. */
  body: string
  /** Label of each variable, in order (also the input labels in the picker). */
  paramLabels: readonly string[]
  /** Where the Meta template name is configured. */
  configName: (templates: WhatsAppConfig["templates"]) => string | undefined
}

const DEFINITIONS: Record<TemplateKey, TemplateDefinition> = {
  RESUME: {
    paramCount: 1,
    label: "Retomar conversación",
    body: "Hola {{1}}, le escribimos de Administracion Segura respecto a su consulta. Podemos continuar?",
    paramLabels: ["Nombre"],
    configName: (templates) => templates.resume,
  },
  PROCESS_UPDATE: {
    paramCount: 2,
    label: "Novedades del trámite",
    body: "Hola {{1}}, su tramite {{2}} tiene novedades. Responda este mensaje para mas informacion.",
    paramLabels: ["Nombre", "Número de trámite"],
    configName: (templates) => templates.processUpdate,
  },
}

export function isTemplateKey(value: unknown): value is TemplateKey {
  return typeof value === "string" && (TEMPLATE_KEYS as readonly string[]).includes(value)
}

export interface ResolvedTemplate {
  key: TemplateKey
  /** Name as approved in Meta Business Manager. */
  name: string
  language: string
  paramCount: number
}

/** Returns null for unknown, unconfigured or unapproved templates. */
export function resolveTemplate(key: unknown, templates: WhatsAppConfig["templates"]): ResolvedTemplate | null {
  if (!isTemplateKey(key)) return null
  if (!templates.approved.includes(key)) return null
  const name = DEFINITIONS[key].configName(templates)
  if (!name) return null
  return { key, name, language: templates.language, paramCount: DEFINITIONS[key].paramCount }
}

/** Templates the composer may offer (WI-10): approved and configured only. */
export function listSelectableTemplates(templates: WhatsAppConfig["templates"]): ResolvedTemplate[] {
  return TEMPLATE_KEYS.map((key) => resolveTemplate(key, templates)).filter(
    (template): template is ResolvedTemplate => template !== null
  )
}

/** Fills {{n}} with the given values; a missing value leaves its placeholder visible. */
export function renderTemplateBody(key: TemplateKey, params: readonly string[]): string {
  return DEFINITIONS[key].body.replace(/\{\{(\d+)\}\}/g, (placeholder, index: string) => params[Number(index) - 1] ?? placeholder)
}

/** Serializable description of a selectable template for the composer picker. */
export interface TemplateOption {
  key: TemplateKey
  label: string
  body: string
  paramLabels: string[]
}

export function listTemplateOptions(templates: WhatsAppConfig["templates"]): TemplateOption[] {
  return listSelectableTemplates(templates).map(({ key }) => ({
    key,
    label: DEFINITIONS[key].label,
    body: DEFINITIONS[key].body,
    paramLabels: [...DEFINITIONS[key].paramLabels],
  }))
}

/** Meta rejects variables with line breaks, tabs or long runs of spaces; keep them short too. */
export const TEMPLATE_PARAM_MAX_LENGTH = 100

export type TemplateParamsResult = { ok: true; params: string[] } | { ok: false; error: string }

/** Checks the variables of a template before it is queued; returns them trimmed. */
export function validateTemplateParams(key: TemplateKey, params: readonly string[]): TemplateParamsResult {
  const definition = DEFINITIONS[key]
  if (params.length !== definition.paramCount) {
    return { ok: false, error: `La plantilla requiere ${definition.paramCount} dato(s)` }
  }
  const cleaned: string[] = []
  for (const [index, raw] of params.entries()) {
    const value = raw.trim()
    const label = definition.paramLabels[index]
    if (!value) return { ok: false, error: `${label} es requerido` }
    if (value.length > TEMPLATE_PARAM_MAX_LENGTH) {
      return { ok: false, error: `${label} no puede superar ${TEMPLATE_PARAM_MAX_LENGTH} caracteres` }
    }
    if (/[\n\r\t]| {4,}/.test(value)) {
      return { ok: false, error: `${label} no puede tener saltos de línea, tabulaciones ni espacios repetidos` }
    }
    cleaned.push(value)
  }
  return { ok: true, params: cleaned }
}
