import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { hasConsent } from '@/lib/consent';

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
  const majorVersion = searchParams.get('majorVersion');

  if (!document || majorVersion === null) {
    return NextResponse.json(
      { success: false, error: 'Missing document or majorVersion' },
      { status: 400 }
    );
  }

  const consented = await hasConsent(
    session.user.id,
    document,
    module,
    parseInt(majorVersion, 10)
  );

  return NextResponse.json({ consented });
}
