import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({
      success: false,
      error: 'No user session available',
    });
  }

  const body = await request.json();
  const { action, list_id, profile_id, list_name } = body;

  if (!list_id || !action || !profile_id) {
    return NextResponse.json({
      success: false,
      error: 'Missing or invalid parameters',
    });
  }

  const prisma = await getPrisma();

  try {
    let msg = 'No action';

    if (list_id === 'new') {
      // Create new list with the profile as first member
      msg = 'Creating new list';

      const newList = await prisma.userList.create({
        data: {
          ownerId: session.user.id,
          name: list_name || 'Unnamed',
          isPublic: false,
          members: {
            create: {
              userId: profile_id,
            },
          },
        },
      });

      console.log('/api/user/updateList', msg);
      return NextResponse.json(
        { success: true, msg: msg, listId: newList.id },
        { status: 200 }
      );
    } else {
      // Update existing list
      const existingList = await prisma.userList.findUnique({
        where: { id: list_id },
        include: {
          members: {
            where: { userId: profile_id },
          },
        },
      });

      if (!existingList) {
        return NextResponse.json({
          success: false,
          error: 'Could not find list',
        });
      }

      // Check ownership
      if (existingList.ownerId !== session.user.id) {
        return NextResponse.json({
          success: false,
          error: 'Unauthorized to modify this list',
        });
      }

      const isOnList = existingList.members.length > 0;

      if (action === 'add') {
        if (isOnList) {
          msg = 'Already on list';
        } else {
          await prisma.userListMember.create({
            data: {
              listId: list_id,
              userId: profile_id,
            },
          });
          msg = 'Added to list';
        }
      }

      if (action === 'remove') {
        if (isOnList) {
          await prisma.userListMember.deleteMany({
            where: {
              listId: list_id,
              userId: profile_id,
            },
          });
          msg = 'Removed from list';
        } else {
          msg = 'Already removed from list';
        }
      }

      console.log('updateList:', msg);
      return NextResponse.json({ success: true, msg: msg }, { status: 200 });
    }
  } catch (err) {
    console.error('Error updating list:', err);
    return NextResponse.json({
      success: false,
      error: 'Failed to update list',
    });
  }
}
