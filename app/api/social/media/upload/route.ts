/**
 * POST /api/social/media/upload
 *
 * Issues a short-lived Vercel Blob client token so the browser can upload
 * audio/video directly to Blob storage — bypassing the serverless function
 * payload limit (413) that would otherwise apply.
 *
 * Images continue to use the existing /api/social/media route (they are
 * small enough to flow through a function with no issue).
 */

import { NextRequest, NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { auth } from '@/auth';

const ALLOWED_TYPES = ['audio/ogg', 'video/webm'];

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: 200 * 1024 * 1024, // 200 MB
          tokenPayload: session.user.id,
        };
      },
      onUploadCompleted: async () => {
        // Attachment is registered when the post is submitted — nothing to do here.
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
