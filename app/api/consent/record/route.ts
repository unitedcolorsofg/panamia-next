import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { recordConsent } from '@/lib/consent';
import {
  getDocumentVersion,
  parseMajorVersion,
} from '@/lib/legal/policy-version';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { document, module } = body;

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Missing document' },
      { status: 400 }
    );
  }

  const version = getDocumentVersion(document, module || null);
  if (!version) {
    return NextResponse.json(
      { success: false, error: 'Unknown document or module' },
      { status: 400 }
    );
  }

  const majorVersion = parseMajorVersion(version);

  // Extract IP and GPC from request headers
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  const gpcDetected = request.headers.get('sec-gpc') === '1';

  await recordConsent({
    userId: session.user.id,
    document,
    module: module || null,
    version,
    majorVersion,
    ip,
    gpcDetected,
  });

  return NextResponse.json({ success: true });
}
