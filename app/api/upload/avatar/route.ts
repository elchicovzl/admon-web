import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'
import { UserRole } from '@prisma/client'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 2 * 1024 * 1024 // 2MB

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

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Tipo de archivo no permitido. Solo se aceptan JPG, PNG y WebP' },
        { status: 400 }
      )
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: 'El archivo excede el límite de 2MB' },
        { status: 400 }
      )
    }

    // Allow SUPER_ADMIN to upload avatar for another user
    const targetUserId = formData.get('userId') as string | null
    let userId = session.user.id

    if (targetUserId && targetUserId !== session.user.id) {
      if (session.user.role !== UserRole.SUPER_ADMIN) {
        return NextResponse.json({ error: 'No autorizado para modificar otro usuario' }, { status: 403 })
      }
      userId = targetUserId
    }
    const timestamp = Date.now()
    const ext = file.name.split('.').pop() || 'jpg'
    const s3Key = `avatars/${userId}/${timestamp}-avatar.${ext}`

    const r2Client = getR2Client()
    const fileBuffer = Buffer.from(await file.arrayBuffer())

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: file.type,
    })

    await r2Client.send(command)

    // Store the s3Key in the database so the proxy route can fetch it
    await prisma.user.update({
      where: { id: userId },
      data: { image: s3Key },
    })

    // Return the proxy URL for the frontend
    const imageUrl = `/api/avatar/${userId}`

    return NextResponse.json({
      success: true,
      message: 'Avatar actualizado exitosamente',
      data: { imageUrl },
    })
  } catch (error) {
    console.error('Avatar upload error:', error)
    return NextResponse.json(
      { error: 'Error al subir avatar' },
      { status: 500 }
    )
  }
}
