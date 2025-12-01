'use server'

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, DocumentCategory } from '@prisma/client'
import {
  uploadDocumentSchema,
  deleteDocumentSchema,
} from '@/lib/validations/client.schema'
import type { ActionResponse } from '@/lib/types/auth.types'
import type { ClientDocument } from '@/lib/types/client.types'
import { revalidatePath } from 'next/cache'

/**
 * Check if user has SUPER_ADMIN or MANAGER role
 */
async function requireManagerOrAdmin() {
  const session = await auth()

  if (!session?.user) {
    return { authorized: false, error: 'No autenticado' }
  }

  if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
    return { authorized: false, error: 'No tienes permisos para esta acción' }
  }

  return { authorized: true, userId: session.user.id }
}

/**
 * Initialize S3 Client for Cloudflare R2
 */
function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID
  const accessKeyId = process.env.R2_ACCESS_KEY_ID
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error('Cloudflare R2 credentials not configured')
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/**
 * Get category folder name
 */
function getCategoryFolder(category: DocumentCategory): string {
  const folders = {
    [DocumentCategory.GENERAL]: 'general',
    [DocumentCategory.ARL]: 'procesos/arl',
    [DocumentCategory.EPS]: 'procesos/eps',
    [DocumentCategory.AFP]: 'procesos/afp',
    [DocumentCategory.OTROS]: 'procesos/otros',
  }
  return folders[category]
}

/**
 * Generate a presigned URL for uploading a file to Cloudflare R2
 */
export async function generateUploadUrl(
  clientId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  category: DocumentCategory = DocumentCategory.GENERAL
): Promise<ActionResponse<{ uploadUrl: string; s3Key: string }>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = uploadDocumentSchema.safeParse({
      clientId,
      fileName,
      fileType,
      fileSize,
      category,
    })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Check R2 credentials
    if (!process.env.R2_BUCKET_NAME) {
      return {
        success: false,
        error: 'Configuración de R2 no disponible',
      }
    }

    // Generate unique R2 key with category folder structure
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const categoryFolder = getCategoryFolder(category)
    const s3Key = `clients/${clientId}/${categoryFolder}/${timestamp}-${sanitizedFileName}`

    // Create R2 client and generate presigned URL
    const r2Client = getR2Client()
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: s3Key,
      ContentType: fileType,
    })

    const uploadUrl = await getSignedUrl(r2Client, command, {
      expiresIn: 300, // 5 minutes
    })

    return {
      success: true,
      data: {
        uploadUrl,
        s3Key,
      },
    }
  } catch (error) {
    console.error('Generate upload URL error:', error)
    return {
      success: false,
      error: 'Error al generar URL de subida',
    }
  }
}

/**
 * Confirm upload and save document metadata to database
 */
export async function confirmUpload(
  clientId: string,
  fileName: string,
  fileType: string,
  fileSize: number,
  s3Key: string,
  category: DocumentCategory = DocumentCategory.GENERAL
): Promise<ActionResponse<ClientDocument>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = uploadDocumentSchema.safeParse({
      clientId,
      fileName,
      fileType,
      fileSize,
      category,
    })

    if (!validatedFields.success) {
      return {
        success: false,
        error: 'Datos inválidos',
      }
    }

    // Check if client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return { success: false, error: 'Cliente no encontrado' }
    }

    // Generate file URL for R2
    const publicUrl = process.env.R2_PUBLIC_URL
    const bucket = process.env.R2_BUCKET_NAME
    const accountId = process.env.R2_ACCOUNT_ID

    // Use public URL if configured, otherwise use R2 endpoint
    const fileUrl = publicUrl
      ? `${publicUrl}/${s3Key}`
      : `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${s3Key}`

    // Save document metadata to database
    const document = await prisma.clientDocument.create({
      data: {
        fileName,
        fileUrl,
        fileType,
        fileSize,
        s3Key,
        category,
        clientId,
        uploadedById: authCheck.userId!,
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        s3Key: true,
        category: true,
        clientId: true,
        uploadedById: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    revalidatePath(`/dashboard/clients/${clientId}`)

    return {
      success: true,
      message: 'Documento subido exitosamente',
      data: document,
    }
  } catch (error) {
    console.error('Confirm upload error:', error)
    return {
      success: false,
      error: 'Error al confirmar subida de documento',
    }
  }
}

/**
 * Delete a document from R2 and database
 */
export async function deleteDocument(documentId: string): Promise<ActionResponse> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    // Validate input
    const validatedFields = deleteDocumentSchema.safeParse({ documentId })
    if (!validatedFields.success) {
      return { success: false, error: 'Datos inválidos' }
    }

    // Get document from database
    const document = await prisma.clientDocument.findUnique({
      where: { id: documentId },
    })

    if (!document) {
      return { success: false, error: 'Documento no encontrado' }
    }

    // Delete from R2
    try {
      const r2Client = getR2Client()
      const command = new DeleteObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME!,
        Key: document.s3Key,
      })
      await r2Client.send(command)
    } catch (r2Error) {
      console.error('R2 deletion error:', r2Error)
      // Continue with database deletion even if R2 deletion fails
    }

    // Delete from database
    await prisma.clientDocument.delete({
      where: { id: documentId },
    })

    revalidatePath(`/dashboard/clients/${document.clientId}`)

    return {
      success: true,
      message: 'Documento eliminado exitosamente',
    }
  } catch (error) {
    console.error('Delete document error:', error)
    return {
      success: false,
      error: 'Error al eliminar documento',
    }
  }
}

/**
 * Get documents for a client
 */
export async function getClientDocuments(
  clientId: string,
  category?: DocumentCategory
): Promise<ActionResponse<ClientDocument[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const documents = await prisma.clientDocument.findMany({
      where: {
        clientId,
        ...(category && { category }),
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        s3Key: true,
        category: true,
        clientId: true,
        uploadedById: true,
        createdAt: true,
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    return {
      success: true,
      data: documents,
    }
  } catch (error) {
    console.error('Get client documents error:', error)
    return {
      success: false,
      error: 'Error al obtener documentos',
    }
  }
}
