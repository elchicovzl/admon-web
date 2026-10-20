import { z } from 'zod'

export const KNOWLEDGE_TITLE_MAX_LENGTH = 200

export const knowledgeDocumentActionSchema = z.object({
  documentId: z.string({ required_error: 'El documento es requerido' }).cuid('Documento inválido'),
})

/** Text fields of the upload form (the file itself is validated from its bytes). */
export const knowledgeUploadFieldsSchema = z.object({
  title: z
    .string({ invalid_type_error: 'Título inválido' })
    .trim()
    .max(KNOWLEDGE_TITLE_MAX_LENGTH, `El título no puede superar ${KNOWLEDGE_TITLE_MAX_LENGTH} caracteres`)
    .optional(),
})

export type KnowledgeDocumentActionInput = z.input<typeof knowledgeDocumentActionSchema>
