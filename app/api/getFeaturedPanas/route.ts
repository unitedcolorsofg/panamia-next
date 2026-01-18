/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.findMany({ where: { featured: true } })
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

async function getFeaturedPanas() {
  await dbConnect();

  const Users = await users.find({ featured: true }).limit(20);
  return Users;
}

export async function GET(request: NextRequest) {
  try {
    const users = await getFeaturedPanas();
    return NextResponse.json(users, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'max-age=180000',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Error on '/api/getUsersByCategory': " + err },
      { status: 400 }
    );
  }
}
