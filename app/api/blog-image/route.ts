import { NextRequest, NextResponse } from 'next/server'
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

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

export async function GET(request: NextRequest) {
  try {
    const key = request.nextUrl.searchParams.get('key')

    if (!key || !key.startsWith('blog/')) {
      return new NextResponse(null, { status: 400 })
    }

    const r2Client = getR2Client()
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
    })

    const response = await r2Client.send(command)

    if (!response.Body) {
      return new NextResponse(null, { status: 404 })
    }

    const arrayBuffer = await response.Body.transformToByteArray()

    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': response.ContentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Blog image fetch error:', error)
    return new NextResponse(null, { status: 404 })
  }
}
