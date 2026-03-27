/**
 * POST /api/social/media/upload
 *
 * Issues a presigned R2 PUT URL so the browser can upload audio/video directly
 * to R2 — bypassing the Worker request body size limit for large files.
 *
 * Images continue to use /api/social/media (small enough to flow through the Worker).
 *
 * Note: requires R2 CORS policy to allow PUT from the app's origin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { auth } from '@/auth';

const ALLOWED_TYPES = ['audio/ogg', 'video/webm'];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const PRESIGN_TTL = 300; // seconds

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

function getS3Client(): S3Client {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as {
    filename?: string;
    contentType?: string;
    size?: number;
  };

  const { filename, contentType, size } = body;

  if (!filename || !contentType || typeof size !== 'number') {
    return NextResponse.json(
      { error: 'filename, contentType, and size are required' },
      { status: 400 }
    );
  }

  if (!ALLOWED_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `Unsupported type: ${contentType}` },
      { status: 400 }
    );
  }

  if (size > MAX_SIZE) {
    return NextResponse.json(
      { error: 'File too large (max 200 MB)' },
      { status: 400 }
    );
  }

  try {
    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: filename,
      ContentType: contentType,
      ContentLength: size,
    });

    const presignedUrl = await getSignedUrl(s3, command, {
      expiresIn: PRESIGN_TTL,
    });

    return NextResponse.json({
      presignedUrl,
      publicUrl: `${R2_PUBLIC_URL}/${filename}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
