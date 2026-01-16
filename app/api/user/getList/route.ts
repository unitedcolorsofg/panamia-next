import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({
        success: false,
        error: 'No user session available',
      });
    }

    const prisma = await getPrisma();

    // Get all lists owned by the current user
    const lists = await prisma.userList.findMany({
      where: { ownerId: session.user.id },
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transform to legacy format for backward compatibility
    const legacyLists = lists.map((list) => ({
      _id: list.id,
      user_id: list.ownerId,
      name: list.name,
      desc: list.description,
      public: list.isPublic,
      profiles: list.members.map((m) => m.userId),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }));

    return NextResponse.json(
      { success: true, data: legacyLists },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error getting user lists:', error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}
