'use server'

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'
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
 * Initialize S3 Client
 */
function getS3Client() {
  const region = process.env.AWS_REGION
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY

  if (!region || !accessKeyId || !secretAccessKey) {
    throw new Error('AWS credentials not configured')
  }

  return new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  })
}

/**
 * Generate a presigned URL for uploading a file to S3
 */
export async function generateUploadUrl(
  clientId: string,
  fileName: string,
  fileType: string,
  fileSize: number
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

    // Check AWS credentials
    if (!process.env.AWS_S3_BUCKET) {
      return {
        success: false,
        error: 'Configuración de S3 no disponible',
      }
    }

    // Generate unique S3 key
    const timestamp = Date.now()
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `clients/${clientId}/${timestamp}-${sanitizedFileName}`

    // Create S3 client and generate presigned URL
    const s3Client = getS3Client()
    const command = new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: s3Key,
      ContentType: fileType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, {
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
  s3Key: string
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

    // Generate file URL
    const region = process.env.AWS_REGION
    const bucket = process.env.AWS_S3_BUCKET
    const fileUrl = `https://${bucket}.s3.${region}.amazonaws.com/${s3Key}`

    // Save document metadata to database
    const document = await prisma.clientDocument.create({
      data: {
        fileName,
        fileUrl,
        fileType,
        fileSize,
        s3Key,
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
 * Delete a document from S3 and database
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

    // Delete from S3
    try {
      const s3Client = getS3Client()
      const command = new DeleteObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: document.s3Key,
      })
      await s3Client.send(command)
    } catch (s3Error) {
      console.error('S3 deletion error:', s3Error)
      // Continue with database deletion even if S3 deletion fails
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
  clientId: string
): Promise<ActionResponse<ClientDocument[]>> {
  try {
    const authCheck = await requireManagerOrAdmin()
    if (!authCheck.authorized) {
      return { success: false, error: authCheck.error }
    }

    const documents = await prisma.clientDocument.findMany({
      where: { clientId },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        s3Key: true,
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
