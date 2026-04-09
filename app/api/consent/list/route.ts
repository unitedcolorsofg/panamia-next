import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { consentReceipts } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const receipts = await db.query.consentReceipts.findMany({
    where: eq(consentReceipts.userId, session.user.id),
    columns: {
      id: true,
      document: true,
      module: true,
      version: true,
      majorVersion: true,
      gpcDetected: true,
      createdAt: true,
      // IP intentionally excluded from client response
    },
  });

  return NextResponse.json({ receipts });
}
