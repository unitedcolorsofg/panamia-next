import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/server/admin-auth';
import { getAdminDashboard } from '@/lib/server/admin';

export async function GET(request: NextRequest) {
  const adminUser = await checkAdminAuth();

  if (!adminUser) {
    return NextResponse.json(
      { error: 'Not Authorized:admin' },
      { status: 401 }
    );
  }

  const dashboardMetrics = await getAdminDashboard();

  if (dashboardMetrics) {
    return NextResponse.json({
      success: true,
      data: dashboardMetrics,
      pagination: {},
    });
  }

  return NextResponse.json(
    { success: true, data: [], pagination: {} },
    { status: 200 }
  );
}
