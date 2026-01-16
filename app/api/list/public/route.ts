import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';
import { unguardProfile } from '@/lib/profile';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const listId = searchParams.get('id');

  if (!listId) {
    return NextResponse.json({ success: true });
  }

  const prisma = await getPrisma();

  try {
    // Get the list with its members
    const list = await prisma.userList.findUnique({
      where: { id: listId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!list) {
      return NextResponse.json({
        success: false,
        error: 'List not found',
      });
    }

    // Get profiles for the list members
    const memberEmails = list.members
      .map((m) => m.user.email)
      .filter((email): email is string => email !== null);

    if (memberEmails.length > 0) {
      const listProfiles = await prisma.profile.findMany({
        where: {
          email: { in: memberEmails },
          active: true,
        },
      });

      const profiles = listProfiles.map((guardedProfile) => {
        return unguardProfile(guardedProfile);
      });

      return NextResponse.json({
        success: true,
        data: {
          list: {
            _id: list.id,
            name: list.name,
            desc: list.description,
            public: list.isPublic,
          },
          profiles,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        list: {
          _id: list.id,
          name: list.name,
          desc: list.description,
          public: list.isPublic,
        },
        profiles: [],
      },
    });
  } catch (err) {
    console.error('Error getting public list:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to get list' },
      { status: 500 }
    );
  }
}

export const maxDuration = 5;
