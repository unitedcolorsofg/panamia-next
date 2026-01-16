// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import user from '@/lib/model/user';
import userlist from '@/lib/model/userlist';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[] | any;
}

const getUserByEmail = async (email: string) => {
  await dbConnect();
  return await user.findOne({ email: email });
};
const getUserlistsByUserId = async (id: string) => {
  await dbConnect();
  const List = await userlist.find({ user_id: id });
  return List;
};

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'No user session available',
      });
    }
    const email = session.user?.email;
    if (!email) {
      return NextResponse.json(
        { success: false, error: 'No valid email' },
        { status: 200 }
      );
    }

    const existingUser = await getUserByEmail(email);
    const existingLists = await getUserlistsByUserId(existingUser._id);
    if (existingLists) {
      return NextResponse.json(
        { success: true, data: existingLists },
        { status: 200 }
      );
    }
    return NextResponse.json({ success: false, error: 'Could not find User' });
  } catch (error) {
    console.log(error);
    return NextResponse.json({
      success: false,
      error: `Server Error ${error}`,
    });
  }
}
