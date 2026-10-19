import type { WhatsAppConfig } from "@/lib/config/runtime-config"

/**
 * Registry of the approved outbound templates (WI-10). Meta names and approval live in
 * config, so a template becomes selectable only when it is both configured with a Meta
 * name AND listed in WHATSAPP_APPROVED_TEMPLATES. The set is closed: unknown keys are
 * never resolvable, which keeps client-supplied template names out of the send path.
 * Body texts and the picker UI arrive with PR2.3.
 */
export const TEMPLATE_KEYS = ["RESUME", "PROCESS_UPDATE"] as const
export type TemplateKey = (typeof TEMPLATE_KEYS)[number]

interface TemplateDefinition {
  /** Number of positional body variables Meta expects ({{1}}, {{2}}...). */
  paramCount: number
  /** Where the Meta template name is configured. */
  configName: (templates: WhatsAppConfig["templates"]) => string | undefined
}

const DEFINITIONS: Record<TemplateKey, TemplateDefinition> = {
  // {{1}} nombre
  RESUME: { paramCount: 1, configName: (templates) => templates.resume },
  // {{1}} nombre, {{2}} numero
  PROCESS_UPDATE: { paramCount: 2, configName: (templates) => templates.processUpdate },
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
