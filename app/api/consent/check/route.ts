import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasConsent } from '@/lib/consent';
import { getModuleMajorVersion } from '@/lib/legal/policy-version';

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
  const majorVersionParam = searchParams.get('majorVersion');

  if (!document) {
    return NextResponse.json(
      { success: false, error: 'Missing document' },
      { status: 400 }
    );
  }

  // The version comes from policy.json (source of truth). The client may still
  // pass an explicit majorVersion for back-compat, but it's optional — when
  // omitted we derive it from the module (or the top-level terms) version.
  let majorVersion: number | null;
  if (majorVersionParam !== null) {
    majorVersion = parseInt(majorVersionParam, 10);
  } else if (document === 'terms' && module) {
    majorVersion = getModuleMajorVersion(module);
  } else {
    // Top-level terms/privacy (no module) — not derivable here.
    majorVersion = null;
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
