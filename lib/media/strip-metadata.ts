/**
 * Image Metadata Stripping
 *
 * Removes EXIF, XMP and IPTC metadata from images before they are stored.
 *
 * WHY: a photo taken on a phone carries the coordinates where it was taken.
 * A member posting a picture from home publishes their home address to anyone
 * who downloads the file and reads its headers, which is not a thing they
 * agreed to or would expect. EXIF also carries the capture timestamp, the
 * device make, model and serial, lens data, and often an embedded thumbnail
 * that survives edits made to the visible image -- a cropped-out face can
 * still be in the thumbnail.
 *
 * WHY HERE, AND WHY BY HAND: this has to run both in Cloudflare Workers
 * (uploads through the app) and in the browser (article covers, which are PUT
 * straight to R2 on a presigned URL and never reach us). `sharp` is a native
 * libvips binding and runs in neither. A WASM codec would run in both but has
 * to decode and re-encode, which costs bundle size, time, and a generation of
 * image quality on every upload.
 *
 * Metadata in all three formats lives in container structures wrapped around
 * the compressed pixel data, so it can be removed by editing the container and
 * leaving the pixels untouched. That is what this does: the output is the same
 * image, byte-for-byte, minus the parts that describe where you were.
 *
 * Orientation is the exception worth keeping. It lives in EXIF but is not
 * personal -- it tells the renderer which way up the photo is, and dropping it
 * turns portrait photos sideways. It is read before the EXIF block is discarded
 * and written back as a minimal replacement carrying nothing else.
 *
 * Unparseable input is rejected rather than passed through. If the bytes do not
 * match the format the caller declared, we cannot promise the metadata is gone,
 * and a file claiming to be a JPEG that is not one is not something to store
 * anyway.
 */

/** Thrown when bytes do not parse as the image format that was declared. */
export class MetadataStripError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetadataStripError';
  }
}

/**
 * Strip metadata from an image.
 *
 * Content types other than JPEG, PNG and WebP are returned untouched -- audio
 * and video pass through here on their way to storage, and GIF carries no
 * camera metadata (see the note on GIF at the bottom of this file).
 *
 * @throws MetadataStripError if the bytes are not the declared format
 */
export function stripImageMetadata(
  bytes: Uint8Array,
  contentType: string
): Uint8Array {
  switch (contentType) {
    case 'image/jpeg':
      return stripJpeg(bytes);
    case 'image/png':
      return stripPng(bytes);
    case 'image/webp':
      return stripWebp(bytes);
    default:
      return bytes;
  }
}

/**
 * Strip metadata from a `File` or `Blob`, for upload paths that run in the
 * browser.
 *
 * Article cover images are PUT straight to R2 on a presigned URL, so their
 * bytes never pass through the server and cannot be cleaned there. Stripping
 * before the PUT is the only opportunity.
 *
 * @throws MetadataStripError if the bytes are not the declared format
 */
export async function stripImageBlob(
  file: Blob,
  contentType: string = file.type
): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const cleaned = stripImageMetadata(bytes, contentType);
  return new Blob([cleaned as unknown as BlobPart], { type: contentType });
}

// ---------------------------------------------------------------- utilities

function concat(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** Read `length` bytes at `offset` as ASCII. Used for container tags only. */
function ascii(b: Uint8Array, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) s += String.fromCharCode(b[offset + i]);
  return s;
}

function startsWith(b: Uint8Array, prefix: string): boolean {
  if (b.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (b[i] !== prefix.charCodeAt(i)) return false;
  }
  return true;
}

// -------------------------------------------------------------------- JPEG

/*
 * A JPEG is SOI, then a run of marker segments, then the compressed scan.
 * Every segment is 0xFF, a marker byte, a two-byte length covering itself,
 * and a payload. Metadata lives in the APPn segments and in COM; the segments
 * describing how to decode the image (quantisation tables, Huffman tables,
 * frame and scan headers) are left alone.
 */

const SOI = 0xd8;
const EOI = 0xd9;
const SOS = 0xda;
const COM = 0xfe;
const TEM = 0x01;
const APP0 = 0xe0;
const APP15 = 0xef;

/**
 * Should this segment survive?
 *
 * Only APPn and COM are ever dropped. APPn is a numbered slot rather than a
 * defined meaning -- applications claim one and identify themselves with a
 * prefix string inside the payload -- so the prefix decides, not the number.
 * Three are worth keeping:
 *
 *   APP0/JFIF   pixel aspect ratio; predates EXIF and carries nothing personal
 *   APP2/ICC    the colour profile, which an artist's photo needs to render
 *               with the colours they chose
 *   APP14/Adobe the colour transform, without which CMYK and YCCK JPEGs decode
 *               with inverted or swapped channels
 *
 * Everything else in that range is metadata: EXIF and XMP in APP1, Photoshop
 * resource blocks and IPTC in APP13, assorted vendor blocks elsewhere. APP2
 * additionally hosts Multi-Picture Format, which embeds a second complete
 * image (with its own EXIF) inside the first -- so APP2 is kept only when it
 * actually is a colour profile.
 */
function keepJpegSegment(marker: number, payload: Uint8Array): boolean {
  if (marker === COM) return false;
  if (marker < APP0 || marker > APP15) return true;

  if (marker === 0xe0) {
    return startsWith(payload, 'JFIF\0') || startsWith(payload, 'JFXX\0');
  }
  if (marker === 0xe2) return startsWith(payload, 'ICC_PROFILE\0');
  if (marker === 0xee) return startsWith(payload, 'Adobe');
  return false;
}

/**
 * Find the end of the image, so trailing data can be discarded.
 *
 * Phones append their own containers after EOI -- Samsung writes a trailer
 * holding depth maps and capture settings, and Multi-Picture JPEGs store a
 * second full image there. Both are metadata by another route.
 *
 * 0xFF bytes inside compressed scan data are escaped as 0xFF00, and the only
 * other markers permitted mid-scan are the restart markers 0xFFD0-0xFFD7, so
 * an unescaped 0xFFD9 is unambiguously the real end of the image.
 */
function findEndOfImage(b: Uint8Array, from: number): number {
  for (let i = from; i + 1 < b.length; i++) {
    if (b[i] === 0xff && b[i + 1] === EOI) return i + 2;
  }
  return b.length;
}

function stripJpeg(b: Uint8Array): Uint8Array {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== SOI) {
    throw new MetadataStripError('not a JPEG: missing start-of-image marker');
  }

  const kept: Uint8Array[] = [];
  let orientation = 1;
  let i = 2;

  while (i + 1 < b.length) {
    if (b[i] !== 0xff) {
      throw new MetadataStripError(`expected a marker at byte ${i}`);
    }

    const marker = b[i + 1];

    // Any number of 0xFF bytes may pad the gap before a marker.
    if (marker === 0xff) {
      i++;
      continue;
    }

    // Markers that stand alone, with no length and no payload.
    if (marker === TEM || (marker >= 0xd0 && marker <= 0xd7)) {
      kept.push(b.subarray(i, i + 2));
      i += 2;
      continue;
    }

    if (marker === EOI) {
      kept.push(b.subarray(i, i + 2));
      break;
    }

    if (i + 3 >= b.length) {
      throw new MetadataStripError('truncated segment header');
    }

    const length = (b[i + 2] << 8) | b[i + 3];
    if (length < 2 || i + 2 + length > b.length) {
      throw new MetadataStripError(`bad segment length at byte ${i}`);
    }

    const segment = b.subarray(i, i + 2 + length);
    const payload = b.subarray(i + 4, i + 2 + length);

    // The scan header is the last segment; compressed data runs from the end
    // of it to the end of the image, and holds no metadata.
    if (marker === SOS) {
      kept.push(segment);
      const scanStart = i + 2 + length;
      kept.push(b.subarray(scanStart, findEndOfImage(b, scanStart)));
      break;
    }

    if (marker === 0xe1 && startsWith(payload, 'Exif\0\0')) {
      orientation = readExifOrientation(payload) ?? 1;
    }

    if (keepJpegSegment(marker, payload)) kept.push(segment);

    i += 2 + length;
  }

  // 1 is "already the right way up", which is also what a decoder assumes
  // when no orientation is recorded, so it does not need to be written back.
  const head: Uint8Array[] = [b.subarray(0, 2)];
  if (orientation !== 1) head.push(buildOrientationExif(orientation));

  return concat([...head, ...kept]);
}

/**
 * Read the orientation tag out of an EXIF payload.
 *
 * EXIF is a TIFF file in a wrapper: a byte-order mark, the number 42 as a
 * sanity check on that mark, and an offset to the first image file directory.
 * Each directory entry is a tag id, a type, a count, and either a value or an
 * offset to one. Orientation (0x0112) is a single SHORT, so it is stored
 * inline. Only the first directory is searched -- that is where writers put
 * it, and the rest of the structure is about to be discarded regardless.
 */
function readExifOrientation(payload: Uint8Array): number | null {
  const tiff = payload.subarray(6); // past "Exif\0\0"
  if (tiff.length < 8) return null;

  const little = tiff[0] === 0x49 && tiff[1] === 0x49;
  const big = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!little && !big) return null;

  const u16 = (o: number) =>
    little ? tiff[o] | (tiff[o + 1] << 8) : (tiff[o] << 8) | tiff[o + 1];
  const u32 = (o: number) =>
    little
      ? (tiff[o] |
          (tiff[o + 1] << 8) |
          (tiff[o + 2] << 16) |
          (tiff[o + 3] << 24)) >>>
        0
      : ((tiff[o] << 24) |
          (tiff[o + 1] << 16) |
          (tiff[o + 2] << 8) |
          tiff[o + 3]) >>>
        0;

  if (u16(2) !== 42) return null;

  const ifd0 = u32(4);
  if (ifd0 + 2 > tiff.length) return null;

  const entries = u16(ifd0);
  for (let e = 0; e < entries; e++) {
    const at = ifd0 + 2 + e * 12;
    if (at + 12 > tiff.length) return null;
    if (u16(at) === 0x0112) {
      const value = u16(at + 8);
      return value >= 1 && value <= 8 ? value : null;
    }
  }
  return null;
}

/**
 * Build an EXIF segment containing an orientation and nothing else.
 *
 * Rebuilt from scratch rather than edited out of the original, so that nothing
 * from the camera's block -- GPS, serial numbers, the embedded thumbnail --
 * can be carried along by accident. Big-endian, because the layout is fixed
 * and written out by hand below.
 */
function buildOrientationExif(orientation: number): Uint8Array {
  // prettier-ignore
  const payload = new Uint8Array([
    // "Exif\0\0"
    0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    // TIFF header: big-endian, 42, first directory at offset 8
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08,
    // one directory entry
    0x00, 0x01,
    // tag 0x0112 (orientation), type 3 (SHORT), count 1, value
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01,
    (orientation >> 8) & 0xff, orientation & 0xff, 0x00, 0x00,
    // no directory follows
    0x00, 0x00, 0x00, 0x00,
  ]);

  const length = payload.length + 2; // the length field counts itself
  return concat([
    new Uint8Array([0xff, 0xe1, (length >> 8) & 0xff, length & 0xff]),
    payload,
  ]);
}

// --------------------------------------------------------------------- PNG

/*
 * A PNG is a signature followed by typed chunks, each carrying its own length
 * and CRC. Dropping a whole chunk leaves every other chunk's CRC valid, so
 * nothing needs recomputing.
 */

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/*
 * eXIf is EXIF, exactly as in a JPEG, and is what a phone writes when it saves
 * a PNG. tEXt/zTXt/iTXt are free-text pairs -- editors record the software
 * used, the author, and sometimes a full XMP packet in them. tIME is the last
 * modification time.
 *
 * Everything absent from this list is kept, which is the safe direction to be
 * wrong in: an unrecognised chunk stays, so a colour profile or transparency
 * table cannot be dropped by omission.
 */
const PNG_METADATA_CHUNKS = new Set(['eXIf', 'tEXt', 'zTXt', 'iTXt', 'tIME']);

function stripPng(b: Uint8Array): Uint8Array {
  if (b.length < 8) throw new MetadataStripError('not a PNG: too short');
  for (let i = 0; i < 8; i++) {
    if (b[i] !== PNG_SIGNATURE[i]) {
      throw new MetadataStripError('not a PNG: bad signature');
    }
  }

  const kept: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;

  while (i + 8 <= b.length) {
    const length =
      ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const total = 12 + length; // length + type + data + CRC

    if (i + total > b.length) {
      throw new MetadataStripError(`truncated ${type} chunk`);
    }

    if (!PNG_METADATA_CHUNKS.has(type)) kept.push(b.subarray(i, i + total));

    i += total;
    if (type === 'IEND') break;
  }

  return concat(kept);
}

// -------------------------------------------------------------------- WebP

/*
 * WebP is a RIFF container: a header, then chunks of a four-character tag, a
 * little-endian size, and a payload padded to an even length.
 *
 * A plain WebP holds only the compressed frame and has nowhere to put
 * metadata. The extended form starts with a VP8X chunk whose first byte
 * flags which optional chunks are present, so removing EXIF or XMP means
 * clearing the matching flag as well -- a decoder that trusts the flag and
 * then cannot find the chunk may treat the file as damaged.
 */

const WEBP_EXIF_FLAG = 0x08;
const WEBP_XMP_FLAG = 0x04;

function stripWebp(b: Uint8Array): Uint8Array {
  if (b.length < 12 || ascii(b, 0, 4) !== 'RIFF' || ascii(b, 8, 4) !== 'WEBP') {
    throw new MetadataStripError('not a WebP: bad RIFF header');
  }

  const kept: Uint8Array[] = [];
  let i = 12;

  while (i + 8 <= b.length) {
    const tag = ascii(b, i, 4);
    const size =
      (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const padded = size + (size % 2);

    if (i + 8 + size > b.length) {
      throw new MetadataStripError(`truncated ${tag} chunk`);
    }

    // The pad byte on the final chunk is sometimes absent in the wild.
    const end = Math.min(i + 8 + padded, b.length);

    if (tag !== 'EXIF' && tag !== 'XMP ') {
      if (tag === 'VP8X') {
        const chunk = b.slice(i, end);
        chunk[8] &= ~(WEBP_EXIF_FLAG | WEBP_XMP_FLAG);
        kept.push(chunk);
      } else {
        kept.push(b.subarray(i, end));
      }
    }

    i += 8 + padded;
  }

  const body = concat(kept);
  const out = new Uint8Array(12 + body.length);
  out.set([0x52, 0x49, 0x46, 0x46]); // "RIFF"

  // The RIFF size counts everything after the size field itself.
  const riffSize = 4 + body.length;
  out[4] = riffSize & 0xff;
  out[5] = (riffSize >> 8) & 0xff;
  out[6] = (riffSize >> 16) & 0xff;
  out[7] = (riffSize >> 24) & 0xff;

  out.set([0x57, 0x45, 0x42, 0x50], 8); // "WEBP"
  out.set(body, 12);
  return out;
}

/*
 * GIF is passed through deliberately. Its only metadata holders are comment
 * and application extension blocks, which no camera writes -- a GIF reaching
 * this platform has been through an encoder that had no location to record.
 * Parsing the format to remove blocks that are not there would add a failure
 * mode without removing a risk.
 */
