/**
 * @deprecated This route uses legacy MongoDB. See docs/DEPRECATED-ROUTES.md
 * Replace with: Vercel Blobs for storage + prisma.profile.update()
 */
import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/connectdb';
import images from '@/lib/model/images';
import users from '@/lib/model/users';

interface ResponseData {
  error?: string;
  msg?: string;
}

const validateForm = async (id: string, uploadImages: string) => {
  if (uploadImages) {
    //console.log('images'+uploadImages);
  }
  //const User = await users.findById({_id: id});
  //if(!User){
  //return "error user not found";
  //}
  await dbConnect();

  return null;
};

export async function PUT(request: NextRequest) {
  const body = await request.json();
  console.log(body.userId);
  // validate if it is a POST

  // get and validate body variables
  const { userId, item } = body;

  const errorMessage = await validateForm(userId, item);
  if (errorMessage) {
    return NextResponse.json(errorMessage as ResponseData, { status: 400 });
  }

  let statuss = '';

  const newImage = new images({
    image: item,
    userId: userId,
  });

  await newImage
    .save()
    .then(() => {
      return NextResponse.json(
        { msg: 'Successfuly added image' },
        { status: 200 }
      );
    })
    .catch((err: string) => {
      return NextResponse.json(
        { error: "Error on '/api/uploadImage': " + err },
        { status: 400 }
      );
    });
}
