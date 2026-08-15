// id3Metadata.ts
// Corrected ID3v2 tag parsing: handles v2.3/v2.4 frame sizes correctly (v2.4 uses
// synchsafe integers), fixes UTF-16 description-terminator scanning, and extracts
// ALL embedded picture types (front/back/disc/icon/other) instead of just one.

export type ArtworkKind = 'front' | 'back' | 'disc' | 'icon' | 'other';

export interface ArtworkImage {
  mimeType: string;
  pictureType: number;
  pictureTypeName: string;
  description: string;
  data: Uint8Array;
}

export interface ArtworkUrls {
  front?: string;
  back?: string;
  disc?: string;
  icon?: string;
  other: string[];
}

const APIC_PICTURE_TYPES: Record<number, string> = {
  0: 'Other',
  1: 'File Icon',
  2: 'Other File Icon',
  3: 'Cover Front',
  4: 'Cover Back',
  5: 'Leaflet',
  6: 'Media',
  7: 'Lead Artist',
  8: 'Artist',
  9: 'Conductor',
  10: 'Band',
  11: 'Composer',
  12: 'Lyricist',
  13: 'Recording Location',
  14: 'Recording Session',
  15: 'Performance',
  16: 'Capture',
  17: 'Illustration',
  18: 'Band Logo',
  19: 'Publisher Logo',
};

// "Media" (6) is the closest standard slot to disc art; icons map both icon types together.
const KIND_BY_PICTURE_TYPE: Record<number, ArtworkKind> = {
  1: 'icon',
  2: 'icon',
  3: 'front',
  4: 'back',
  6: 'disc',
};

function decodeTextPayload(payload: Uint8Array, encoding: number): string {
  if (encoding === 1 || encoding === 2) {
    return new TextDecoder('utf-16').decode(payload).replace(/\u0000+$/g, '').trim();
  }
  if (encoding === 3) {
    return new TextDecoder('utf-8').decode(payload).replace(/\u0000+$/g, '').trim();
  }
  return new TextDecoder('latin1').decode(payload).replace(/\u0000+$/g, '').trim();
}

// Finds the text terminator, correctly pair-aligned for UTF-16 (encoding 1/2),
// where the terminator is two 0x00 bytes together, not a single stray zero byte.
function findTextTerminator(bytes: Uint8Array, start: number, isUtf16: boolean): number {
  if (!isUtf16) {
    return bytes.indexOf(0x00, start);
  }
  for (let i = start; i + 1 < bytes.length; i += 2) {
    if (bytes[i] === 0x00 && bytes[i + 1] === 0x00) return i;
  }
  return -1;
}

function synchsafeToInt(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] & 0x7f) << 21) |
    ((bytes[offset + 1] & 0x7f) << 14) |
    ((bytes[offset + 2] & 0x7f) << 7) |
    (bytes[offset + 3] & 0x7f)
  );
}

// v2.4 frame sizes are synchsafe; v2.3 frame sizes are plain big-endian uint32.
// Getting this wrong (as a plain getUint32 for v2.4) corrupts every frame boundary
// after the first mis-sized frame, which is the main cause of "works for some files".
function readFrameSize(bytes: Uint8Array, offset: number, majorVersion: number): number {
  if (majorVersion >= 4) {
    return synchsafeToInt(bytes, offset);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(offset, false);
}

interface RawId3v2Tag {
  majorVersion: number;
  frames: Map<string, Uint8Array[]>; // supports multiple APIC frames per file
}

// Reverses the ID3v2 "unsynchronisation" scheme: encoders insert a stray 0x00
// after every 0xFF byte (so MPEG players scanning for frame sync headers don't
// mistake tag data for audio sync). Decoding just removes those inserted zero
// bytes. This matters a lot for embedded JPEGs specifically, since JPEG's own
// entropy-coded data is dense with 0xFF bytes - an un-reversed tag produces
// artwork that decodes correctly up to the first stray insertion, then breaks,
// which is exactly the "top of the image is fine, then garbage" symptom.
function removeUnsynchronisation(bytes: Uint8Array): Uint8Array {
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) {
    out.push(bytes[i]);
    if (bytes[i] === 0xff && i + 1 < bytes.length && bytes[i + 1] === 0x00) {
      i += 1; // drop the inserted 0x00
    }
  }
  return Uint8Array.from(out);
}

function parseId3v2Tag(arrayBuffer: ArrayBuffer): RawId3v2Tag | null {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 10 || String.fromCharCode(...bytes.slice(0, 3)) !== 'ID3') {
    return null;
  }

  const majorVersion = bytes[3];
  const tagFlags = bytes[5];
  const tagSize = synchsafeToInt(bytes, 6);
  const frames = new Map<string, Uint8Array[]>();

  // ID3v2.2 uses 3-char frame IDs / 3-byte sizes (different layout entirely) - not
  // handled here; callers should fall back to ID3v1 for these rare, very old files.
  if (majorVersion < 3) {
    return { majorVersion, frames };
  }

  const rawBody = bytes.slice(10, Math.min(10 + tagSize, bytes.length));
  const globalUnsync = (tagFlags & 0x80) !== 0;
  // When the global flag is set, the WHOLE tag body (including frame headers and
  // size fields) was stuffed as one unit, so it must be reversed before we can
  // trust any frame boundary or size we read out of it.
  const body = globalUnsync ? removeUnsynchronisation(rawBody) : rawBody;
  const frameEnd = body.length;

  let offset = 0;
  while (offset + 10 <= frameEnd) {
    const frameId = String.fromCharCode(...body.slice(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // padding or corrupt frame, stop

    const frameSize = readFrameSize(body, offset + 4, majorVersion);
    const flags2 = body[offset + 9];
    const frameDataStart = offset + 10;
    const frameDataEnd = frameDataStart + frameSize;
    if (frameSize <= 0 || frameDataEnd > frameEnd) break;

    // Compression (zlib) and encryption require support we don't have; including
    // these frames as-is would hand back ciphertext/compressed bytes as if they
    // were a raw image, so skip them rather than produce garbage.
    const isCompressed = majorVersion >= 4 ? (flags2 & 0x08) !== 0 : (flags2 & 0x80) !== 0;
    const isEncrypted = majorVersion >= 4 ? (flags2 & 0x04) !== 0 : (flags2 & 0x40) !== 0;

    if (!isCompressed && !isEncrypted) {
      let payload = body.slice(frameDataStart, frameDataEnd);

      if (majorVersion >= 4) {
        const hasDataLengthIndicator = (flags2 & 0x01) !== 0;
        const isFrameUnsync = (flags2 & 0x02) !== 0;

        // The 4-byte data-length-indicator (a synchsafe int) precedes the actual
        // content when present - skip it to reach the real payload.
        if (hasDataLengthIndicator && payload.length > 4) {
          payload = payload.slice(4);
        }

        // Only reverse per-frame unsync if the whole tag wasn't already reversed
        // above - a well-formed file sets one or the other, not both.
        if (isFrameUnsync && !globalUnsync) {
          payload = removeUnsynchronisation(payload) as Uint8Array<ArrayBuffer>;
        }
      }

      const existing = frames.get(frameId);
      if (existing) existing.push(payload);
      else frames.set(frameId, [payload]);
    }

    offset = frameDataEnd;
  }

  return { majorVersion, frames };
}

export function parseId3v2Metadata(arrayBuffer: ArrayBuffer): { title: string | null; artist: string | null } | null {
  const tag = parseId3v2Tag(arrayBuffer);
  if (!tag) return null;

  const titleFrame = tag.frames.get('TIT2')?.[0];
  const artistFrame = tag.frames.get('TPE1')?.[0];

  const title = titleFrame && titleFrame.length > 1 ? decodeTextPayload(titleFrame.slice(1), titleFrame[0]) : null;
  const artist = artistFrame && artistFrame.length > 1 ? decodeTextPayload(artistFrame.slice(1), artistFrame[0]) : null;

  return { title, artist };
}

export function parseId3v1Metadata(arrayBuffer: ArrayBuffer): { title: string | null; artist: string | null } | null {
  const bytes = new Uint8Array(arrayBuffer);
  const tagOffset = bytes.length - 128;
  if (tagOffset < 0) return null;
  if (String.fromCharCode(...bytes.slice(tagOffset, tagOffset + 3)) !== 'TAG') return null;

  const title = new TextDecoder('latin1').decode(bytes.slice(tagOffset + 3, tagOffset + 33)).replace(/\u0000+$/g, '').trim();
  const artist = new TextDecoder('latin1').decode(bytes.slice(tagOffset + 63, tagOffset + 93)).replace(/\u0000+$/g, '').trim();

  return { title: title || null, artist: artist || null };
}

function extractArtworkFromTag(tag: RawId3v2Tag): ArtworkImage[] {
  const apicFrames = tag.frames.get('APIC') ?? [];
  const images: ArtworkImage[] = [];

  for (const payload of apicFrames) {
    if (payload.length < 2) continue;
    const encoding = payload[0];

    const mimeTerminator = payload.indexOf(0, 1);
    if (mimeTerminator < 0) continue;
    const mimeType = new TextDecoder('latin1').decode(payload.slice(1, mimeTerminator));

    let cursor = mimeTerminator + 1;
    if (cursor >= payload.length) continue;
    const pictureType = payload[cursor];
    cursor += 1;

    const isUtf16 = encoding === 1 || encoding === 2;
    const descriptionStart = cursor;
    const descriptionTerminator = findTextTerminator(payload, descriptionStart, isUtf16);

    const descriptionBytes =
      descriptionTerminator >= 0
        ? payload.slice(descriptionStart, descriptionTerminator)
        : payload.slice(descriptionStart);
    const description = decodeTextPayload(descriptionBytes, encoding);

    const nextCursor =
      descriptionTerminator >= 0 ? descriptionTerminator + (isUtf16 ? 2 : 1) : payload.length;
    const imageData = payload.slice(Math.min(nextCursor, payload.length));
    if (imageData.length === 0) continue;

    images.push({
      mimeType: mimeType || 'image/jpeg',
      pictureType,
      pictureTypeName: APIC_PICTURE_TYPES[pictureType] ?? 'Unknown',
      description,
      data: imageData,
    });
  }

  return images;
}

function groupArtworkByKind(images: ArtworkImage[]): Record<ArtworkKind, ArtworkImage[]> {
  const groups: Record<ArtworkKind, ArtworkImage[]> = { front: [], back: [], disc: [], icon: [], other: [] };
  for (const img of images) {
    const kind = KIND_BY_PICTURE_TYPE[img.pictureType] ?? 'other';
    groups[kind].push(img);
  }
  return groups;
}

export const HEADER_SIZE = 256 * 1024; // shared with the directory scan's header slice size

// Reads and parses the ID3v2 tag for a file. If `headerBuffer` (the slice already
// fetched during the directory scan) is long enough to contain the whole tag - true
// for the vast majority of files - this does ZERO extra file reads. Only tags whose
// size exceeds the header slice (large embedded art) trigger one small follow-up
// read for just the missing remainder, never a full re-read from byte 0.
export async function readId3v2Tag(file: File, headerBuffer?: ArrayBuffer): Promise<RawId3v2Tag | null> {
  const initial = headerBuffer ?? (await file.slice(0, HEADER_SIZE).arrayBuffer());
  const initialBytes = new Uint8Array(initial);

  if (initialBytes.length < 10 || String.fromCharCode(...initialBytes.slice(0, 3)) !== 'ID3') {
    return null;
  }

  const tagSize = synchsafeToInt(initialBytes, 6);
  const fullTagLength = 10 + tagSize;

  if (initialBytes.length >= fullTagLength) {
    return parseId3v2Tag(initialBytes.buffer.slice(initialBytes.byteOffset, initialBytes.byteOffset + fullTagLength));
  }

  const remainder = await file.slice(initialBytes.length, fullTagLength).arrayBuffer();
  const combined = new Uint8Array(fullTagLength);
  combined.set(initialBytes, 0);
  combined.set(new Uint8Array(remainder), initialBytes.length);
  return parseId3v2Tag(combined.buffer);
}

// Extracts front/back/disc/icon (+ any other embedded pictures) as object URLs,
// picking the first image found per kind. Caller owns revoking these URLs.
export async function extractArtworkUrls(file: File, headerBuffer?: ArrayBuffer): Promise<ArtworkUrls> {
  const tag = await readId3v2Tag(file, headerBuffer);
  const images = tag ? extractArtworkFromTag(tag) : [];
  const groups = groupArtworkByKind(images);

  // `data` is a subarray view (from .slice()), so TS can't prove its underlying
  // buffer is a plain ArrayBuffer rather than a SharedArrayBuffer, and Blob's
  // constructor now requires ArrayBuffer specifically. Copying into a fresh
  // Uint8Array gives it a fresh, unambiguous ArrayBuffer-backed buffer.
  const toBlobUrl = (img: ArtworkImage): string =>
    URL.createObjectURL(new Blob([new Uint8Array(img.data)], { type: img.mimeType }));

  const toUrl = (imgs: ArtworkImage[]): string | undefined =>
    imgs.length > 0 ? toBlobUrl(imgs[0]) : undefined;

  return {
    front: toUrl(groups.front),
    back: toUrl(groups.back),
    disc: toUrl(groups.disc),
    icon: toUrl(groups.icon),
    other: groups.other.map(toBlobUrl),
  };
}