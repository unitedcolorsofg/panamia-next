/**
 * POST /api/social/media - Upload media for social posts
 *
 * Accepts multipart form data with a single file.
 * Uploads to Vercel Blob and returns attachment metadata.
 *
 * Supported types:
 *   - Images: image/jpeg, image/png, image/webp, image/gif
 *   - Audio:  audio/ogg (Opus, transcoded client-side from webm)
 *   - Video:  video/webm (VP8/VP9, transcoded client-side)
 *
 * Max file size: 10 MB
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { uploadFile } from '@/lib/blob/api';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];

const ACCEPTED_AUDIO_TYPES = ['audio/ogg'];

const ACCEPTED_VIDEO_TYPES = ['video/webm'];

const ACCEPTED_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  ...ACCEPTED_AUDIO_TYPES,
  ...ACCEPTED_VIDEO_TYPES,
];

function getMediaCategory(
  mimeType: string
): 'image' | 'audio' | 'video' | null {
  if (ACCEPTED_IMAGE_TYPES.includes(mimeType)) return 'image';
  if (ACCEPTED_AUDIO_TYPES.includes(mimeType)) return 'audio';
  if (ACCEPTED_VIDEO_TYPES.includes(mimeType)) return 'video';
  return null;
}

function getExtension(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'audio/ogg': 'ogg',
    'video/webm': 'webm',
  };
  return map[mimeType] || 'bin';
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const prisma = await getPrisma();

  // Get user's social actor
  const profile = await prisma.profile.findFirst({
    where: { userId: session.user.id },
    include: { socialActor: true },
  });

  if (!profile?.socialActor) {
    return NextResponse.json(
      { success: false, error: 'You must enable social features first' },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid form data' },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: 'No file provided' },
      { status: 400 }
    );
  }

  // Get optional peaks data for audio waveforms
  const peaksJson = formData.get('peaks');
  let peaks: number[] | undefined;
  if (typeof peaksJson === 'string') {
    try {
      const parsed = JSON.parse(peaksJson);
      if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'number')) {
        peaks = parsed;
      }
    } catch {
      // Invalid peaks data, ignore
    }
  }

  // Validate MIME type
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        success: false,
        error: `Unsupported file type: ${file.type}. Accepted: ${ACCEPTED_TYPES.join(', ')}`,
      },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        success: false,
        error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024} MB`,
      },
      { status: 400 }
    );
  }

  const category = getMediaCategory(file.type);
  if (!category) {
    return NextResponse.json(
      { success: false, error: 'Could not determine media category' },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const ext = getExtension(file.type);
    const uuid = crypto.randomUUID();
    const fileName = `social/${profile.socialActor.id}/${uuid}.${ext}`;

    const url = await uploadFile(fileName, buffer);
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Upload failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        type: category,
        mediaType: file.type,
        url,
        name: file.name,
        // Include peaks for audio files
        ...(category === 'audio' && peaks ? { peaks } : {}),
      },
    });
  } catch (error) {
    console.error('Media upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed' },
      { status: 500 }
    );
  }
}
