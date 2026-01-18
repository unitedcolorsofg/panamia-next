/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: prisma.profile.findMany({ where: { categories } })
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import users from '@/lib/model/users';

async function getUsersByCategory(category: string) {
  await dbConnect();
  const Users = await users.find({ category: category }).limit(5);
  return Users;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const category = searchParams.get('category');

  if (category) {
    console.log(category);
    try {
      const users = await getUsersByCategory(category.toString());
      return NextResponse.json(users);
    } catch (err: any) {
      return NextResponse.json(
        { error: "Error on '/api/getUsersByCategory': " + err },
        { status: 400 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Missing category parameter' },
    { status: 400 }
  );
}
