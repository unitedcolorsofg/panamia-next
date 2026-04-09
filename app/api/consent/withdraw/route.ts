import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { consentReceipts } from '@/lib/schema';
import { and, eq, isNotNull } from 'drizzle-orm';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const { receiptId } = await request.json();
  if (!receiptId) {
    return NextResponse.json(
      { success: false, error: 'Missing receiptId' },
      { status: 400 }
    );
  }

  // Only allow withdrawing module-level consent (module IS NOT NULL).
  // Top-level terms consent (module=null) can only be withdrawn by
  // deleting the account — see Phase 5.
  await db
    .delete(consentReceipts)
    .where(
      and(
        eq(consentReceipts.id, receiptId),
        eq(consentReceipts.userId, session.user.id),
        isNotNull(consentReceipts.module)
      )
    );

  return NextResponse.json({ success: true });
}
