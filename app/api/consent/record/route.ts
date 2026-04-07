import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { recordConsent } from '@/lib/consent';

// Read policy.json at build time to get current versions
// TODO: When policy versions are updated more frequently, consider reading
// these dynamically or from a shared config module.
import termsPolicy from '@/app/legal/terms/policy.json';
import privacyPolicy from '@/app/legal/privacy/policy.json';

function getVersion(document: string, module: string | null): string | null {
  if (document === 'terms') {
    if (!module) return termsPolicy.version;
    const mod = termsPolicy.modules.find(
      (m: { name: string }) => m.name === module
    );
    return mod?.version ?? null;
  }
  if (document === 'privacy') {
    return privacyPolicy.version;
  }
  return null;
}

function parseMajorVersion(version: string): number {
  const major = parseInt(version.split('.')[0], 10);
  return isNaN(major) ? 0 : major;
}

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

  const version = getVersion(document, module || null);
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
