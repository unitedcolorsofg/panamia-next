/**
 * R2 Object Storage API
 *
 * Replaces Vercel Blob with Cloudflare R2.
 *
 * In CF Workers (prod + vinext/wrangler dev): uses the native R2Bucket binding
 * primed by worker/index.ts — no credentials needed at runtime.
 *
 * In plain Node.js dev (yarn dev): falls back to the S3-compatible API using
 * R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY from .env.local.
 *
 * R2_PUBLIC_URL must always be set — it is the base URL for the public bucket
 * (e.g. https://pub-xxx.r2.dev or a custom domain).
 */

import { getStorage } from '@/lib/r2';
import { AwsClient } from 'aws4fetch';

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');

function inferContentType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    ogg: 'audio/ogg',
    webm: 'video/webm',
  };
  return map[ext] ?? 'application/octet-stream';
}

// S3-compatible client for the plain-Node dev fallback (no R2 binding present).
function getR2Client(): AwsClient {
  return new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
    region: 'auto',
    service: 's3',
  });
}

const R2_ENDPOINT = `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

// Encode each path segment but preserve the "/" separators in the object key.
function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/');
}

function objectUrl(key: string): string {
  return `${R2_ENDPOINT}/${process.env.R2_BUCKET_NAME}/${encodeKey(key)}`;
}

/**
 * Upload a file to R2 storage.
 * @param fileName - Object key (e.g. "profile/handle/primary123.jpg")
 * @param file - File data as Buffer
 * @returns The public URL of the uploaded file, or null on failure
 */
export const uploadFile = async (
  fileName: string,
  file: Buffer
): Promise<string | null> => {
  try {
    const contentType = inferContentType(fileName);
    const bucket = getStorage();

    if (bucket) {
      // CF Workers: native binding (no credentials needed)
      await bucket.put(fileName, file, { httpMetadata: { contentType } });
    } else {
      // Node.js fallback: S3-compatible API signed with aws4fetch.
      const res = await getR2Client().fetch(objectUrl(fileName), {
        method: 'PUT',
        body: new Uint8Array(file),
        headers: { 'Content-Type': contentType },
      });
      if (!res.ok) {
        throw new Error(`R2 PUT failed: ${res.status} ${await res.text()}`);
      }
    }

    const url = `${R2_PUBLIC_URL}/${fileName}`;
    console.log(`R2:PUT:${fileName} -> ${url}`);
    return url;
  } catch (error) {
    console.error('R2 upload error:', error);
    return null;
  }
};

/**
 * Delete a file from R2 storage.
 * @param url - The full public URL of the file to delete
 * @returns true on success, false on failure
 */
export const deleteFile = async (url: string): Promise<boolean> => {
  try {
    // Skip files not owned by our R2 bucket (old BunnyCDN / Vercel Blob URLs)
    if (!R2_PUBLIC_URL || !url.startsWith(R2_PUBLIC_URL)) {
      console.log(`R2:DELETE:SKIP - Not an R2 URL: ${url}`);
      return true;
    }

    const key = url.slice(R2_PUBLIC_URL.length + 1); // strip "base/" prefix
    const bucket = getStorage();

    if (bucket) {
      await bucket.delete(key);
    } else {
      // Node.js fallback: S3-compatible API signed with aws4fetch.
      const res = await getR2Client().fetch(objectUrl(key), {
        method: 'DELETE',
      });
      // R2 returns 204 on delete; 404 is fine (already gone).
      if (!res.ok && res.status !== 404) {
        throw new Error(`R2 DELETE failed: ${res.status} ${await res.text()}`);
      }
    }

    console.log(`R2:DELETE:${key}`);
    return true;
  } catch (error) {
    console.error('R2 delete error:', error);
    return false;
  }
};

/**
 * Check if R2 storage is configured.
 */
export const isConfigured = (): boolean => {
  return !!R2_PUBLIC_URL;
};
