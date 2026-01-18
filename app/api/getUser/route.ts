/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.findFirst() by email or screenname
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

const getUserByEmail = async (email: string) => {
  await dbConnect();
  const User = await users.findOne({ email: email });
  return User;
};

const getUserByUsername = async (username: string) => {
  await dbConnect();
  const User = await users.findOne({ username: username });
  return User;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userEmail = searchParams.get('userEmail');
  const username = searchParams.get('username');

  if (userEmail) {
    try {
      const user = await getUserByEmail(userEmail.toString());
      return NextResponse.json({ success: true, data: user });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Error on '/api/getUser': " + err },
        { status: 400 }
      );
    }
  } else if (username) {
    try {
      const user = await getUserByUsername(username.toString());
      return NextResponse.json(user);
    } catch (err: any) {
      return NextResponse.json(
        { error: "Error on '/api/getUser': " + err },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Missing required query parameter' },
    { status: 400 }
  );
}
