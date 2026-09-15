import { describe, expect, it } from 'vitest';

import { ZIP_SIGNATURES, buildZip, crc32, type ZipEntry } from '@/tools/image-resizer/zip';

/**
 * An extractor written from the zip spec rather than from the writer above, so
 * the two only agree if the file is actually a zip. It walks the end record to
 * the central directory, follows each entry's offset to its local header, and
 * reads the bytes from there — which is what any unzip program does.
 */
function unzip(archive: Uint8Array): Array<{ name: string; bytes: Uint8Array; crc: number }> {
  const view = new DataView(archive.buffer, archive.byteOffset, archive.byteLength);
  const decoder = new TextDecoder();

  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_SIGNATURES.end) {
      endOffset = offset;
      break;
    }
  }

  if (endOffset === -1) throw new Error('no end of central directory record');

  const entryCount = view.getUint16(endOffset + 10, true);
  const directoryStart = view.getUint32(endOffset + 16, true);

  const files: Array<{ name: string; bytes: Uint8Array; crc: number }> = [];
  let cursor = directoryStart;

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(cursor, true) !== ZIP_SIGNATURES.central) {
      throw new Error(`entry ${index} has no central header`);
    }

    const method = view.getUint16(cursor + 10, true);
    const storedCrc = view.getUint32(cursor + 16, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);

    if (method !== 0) throw new Error('this reader only understands stored entries');
    if (compressedSize !== uncompressedSize) {
      throw new Error('a stored entry must be the same size both ways');
    }

    const name = decoder.decode(archive.subarray(cursor + 46, cursor + 46 + nameLength));

    if (view.getUint32(localOffset, true) !== ZIP_SIGNATURES.local) {
      throw new Error(`entry ${name} has no local header`);
    }

    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;

    files.push({
      name,
      bytes: archive.subarray(dataStart, dataStart + uncompressedSize),
      crc: storedCrc,
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return files;
}

function bytesOf(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

const SAMPLE: ZipEntry[] = [
  { name: 'one.txt', bytes: bytesOf('hello') },
  { name: 'two.txt', bytes: bytesOf('a longer piece of text, with a comma') },
];

describe('crc32', () => {
  // The check value every CRC-32 implementation is measured by.
  it('gives 0xCBF43926 for "123456789"', () => {
    expect(crc32(bytesOf('123456789'))).toBe(0xcbf43926);
  });

  it('gives zero for nothing', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('changes when a byte changes', () => {
    expect(crc32(bytesOf('hello'))).not.toBe(crc32(bytesOf('hellp')));
  });

  it('stays inside thirty-two bits', () => {
    expect(crc32(bytesOf('ทดสอบภาษาไทย'))).toBeLessThanOrEqual(0xffffffff);
    expect(crc32(bytesOf('ทดสอบภาษาไทย'))).toBeGreaterThanOrEqual(0);
  });
});

describe('buildZip', () => {
  it('starts with a local file header', () => {
    const archive = buildZip(SAMPLE);
    const view = new DataView(archive.buffer);

    expect(view.getUint32(0, true)).toBe(ZIP_SIGNATURES.local);
  });

  it('can be read back by a reader that knows only the spec', () => {
    const files = unzip(buildZip(SAMPLE));

    expect(files.map((file) => file.name)).toEqual(['one.txt', 'two.txt']);
  });

  it('gives back exactly the bytes that went in', () => {
    const files = unzip(buildZip(SAMPLE));

    expect(new TextDecoder().decode(files[0]?.bytes)).toBe('hello');
    expect(new TextDecoder().decode(files[1]?.bytes)).toBe(
      'a longer piece of text, with a comma',
    );
  });

  it('stores a checksum that matches the bytes it stored', () => {
    for (const file of unzip(buildZip(SAMPLE))) {
      expect(file.crc).toBe(crc32(file.bytes));
    }
  });

  it('survives binary content, not just text', () => {
    const bytes = new Uint8Array(Array.from({ length: 512 }, (_, index) => index % 256));
    const [file] = unzip(buildZip([{ name: 'blob.bin', bytes }]));

    expect(file?.bytes).toEqual(bytes);
    expect(file?.crc).toBe(crc32(bytes));
  });

  it('keeps a Thai filename readable, which is what the UTF-8 flag is for', () => {
    const [file] = unzip(buildZip([{ name: 'รูปภาพ.jpg', bytes: bytesOf('x') }]));
    expect(file?.name).toBe('รูปภาพ.jpg');
  });

  it('writes an empty archive that still parses', () => {
    expect(unzip(buildZip([]))).toEqual([]);
  });

  it('handles a file with no content', () => {
    const [file] = unzip(buildZip([{ name: 'empty.txt', bytes: new Uint8Array(0) }]));

    expect(file?.bytes).toHaveLength(0);
    expect(file?.crc).toBe(0);
  });

  it('builds the same bytes twice for the same input', () => {
    expect(buildZip(SAMPLE)).toEqual(buildZip(SAMPLE));
  });

  it('holds many files without losing one', () => {
    const many = Array.from({ length: 30 }, (_, index) => ({
      name: `file-${index}.txt`,
      bytes: bytesOf(`contents number ${index}`),
    }));

    const files = unzip(buildZip(many));

    expect(files).toHaveLength(30);
    expect(new TextDecoder().decode(files[29]?.bytes)).toBe('contents number 29');
  });
});
