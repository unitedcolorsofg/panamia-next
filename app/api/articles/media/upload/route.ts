/**
 * POST /api/articles/media/upload
 *
 * Issues a presigned R2 PUT URL so the browser can upload an article's cover
 * photo or video directly to R2 (bypassing the Worker request body size limit).
 * Images and video both use this path — video is transcoded to WebM client-side
 * first, images upload as-is.
 *
 * Gate: mirrors POST /api/articles — the caller must be signed in and have a
 * screenname (the article-authoring prerequisite). This is the articles-module
 * analog of the social media upload's socialActor gate.
 *
 * Note: requires the R2 CORS policy to allow PUT from the app's origin (already
 * configured for the social media uploads).
 */

import { NextRequest, NextResponse } from 'next/server';
import { AwsClient } from 'aws4fetch';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { eq } from 'drizzle-orm';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/webm',
];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB
const PRESIGN_TTL = 300; // seconds

// Keys are constrained to this prefix so a caller can't presign a PUT to an
// arbitrary object in the bucket.
const KEY_PATTERN = /^articles\/media\/[A-Za-z0-9._-]+$/;

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

function getR2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    region: 'auto', // R2 requires "auto"; the S3-compatible API is the "s3" service
    service: 's3',
  });
}

// Encode each path segment but preserve the "/" separators in the object key.
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Articles gate: a screenname is required to author articles (see
  // POST /api/articles), so it's required to upload article media too.
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
    columns: { screenname: true },
  });
  if (!user?.screenname) {
    return NextResponse.json(
      { error: 'Set a screenname before uploading article media' },
      { status: 403 }
    );
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
  if (!KEY_PATTERN.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
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
    const client = getR2Client();
    const endpoint = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
    const url = new URL(
      `${endpoint}/${process.env.R2_BUCKET_NAME}/${encodeKey(filename)}`
    );
    // Presigned query-auth URL. Only the URL/host is signed — the browser sets
    // Content-Type on the PUT (unsigned headers are allowed on presigned URLs),
    // and Content-Length is intentionally left out of the signature so the
    // browser's fetch-set length can't cause a SignatureDoesNotMatch.
    url.searchParams.set('X-Amz-Expires', String(PRESIGN_TTL));

    const signed = await client.sign(url.toString(), {
      method: 'PUT',
      aws: { signQuery: true },
    });

    return NextResponse.json({
      presignedUrl: signed.url,
      publicUrl: `${R2_PUBLIC_URL}/${filename}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
