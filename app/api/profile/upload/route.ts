// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import dbConnect from '@/lib/connectdb';
import profile from '@/lib/model/profile';
import { deleteFile, uploadFile } from '@/lib/blob/api';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[];
}

const getProfileByEmail = async (email: string) => {
  await dbConnect();
  const Profile = await profile.findOne({ email: email });
  return Profile;
};

const cacheRand = () => {
  return Math.floor((Math.random() + 1) * 10000)
    .toString()
    .substring(1, 4);
};

const processFile = async (
  existingProfile: any,
  file: { data: Buffer; filename: string; fieldname: string; ext: string }
) => {
  const filePath = await uploadFile(file.filename, file.data);
  if (!filePath) {
    return false;
  }
  console.log('filePath', filePath);

  // Delete old image using the CDN URL (Vercel Blob needs full URL)
  const existingImageUrl = existingProfile?.images?.[file.fieldname + 'CDN'];
  if (existingImageUrl && existingImageUrl !== filePath) {
    await deleteFile(existingImageUrl);
  }

  existingProfile.images = {
    ...existingProfile.images,
    ...{ [file.fieldname]: file.filename },
    ...{ [file.fieldname + 'CDN']: filePath },
  };
};

export async function POST(request: NextRequest) {
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
  const existingProfile = await getProfileByEmail(email);

  if (!existingProfile) {
    return NextResponse.json(
      { success: false, error: 'Could not find profile' },
      { status: 401 }
    );
  }

  const handle = existingProfile.slug;

  try {
    // Use Web API formData() instead of busboy
    const formData = await request.formData();
    const uploadedFiles: any = [];

    const acceptedFields = ['primary', 'gallery1', 'gallery2', 'gallery3'];

    // Process each form entry
    for (const [fieldname, value] of formData.entries()) {
      if (value instanceof File && acceptedFields.includes(fieldname)) {
        console.log('onFile', fieldname, value.name, value.type, value.size);

        // Convert File to Buffer
        const arrayBuffer = await value.arrayBuffer();
        const data = Buffer.from(arrayBuffer);

        // Determine file extension from MIME type
        const ext =
          value.type === 'image/jpeg'
            ? 'jpg'
            : value.type === 'image/png'
              ? 'png'
              : value.type === 'image/webp'
                ? 'webp'
                : '';

        if (ext) {
          console.log('mimeType', value.type);
          const fileName = `profile/${handle}/${fieldname}${cacheRand()}.${ext}`;
          console.log('fileName', fileName);
          uploadedFiles.push({
            data: data,
            filename: fileName,
            fieldname: fieldname,
            ext: ext,
          });
        }
      }
    }

    // Process all uploaded files
    const promises = uploadedFiles.map((file: any) =>
      processFile(existingProfile, file)
    );

    await Promise.all(promises);
    await existingProfile.save();
    console.log('save');

    return NextResponse.json(
      { success: true, data: existingProfile },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { success: false, error: 'Upload failed: ' + error.message },
      { status: 500 }
    );
  }
}
