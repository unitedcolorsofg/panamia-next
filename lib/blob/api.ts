/**
 * Vercel Blob Storage API
 *
 * Provides file upload and delete functionality using Vercel Blob
 * Replaces BunnyCDN with native Vercel storage
 */

import { put, del } from '@vercel/blob';

/**
 * Upload a file to Vercel Blob storage
 * @param fileName - The path/name for the file (e.g., "profile/handle/primary123.jpg")
 * @param file - The file data as Buffer
 * @returns The public URL of the uploaded file, or null on failure
 */
export const uploadFile = async (
  fileName: string,
  file: Buffer
): Promise<string | null> => {
  try {
    const blob = await put(fileName, file, {
      access: 'public',
      addRandomSuffix: false, // Keep our naming scheme
    });

    console.log(`Blob:PUT:${fileName} -> ${blob.url}`);
    return blob.url;
  } catch (error) {
    console.error('Blob upload error:', error);
    return null;
  }
};

/**
 * Delete a file from Vercel Blob storage
 * @param url - The full Vercel Blob URL of the file to delete
 * @returns true on success, false on failure
 */
export const deleteFile = async (url: string): Promise<boolean> => {
  try {
    // Only attempt delete if it's a Vercel Blob URL
    if (
      !url.includes('.vercel-storage.com') &&
      !url.includes('.public.blob.vercel-storage.com')
    ) {
      console.log(`Blob:DELETE:SKIP - Not a Vercel Blob URL: ${url}`);
      return true; // Don't fail on old BunnyCDN URLs
    }

    await del(url);
    console.log(`Blob:DELETE:${url}`);
    return true;
  } catch (error) {
    console.error('Blob delete error:', error);
    return false;
  }
};

/**
 * Check if Blob storage is configured
 * @returns true if BLOB_READ_WRITE_TOKEN is set
 */
export const isConfigured = (): boolean => {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
};
