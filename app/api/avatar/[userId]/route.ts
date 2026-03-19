import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { auth } from '@/lib/auth/auth'
import prisma from '@/lib/db/prisma'

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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { userId } = await params

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { image: true },
    })

    if (!user?.image) {
      return new NextResponse(null, { status: 404 })
    }

    // The image field stores the s3Key directly
    const s3Key = user.image

    const r2Client = getR2Client()
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: s3Key,
    })

    const response = await r2Client.send(command)

    if (!response.Body) {
      return new NextResponse(null, { status: 404 })
    }

    const arrayBuffer = await response.Body.transformToByteArray()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.ContentType || 'image/webp',
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    })
  } catch (error) {
    console.error('Avatar fetch error:', error)
    return new NextResponse(null, { status: 404 })
  }
}
