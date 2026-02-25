import type { FFmpeg } from '@ffmpeg/ffmpeg';

let ffmpegInstance: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  const { FFmpeg: FFmpegClass } = await import('@ffmpeg/ffmpeg');
  const ffmpeg = new FFmpegClass();
  await ffmpeg.load({
    coreURL:
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.js',
    wasmURL:
      'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd/ffmpeg-core.wasm',
  });
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/**
 * Transcode any audio blob to audio/ogg (Opus).
 * Input is typically audio/webm from MediaRecorder.
 */
export async function transcodeToOpus(blob: Blob): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  const { fetchFile } = await import('@ffmpeg/util');
  const inputData = await fetchFile(blob);
  await ffmpeg.writeFile('input.webm', inputData);
  await ffmpeg.exec([
    '-i',
    'input.webm',
    '-c:a',
    'libopus',
    '-b:a',
    '64k',
    'output.ogg',
  ]);
  const data = (await ffmpeg.readFile('output.ogg')) as Uint8Array;
  await ffmpeg.deleteFile('input.webm');
  await ffmpeg.deleteFile('output.ogg');
  return new Blob([data.buffer as ArrayBuffer], { type: 'audio/ogg' });
}

/**
 * Transcode any video blob to video/webm (VP8 + Opus).
 * VP8 is faster than VP9 in single-threaded WASM.
 * @param onProgress optional callback receiving a 0–1 completion ratio
 */
export async function transcodeToWebMVideo(
  blob: Blob,
  onProgress?: (ratio: number) => void
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.min(progress, 1));
    });
  }

  // Determine a reasonable input extension from the MIME type
  const ext = blob.type.split('/')[1]?.split(';')[0] || 'mp4';
  const inputName = `input.${ext}`;

  const { fetchFile } = await import('@ffmpeg/util');
  const inputData = await fetchFile(blob);
  await ffmpeg.writeFile(inputName, inputData);
  await ffmpeg.exec([
    '-i',
    inputName,
    '-vf',
    'scale=-2:min(720\\,ih)', // cap at 720p, no upscaling, preserve aspect ratio
    '-c:v',
    'libvpx',
    '-c:a',
    'libopus',
    '-b:v',
    '0',
    '-crf',
    '26', // CRF 26: YouTube-720p quality, ~3-6 MB/min, fits under 40 MB Mastodon limit
    'output.webm',
  ]);
  const data = (await ffmpeg.readFile('output.webm')) as Uint8Array;
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile('output.webm');

  if (onProgress) {
    ffmpeg.off('progress', () => {});
  }

  return new Blob([data.buffer as ArrayBuffer], { type: 'video/webm' });
}
