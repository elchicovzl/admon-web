import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole, AffiliationDocumentCategory } from '@prisma/client'

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

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    if (session.user.role !== UserRole.SUPER_ADMIN && session.user.role !== UserRole.MANAGER) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const subProcessId = formData.get('subProcessId') as string
    const category = (formData.get('category') as AffiliationDocumentCategory) || AffiliationDocumentCategory.GENERAL

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!subProcessId) {
      return NextResponse.json({ error: 'No se proporcionó subProcessId' }, { status: 400 })
    }

    // Verify sub-process exists
    const subProcess = await prisma.affiliationSubProcess.findUnique({
      where: { id: subProcessId },
      select: { id: true, affiliationId: true },
    })

    if (!subProcess) {
      return NextResponse.json({ error: 'Sub-proceso no encontrado' }, { status: 404 })
    }

    // Validate file size (10MB)
    if (file.size > 10485760) {
      return NextResponse.json({ error: 'El archivo excede el límite de 10MB' }, { status: 400 })
    }

    // Generate unique R2 key
    const timestamp = Date.now()
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const s3Key = `affiliations/${subProcess.affiliationId}/${subProcessId}/${timestamp}-${sanitizedFileName}`

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
    const document = await prisma.affiliationDocument.create({
      data: {
        fileName: file.name,
        fileUrl,
        fileType: file.type,
        fileSize: file.size,
        s3Key,
        category,
        subProcessId,
        uploadedById: session.user.id,
      },
      select: {
        id: true,
        subProcessId: true,
        fileName: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        s3Key: true,
        category: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Documento subido exitosamente',
      data: document,
    })
  } catch (error) {
    console.error('Affiliation upload error:', error)
    return NextResponse.json(
      { error: 'Error al subir archivo' },
      { status: 500 }
    )
  }
}
