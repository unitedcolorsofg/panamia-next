// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { getPrisma } from '@/lib/prisma';
import { deleteFile, uploadFile } from '@/lib/blob/api';

interface ResponseData {
  error?: string;
  success?: boolean;
  msg?: string;
  data?: any[];
}

const cacheRand = () => {
  return Math.floor((Math.random() + 1) * 10000)
    .toString()
    .substring(1, 4);
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

  const prisma = await getPrisma();
  const existingProfile = await prisma.profile.findUnique({
    where: { email },
    include: { user: { select: { screenname: true } } },
  });

  if (!existingProfile) {
    return NextResponse.json(
      { success: false, error: 'Could not find profile' },
      { status: 401 }
    );
  }

  // Use screenname for storage path, fall back to profile id
  const handle = existingProfile.user?.screenname || existingProfile.id;

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

    // Track updates for primary image and gallery images
    let primaryImageUpdate: {
      primaryImageId?: string;
      primaryImageCdn?: string;
    } = {};
    let galleryImagesUpdate: Record<string, string> = {
      ...((existingProfile.galleryImages as object) || {}),
    };

    // Process all uploaded files
    for (const file of uploadedFiles) {
      const filePath = await uploadFile(file.filename, file.data);
      if (!filePath) {
        continue;
      }
      console.log('filePath', filePath);

      if (file.fieldname === 'primary') {
        // Delete old primary image
        if (
          existingProfile.primaryImageCdn &&
          existingProfile.primaryImageCdn !== filePath
        ) {
          await deleteFile(existingProfile.primaryImageCdn);
        }
        primaryImageUpdate = {
          primaryImageId: file.filename,
          primaryImageCdn: filePath,
        };
      } else {
        // Delete old gallery image
        const existingGallery = existingProfile.galleryImages as Record<
          string,
          string
        > | null;
        const existingImageUrl = existingGallery?.[file.fieldname + 'CDN'];
        if (existingImageUrl && existingImageUrl !== filePath) {
          await deleteFile(existingImageUrl);
        }
        galleryImagesUpdate[file.fieldname] = file.filename;
        galleryImagesUpdate[file.fieldname + 'CDN'] = filePath;
      }
    }

    // Update profile with new images
    const updatedProfile = await prisma.profile.update({
      where: { id: existingProfile.id },
      data: {
        ...primaryImageUpdate,
        galleryImages:
          Object.keys(galleryImagesUpdate).length > 0
            ? (galleryImagesUpdate as any)
            : undefined,
      },
    });

    console.log('save');

    return NextResponse.json(
      { success: true, data: updatedProfile },
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
