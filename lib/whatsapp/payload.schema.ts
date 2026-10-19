import { z } from "zod"

/**
 * Lenient shape of Meta's webhook envelope. Only the fields the splitter needs are
 * typed; everything else passes through untouched so a new Meta field never makes
 * a valid delivery fail validation. Anything that does not fit becomes an OTHER item.
 */
const looseRecord = z.object({}).passthrough()

const messageSchema = z.object({ id: z.string().min(1) }).passthrough()
const statusSchema = z
  .object({ id: z.string().min(1), status: z.string().min(1) })
  .passthrough()
const echoSchema = z.object({ id: z.string().min(1) }).passthrough()

export const changeValueSchema = z
  .object({
    metadata: looseRecord.optional(),
    contacts: z.array(looseRecord).optional(),
    messages: z.array(z.unknown()).optional(),
    statuses: z.array(z.unknown()).optional(),
    message_echoes: z.array(z.unknown()).optional(),
  })
  .passthrough()

export const webhookEnvelopeSchema = z
  .object({
    entry: z
      .array(
        z
          .object({
            changes: z
              .array(
                z
                  .object({
                    field: z.string().optional(),
                    value: z.unknown(),
                  })
                  .passthrough()
              )
              .optional(),
          })
          .passthrough()
      )
      .optional(),
  })
  .passthrough()

export type WebhookMessage = z.infer<typeof messageSchema>
export type WebhookStatus = z.infer<typeof statusSchema>
export type WebhookEcho = z.infer<typeof echoSchema>
export { messageSchema, statusSchema, echoSchema }
