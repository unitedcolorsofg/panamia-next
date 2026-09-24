/**
 * Tests for image metadata stripping.
 *
 * The fixtures are assembled byte by byte rather than committed as binary
 * files. A checked-in photo is opaque -- you cannot tell by reading the test
 * what it is supposed to contain, and nobody can tell whether a change to it
 * weakened the test. Building them here means each one states exactly which
 * metadata it carries, and the "before" side of every assertion is visible.
 *
 * The EXIF blocks are real: a TIFF header, a directory with typed entries,
 * and a GPS sub-directory, laid out at computed offsets the way a camera
 * writes them. The PNG chunks carry real CRCs. If the stripper were handed
 * something malformed it would reject it and these tests would pass for the
 * wrong reason, so the fixtures have to be genuinely valid.
 *
 * Secrets are marked with sentinel strings. Asserting a sentinel is absent
 * searches the whole file, so metadata that was relocated rather than removed
 * would still fail.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MetadataStripError,
  stripImageMetadata,
} from '@/lib/media/strip-metadata';

// ------------------------------------------------------------- byte helpers

const u16be = (n: number) => [(n >> 8) & 0xff, n & 0xff];
const u16le = (n: number) => [n & 0xff, (n >> 8) & 0xff];
const u32be = (n: number) => [
  (n >>> 24) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 8) & 0xff,
  n & 0xff,
];
const u32le = (n: number) => [
  n & 0xff,
  (n >>> 8) & 0xff,
  (n >>> 16) & 0xff,
  (n >>> 24) & 0xff,
];

const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));

const bytes = (...parts: number[][]) => new Uint8Array(parts.flat());

/** Does `haystack` contain this literal ASCII string anywhere? */
function containsText(haystack: Uint8Array, needle: string): boolean {
  return Buffer.from(haystack).includes(Buffer.from(needle, 'ascii'));
}

/** Index of a byte sequence, or -1. */
function indexOfBytes(haystack: Uint8Array, needle: number[]): number {
  return Buffer.from(haystack).indexOf(Buffer.from(needle));
}

// -------------------------------------------------------------- JPEG fixture

/**
 * An EXIF block holding an orientation, a camera make, and a GPS
 * sub-directory -- the three things a phone records that matter here.
 *
 * Little-endian, so that the orientation reader cannot quietly be assuming
 * the big-endian layout it writes back.
 */
function exifPayload(orientation: number): number[] {
  const MAKE = 'ACME-PHONE\0';
  const GPS_SENTINEL = 'GPS-SECRET-LOCATION\0';

  // Offsets in TIFF are counted from the start of the TIFF block, which is
  // the byte after "Exif\0\0".
  const ifd0At = 8;
  const ifd0Size = 2 + 3 * 12 + 4; // count + entries + next-directory pointer
  const makeAt = ifd0At + ifd0Size;
  const gpsIfdAt = makeAt + MAKE.length + 1; // +1 pad, keeping entries aligned
  const gpsIfdSize = 2 + 2 * 12 + 4;
  const gpsSentinelAt = gpsIfdAt + gpsIfdSize;

  // prettier-ignore
  const ifd0 = [
    ...u16le(3),
    // Orientation: a SHORT, small enough to sit inside the entry itself.
    ...u16le(0x0112), ...u16le(3), ...u32le(1), ...u16le(orientation), 0, 0,
    // Make: ASCII, too long to inline, so the entry holds an offset instead.
    ...u16le(0x010f), ...u16le(2), ...u32le(MAKE.length), ...u32le(makeAt),
    // Pointer to the GPS directory.
    ...u16le(0x8825), ...u16le(4), ...u32le(1), ...u32le(gpsIfdAt),
    ...u32le(0),
  ];

  // prettier-ignore
  const gpsIfd = [
    ...u16le(2),
    // GPSLatitudeRef: two ASCII bytes, inline.
    ...u16le(0x0001), ...u16le(2), ...u32le(2), ...ascii('N\0'), 0, 0,
    // GPSProcessingMethod: the sentinel, stored out of line.
    ...u16le(0x001b), ...u16le(7), ...u32le(GPS_SENTINEL.length),
    ...u32le(gpsSentinelAt),
    ...u32le(0),
  ];

  // prettier-ignore
  const tiff = [
    ...ascii('II'), ...u16le(42), ...u32le(ifd0At),
    ...ifd0,
    ...ascii(MAKE),
    0, // pad
    ...gpsIfd,
    ...ascii(GPS_SENTINEL),
  ];

  return [...ascii('Exif\0\0'), ...tiff];
}

/** Wrap a payload as a marker segment, with the self-counting length field. */
function segment(marker: number, payload: number[]): number[] {
  return [0xff, marker, ...u16be(payload.length + 2), ...payload];
}

/** Compressed scan data, including an escaped 0xFF that must survive intact. */
const SCAN_DATA = [0x11, 0x22, 0xff, 0x00, 0x33, 0x44, 0xff, 0x00, 0x55];

function makeJpeg(orientation = 6): Uint8Array {
  return bytes(
    [0xff, 0xd8], // SOI
    segment(0xe0, [...ascii('JFIF\0'), 1, 2, 0, 0, 1, 0, 1, 0, 0]),
    segment(0xe1, exifPayload(orientation)),
    segment(0xe1, ascii('http://ns.adobe.com/xap/1.0/\0<x>XMP-SECRET</x>')),
    segment(0xe2, [...ascii('ICC_PROFILE\0'), 1, 1, ...ascii('ICC-KEEP')]),
    segment(0xed, [...ascii('Photoshop 3.0\0'), ...ascii('IPTC-SECRET')]),
    segment(0xee, [...ascii('Adobe'), 0, 100, 0, 0, 0, 0, 0]),
    segment(0xfe, ascii('COMMENT-SECRET')),
    // Not an APPn segment, so it is not the stripper's business to touch it.
    segment(0xdb, [0x00, ...new Array(64).fill(0x10)]),
    segment(0xda, [0x01, 0x01, 0x00, 0x00, 0x3f, 0x00]), // SOS
    SCAN_DATA,
    [0xff, 0xd9], // EOI
    // What a phone appends after the end of the image.
    ascii('TRAILER-SECRET-DEPTH-MAP')
  );
}

/**
 * Read the orientation back out of a JPEG.
 *
 * Deliberately a second implementation, handling either byte order, so that a
 * misreading shared with the code under test cannot hide.
 */
function readOrientation(jpeg: Uint8Array): number | null {
  let i = 2;
  while (i + 3 < jpeg.length) {
    if (jpeg[i] !== 0xff) return null;
    const marker = jpeg[i + 1];
    if (marker === 0xda || marker === 0xd9) return null;
    const length = (jpeg[i + 2] << 8) | jpeg[i + 3];
    const payload = jpeg.subarray(i + 4, i + 2 + length);
    const isExif =
      marker === 0xe1 &&
      Buffer.from(payload.subarray(0, 6)).toString('binary') === 'Exif\0\0';

    if (isExif) {
      const t = payload.subarray(6);
      const le = t[0] === 0x49;
      const r16 = (o: number) =>
        le ? t[o] | (t[o + 1] << 8) : (t[o] << 8) | t[o + 1];
      const r32 = (o: number) =>
        le
          ? (t[o] | (t[o + 1] << 8) | (t[o + 2] << 16) | (t[o + 3] << 24)) >>> 0
          : ((t[o] << 24) | (t[o + 1] << 16) | (t[o + 2] << 8) | t[o + 3]) >>>
            0;
      const ifd = r32(4);
      const count = r16(ifd);
      for (let e = 0; e < count; e++) {
        const at = ifd + 2 + e * 12;
        if (r16(at) === 0x0112) return r16(at + 8);
      }
      return null;
    }
    i += 2 + length;
  }
  return null;
}

// --------------------------------------------------------------- PNG fixture

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: number[]): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A chunk with a correct length and CRC, so the fixture is a real PNG. */
function pngChunk(type: string, data: number[]): number[] {
  const typed = [...ascii(type), ...data];
  return [...u32be(data.length), ...typed, ...u32be(crc32(typed))];
}

const PNG_PIXELS = [0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01];

function makePng(): Uint8Array {
  return bytes(
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    pngChunk('IHDR', [...u32be(1), ...u32be(1), 8, 2, 0, 0, 0]),
    pngChunk('tEXt', ascii('Software\0PNG-TEXT-SECRET')),
    pngChunk('eXIf', exifPayload(1).slice(6)), // eXIf holds a bare TIFF block
    pngChunk('iTXt', ascii('XML:com.adobe.xmp\0\0\0\0\0PNG-XMP-SECRET')),
    pngChunk('tIME', [...u16be(2024), 1, 1, 0, 0, 0]),
    // An unrecognised chunk, which must survive: the stripper keeps by
    // default so a colour profile cannot be lost by not being thought of.
    pngChunk('gAMA', u32be(45455)),
    pngChunk('IDAT', PNG_PIXELS),
    pngChunk('IEND', [])
  );
}

// -------------------------------------------------------------- WebP fixture

function webpChunk(tag: string, data: number[]): number[] {
  const padded = data.length % 2 ? [...data, 0] : data;
  return [...ascii(tag), ...u32le(data.length), ...padded];
}

const VP8_PAYLOAD = [0x9d, 0x01, 0x2a, 0x01, 0x00, 0x01, 0x00, 0x11, 0x22];

function makeWebp(): Uint8Array {
  const body = [
    // The VP8X flag byte advertises that EXIF (0x08) and XMP (0x04) follow.
    ...webpChunk('VP8X', [0x0c, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
    ...webpChunk('VP8 ', VP8_PAYLOAD),
    ...webpChunk('EXIF', exifPayload(1).slice(6)),
    ...webpChunk('XMP ', ascii('<x>WEBP-XMP-SECRET</x>')),
  ];
  return bytes(ascii('RIFF'), u32le(4 + body.length), ascii('WEBP'), body);
}

// --------------------------------------------------------------------- tests

describe('JPEG', () => {
  const input = makeJpeg();
  const output = stripImageMetadata(input, 'image/jpeg');

  it('removes the location the photo was taken at', () => {
    assert.ok(containsText(input, 'GPS-SECRET-LOCATION'), 'fixture is wrong');
    assert.ok(!containsText(output, 'GPS-SECRET-LOCATION'));
  });

  it('removes the device that took it', () => {
    assert.ok(!containsText(output, 'ACME-PHONE'));
  });

  it('removes XMP, IPTC and comments', () => {
    assert.ok(!containsText(output, 'XMP-SECRET'));
    assert.ok(!containsText(output, 'IPTC-SECRET'));
    assert.ok(!containsText(output, 'COMMENT-SECRET'));
  });

  it('removes data appended after the end of the image', () => {
    assert.ok(containsText(input, 'TRAILER-SECRET-DEPTH-MAP'), 'fixture wrong');
    assert.ok(!containsText(output, 'TRAILER-SECRET-DEPTH-MAP'));
  });

  it('keeps the colour profile, which the picture needs to look right', () => {
    assert.ok(containsText(output, 'ICC-KEEP'));
    assert.ok(containsText(output, 'JFIF'));
  });

  it('keeps the tables the image is decoded with', () => {
    // The quantisation table is not metadata; dropping it destroys the file.
    assert.notEqual(indexOfBytes(output, [0xff, 0xdb]), -1);
  });

  it('keeps which way up the photo is', () => {
    assert.equal(readOrientation(input), 6);
    assert.equal(readOrientation(output), 6);
  });

  it('writes no EXIF at all when the photo is already upright', () => {
    const upright = stripImageMetadata(makeJpeg(1), 'image/jpeg');
    assert.equal(readOrientation(upright), null);
    assert.ok(!containsText(upright, 'Exif'));
  });

  it('leaves the pixels untouched', () => {
    // The reason for editing the container instead of re-encoding: the image
    // is bit-identical, so nothing is lost to another generation of JPEG.
    const at = indexOfBytes(output, [0xff, 0xda]);
    assert.notEqual(at, -1, 'no scan header in output');
    const scanStart = at + 2 + ((output[at + 2] << 8) | output[at + 3]);
    const scan = output.subarray(scanStart, output.length - 2);
    assert.deepEqual(Array.from(scan), SCAN_DATA);
  });

  it('ends at the end-of-image marker', () => {
    assert.deepEqual(Array.from(output.subarray(-2)), [0xff, 0xd9]);
  });

  it('is unchanged by a second pass', () => {
    // Re-uploading a file the platform already stored must not degrade it.
    const twice = stripImageMetadata(output, 'image/jpeg');
    assert.deepEqual(Array.from(twice), Array.from(output));
  });

  it('is smaller than what it was given', () => {
    assert.ok(output.length < input.length);
  });
});

describe('PNG', () => {
  const input = makePng();
  const output = stripImageMetadata(input, 'image/png');

  it('removes EXIF, text and timestamps', () => {
    assert.ok(containsText(input, 'GPS-SECRET-LOCATION'), 'fixture is wrong');
    assert.ok(!containsText(output, 'GPS-SECRET-LOCATION'));
    assert.ok(!containsText(output, 'PNG-TEXT-SECRET'));
    assert.ok(!containsText(output, 'PNG-XMP-SECRET'));
    assert.equal(indexOfBytes(output, ascii('tIME')), -1);
  });

  it('keeps the header, the pixels and the end marker', () => {
    assert.notEqual(indexOfBytes(output, ascii('IHDR')), -1);
    assert.notEqual(indexOfBytes(output, PNG_PIXELS), -1);
    assert.notEqual(indexOfBytes(output, ascii('IEND')), -1);
  });

  it('keeps chunks it does not recognise', () => {
    assert.notEqual(indexOfBytes(output, ascii('gAMA')), -1);
  });

  it('leaves surviving chunks byte-identical, so their CRCs still hold', () => {
    const at = indexOfBytes(output, ascii('IDAT'));
    const length =
      (output[at - 4] << 24) |
      (output[at - 3] << 16) |
      (output[at - 2] << 8) |
      output[at - 1];
    const chunk = Array.from(output.subarray(at, at + 4 + length));
    const stored = output.subarray(at + 4 + length, at + 8 + length);
    assert.deepEqual(Array.from(stored), u32be(crc32(chunk)));
  });

  it('is unchanged by a second pass', () => {
    const twice = stripImageMetadata(output, 'image/png');
    assert.deepEqual(Array.from(twice), Array.from(output));
  });
});

describe('WebP', () => {
  const input = makeWebp();
  const output = stripImageMetadata(input, 'image/webp');

  it('removes EXIF and XMP', () => {
    assert.ok(containsText(input, 'GPS-SECRET-LOCATION'), 'fixture is wrong');
    assert.ok(!containsText(output, 'GPS-SECRET-LOCATION'));
    assert.ok(!containsText(output, 'WEBP-XMP-SECRET'));
  });

  it('keeps the pixels', () => {
    assert.notEqual(indexOfBytes(output, VP8_PAYLOAD), -1);
  });

  it('stops advertising the chunks it removed', () => {
    // A decoder that trusts the flag and then cannot find the chunk may
    // decide the file is damaged.
    const at = indexOfBytes(output, ascii('VP8X'));
    assert.notEqual(at, -1);
    assert.equal(output[at + 8] & 0x0c, 0);
  });

  it('corrects the size in the RIFF header', () => {
    const size =
      output[4] | (output[5] << 8) | (output[6] << 16) | (output[7] << 24);
    assert.equal(size, output.length - 8);
  });

  it('is unchanged by a second pass', () => {
    const twice = stripImageMetadata(output, 'image/webp');
    assert.deepEqual(Array.from(twice), Array.from(output));
  });
});

describe('other content types', () => {
  it('passes video through untouched', () => {
    // Video is stripped while it is transcoded, not here, and it is large
    // enough that copying it would be worth avoiding even if it were not.
    const video = bytes(ascii('....ftypmp42'), [1, 2, 3]);
    assert.equal(stripImageMetadata(video, 'video/mp4'), video);
  });

  it('passes GIF through untouched', () => {
    const gif = bytes(ascii('GIF89a'), [1, 2, 3]);
    assert.equal(stripImageMetadata(gif, 'image/gif'), gif);
  });
});

describe('input that does not parse', () => {
  /*
   * Rejected rather than stored as-is. Passing bytes through because we could
   * not read them would mean storing a file whose metadata we cannot vouch
   * for, which is the promise this module exists to keep. It also catches
   * files that are not the type they claim to be, which nothing else in the
   * upload path checks -- the routes trust the browser's content type.
   */

  it('rejects bytes that are not a JPEG', () => {
    assert.throws(
      () =>
        stripImageMetadata(bytes(ascii('not an image at all')), 'image/jpeg'),
      MetadataStripError
    );
  });

  it('rejects a PNG with a damaged signature', () => {
    const png = makePng();
    png[3] = 0x00;
    assert.throws(
      () => stripImageMetadata(png, 'image/png'),
      MetadataStripError
    );
  });

  it('rejects a WebP that is not RIFF', () => {
    const webp = makeWebp();
    webp[9] = 0x00;
    assert.throws(
      () => stripImageMetadata(webp, 'image/webp'),
      MetadataStripError
    );
  });

  it('rejects a JPEG whose segment length runs past the end', () => {
    const jpeg = makeJpeg();
    const at = indexOfBytes(jpeg, [0xff, 0xe0]);
    jpeg[at + 2] = 0xff;
    jpeg[at + 3] = 0xff;
    assert.throws(
      () => stripImageMetadata(jpeg, 'image/jpeg'),
      MetadataStripError
    );
  });
});
