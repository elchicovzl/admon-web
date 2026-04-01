import { z } from 'zod'
import { BlogPostStatus } from '@prisma/client'

// Slug regex: lowercase letters, numbers, hyphens
const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const createBlogPostSchema = z.object({
  title: z
    .string()
    .min(1, 'El título es requerido')
    .max(200, 'El título no puede exceder 200 caracteres'),
  slug: z
    .string()
    .min(1, 'El slug es requerido')
    .max(200, 'El slug no puede exceder 200 caracteres')
    .regex(slugRegex, 'El slug solo puede contener letras minúsculas, números y guiones'),
  excerpt: z
    .string()
    .max(500, 'El extracto no puede exceder 500 caracteres')
    .optional()
    .or(z.literal('')),
  content: z
    .string()
    .min(1, 'El contenido es requerido'),
  status: z.nativeEnum(BlogPostStatus, {
    required_error: 'El estado es requerido',
  }),
  categoryId: z.string().optional().or(z.literal('')),
  tagIds: z.array(z.string()).optional(),
  featuredImageUrl: z.string().optional().or(z.literal('')),
  featuredImageS3Key: z.string().optional().or(z.literal('')),
  // SEO fields
  metaTitle: z
    .string()
    .max(70, 'El meta título no puede exceder 70 caracteres')
    .optional()
    .or(z.literal('')),
  metaDescription: z
    .string()
    .max(160, 'La meta descripción no puede exceder 160 caracteres')
    .optional()
    .or(z.literal('')),
  keywords: z
    .string()
    .max(500, 'Las palabras clave no pueden exceder 500 caracteres')
    .optional()
    .or(z.literal('')),
  ogImageUrl: z.string().optional().or(z.literal('')),
  ogImageS3Key: z.string().optional().or(z.literal('')),
})

export const updateBlogPostSchema = createBlogPostSchema.extend({
  id: z.string().min(1, 'El ID es requerido'),
})

export const createBlogCategorySchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  slug: z
    .string()
    .min(1, 'El slug es requerido')
    .max(100, 'El slug no puede exceder 100 caracteres')
    .regex(slugRegex, 'El slug solo puede contener letras minúsculas, números y guiones'),
  description: z
    .string()
    .max(500, 'La descripción no puede exceder 500 caracteres')
    .optional()
    .or(z.literal('')),
})

export const createBlogTagSchema = z.object({
  name: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre no puede exceder 50 caracteres'),
})

export type CreateBlogPostInput = z.infer<typeof createBlogPostSchema>
export type UpdateBlogPostInput = z.infer<typeof updateBlogPostSchema>
export type CreateBlogCategoryInput = z.infer<typeof createBlogCategorySchema>
export type CreateBlogTagInput = z.infer<typeof createBlogTagSchema>
