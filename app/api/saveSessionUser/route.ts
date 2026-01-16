import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { validateScreennameFull } from '@/lib/screenname';

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session) {
    return NextResponse.json(
      { error: 'No user session available' },
      { status: 401 }
    );
  }

  const body = await request.json();
  const email = session.user?.email
    ? (session.user?.email as string).toLowerCase()
    : null;

  const { name, zip_code, screenname } = body;

  if (!email) {
    return NextResponse.json(
      { error: 'Email value required' },
      { status: 200 }
    );
  }

  // Validate screenname if provided
  if (screenname) {
    const validation = await validateScreennameFull(screenname, email);
    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }
  }

  const prisma = await getPrisma();

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (!existingUser) {
    return NextResponse.json(
      { success: true, error: 'Could not find user' },
      { status: 401 }
    );
  }

  // Build update data
  const updateData: { name?: string; zipCode?: string; screenname?: string } =
    {};
  if (name) {
    updateData.name = name;
  }
  if (zip_code) {
    updateData.zipCode = zip_code;
  }
  if (screenname) {
    updateData.screenname = screenname.trim();
  }

  const updatedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: updateData,
  });

  return NextResponse.json({
    success: true,
    data: formatUserResponse(updatedUser),
  });
}

function formatUserResponse(user: any) {
  return {
    _id: user.id,
    email: user.email,
    name: user.name,
    screenname: user.screenname,
    status: {
      role: user.role,
      locked: user.lockedAt,
    },
    affiliate: user.affiliate,
    alternate_emails: user.alternateEmails,
    zip_code: user.zipCode,
    accountType: user.accountType,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export const maxDuration = 5;
