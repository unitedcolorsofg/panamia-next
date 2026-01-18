/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.findFirst({ select: { id: true } })
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

const getUserByEmail = async (email: string) => {
  await dbConnect();
  const User = await users.findOne({ email: email });
  return User;
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userEmail = searchParams.get('userEmail');

  if (userEmail) {
    try {
      const user = await getUserByEmail(userEmail.toString());
      return NextResponse.json({ success: true, data: user._id.toString() });
    } catch (err: any) {
      return NextResponse.json(
        { error: "Error on '/api/getUserId': " + err },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Missing userEmail query parameter' },
    { status: 400 }
  );
}
