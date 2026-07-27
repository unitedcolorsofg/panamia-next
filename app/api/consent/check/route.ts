import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasConsent } from '@/lib/consent';
import {
  getModuleMajorVersion,
  getTermsMajorVersion,
} from '@/lib/legal/policy-version';

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const document = searchParams.get('document');
  const module = searchParams.get('module') || null;

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Missing document' },
      { status: 400 }
    );
  }

  // The required version is resolved exclusively from policy.json (the source
  // of truth) — clients never supply it, so they can't check against a stale
  // version they happen to have consented to.
  let majorVersion: number | null = null;
  if (document === 'terms') {
    majorVersion = module
      ? getModuleMajorVersion(module)
      : getTermsMajorVersion();
  }

  if (majorVersion === null || Number.isNaN(majorVersion)) {
    return NextResponse.json(
      { success: false, error: 'Unknown or missing version' },
      { status: 400 }
    );
  }

  const consented = await hasConsent(
    session.user.id,
    document,
    module,
    majorVersion
  );

  return NextResponse.json({ consented });
}
