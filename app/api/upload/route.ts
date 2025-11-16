import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, DocumentCategory } from '@prisma/client'

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

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const clientId = formData.get('clientId') as string
    const category = (formData.get('category') as DocumentCategory) || DocumentCategory.GENERAL

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!clientId) {
      return NextResponse.json({ error: 'No se proporcionó clientId' }, { status: 400 })
    }

    // Verify client exists
    const client = await prisma.client.findUnique({ where: { id: clientId } })
    if (!client) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 })
    }

    // Validate file size (10MB)
    if (file.size > 10485760) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 })
    }

    // Generate unique R2 key with category folder structure
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const categoryFolder = getCategoryFolder(category)
    const s3Key = `clients/${clientId}/${categoryFolder}/${timestamp}-${sanitizedFileName}`

    // Upload to R2
    const r2Client = getR2Client()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type,
    })

    await r2Client.send(command)

    // Generate file URL
    const publicUrl = process.env.R2_PUBLIC_URL
    const bucket = process.env.R2_BUCKET_NAME
    const accountId = process.env.R2_ACCOUNT_ID

    const fileUrl = publicUrl
      ? `${publicUrl}/${s3Key}`
      : `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${s3Key}`

    // Save document metadata to database
    const document = await prisma.clientDocument.create({
      data: {
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
        s3Key,
        category,
        clientId,
        uploadedById: session.user.id,
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

    return NextResponse.json({
      success: true,
      message: 'Documento subido exitosamente',
      data: document,
    })
  } catch (error) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: 'Error al subir archivo' },
      { status: 500 }
    )
  }
}
