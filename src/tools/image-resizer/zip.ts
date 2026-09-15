/**
 * A minimal zip writer, store method only.
 *
 * Deliberately not a zip library: without compression a zip is a header, the
 * bytes, and a table of contents, and the images going into it are already
 * compressed — deflating a JPEG buys nothing. The whole format used here is
 * four structures, all little-endian.
 */
const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

const VERSION_NEEDED = 20;
const STORE_METHOD = 0;
const UTF8_FLAG = 0x0800;

const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_RECORD_SIZE = 22;

/** 1 January 1980, where DOS timestamps begin; kept fixed so a zip built from
 * the same files is byte for byte the same file. */
export const ZIP_EPOCH_DATE = 0x0021;
export const ZIP_EPOCH_TIME = 0x0000;

const CRC_POLYNOMIAL = 0xedb88320;
const BYTE_VALUES = 256;
const BITS_PER_BYTE = 8;

const CRC_TABLE = (() => {
  const table = new Uint32Array(BYTE_VALUES);

  for (let index = 0; index < BYTE_VALUES; index += 1) {
    let value = index;
    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      value = (value & 1) === 1 ? (value >>> 1) ^ CRC_POLYNOMIAL : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (const byte of bytes) {
    crc = (crc >>> BITS_PER_BYTE) ^ (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

class ByteWriter {
  private parts: Uint8Array[] = [];
  private length = 0;

  get size(): number {
    return this.length;
  }

  push(bytes: Uint8Array): void {
    this.parts.push(bytes);
    this.length += bytes.length;
  }

  uint16(value: number): void {
    const buffer = new Uint8Array(2);
    new DataView(buffer.buffer).setUint16(0, value, true);
    this.push(buffer);
  }

  uint32(value: number): void {
    const buffer = new Uint8Array(4);
    new DataView(buffer.buffer).setUint32(0, value >>> 0, true);
    this.push(buffer);
  }

  toBytes(): Uint8Array {
    const output = new Uint8Array(this.length);
    let offset = 0;

    for (const part of this.parts) {
      output.set(part, offset);
      offset += part.length;
    }

    return output;
  }
}

export function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const writer = new ByteWriter();

  const directory: Array<{
    name: Uint8Array;
    crc: number;
    size: number;
    offset: number;
  }> = [];

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const offset = writer.size;

    writer.uint32(LOCAL_HEADER);
    writer.uint16(VERSION_NEEDED);
    writer.uint16(UTF8_FLAG);
    writer.uint16(STORE_METHOD);
    writer.uint16(ZIP_EPOCH_TIME);
    writer.uint16(ZIP_EPOCH_DATE);
    writer.uint32(crc);
    writer.uint32(entry.bytes.length);
    writer.uint32(entry.bytes.length);
    writer.uint16(name.length);
    writer.uint16(0);
    writer.push(name);
    writer.push(entry.bytes);

    directory.push({ name, crc, size: entry.bytes.length, offset });
  }

  const directoryStart = writer.size;

  for (const entry of directory) {
    writer.uint32(CENTRAL_HEADER);
    writer.uint16(VERSION_NEEDED);
    writer.uint16(VERSION_NEEDED);
    writer.uint16(UTF8_FLAG);
    writer.uint16(STORE_METHOD);
    writer.uint16(ZIP_EPOCH_TIME);
    writer.uint16(ZIP_EPOCH_DATE);
    writer.uint32(entry.crc);
    writer.uint32(entry.size);
    writer.uint32(entry.size);
    writer.uint16(entry.name.length);
    writer.uint16(0);
    writer.uint16(0);
    writer.uint16(0);
    writer.uint16(0);
    writer.uint32(0);
    writer.uint32(entry.offset);
    writer.push(entry.name);
  }

  const directorySize = writer.size - directoryStart;

  writer.uint32(END_OF_CENTRAL_DIRECTORY);
  writer.uint16(0);
  writer.uint16(0);
  writer.uint16(directory.length);
  writer.uint16(directory.length);
  writer.uint32(directorySize);
  writer.uint32(directoryStart);
  writer.uint16(0);

  return writer.toBytes();
}

export const ZIP_SIZES = {
  localHeader: LOCAL_HEADER_SIZE,
  centralHeader: CENTRAL_HEADER_SIZE,
  endRecord: END_RECORD_SIZE,
} as const;

export const ZIP_SIGNATURES = {
  local: LOCAL_HEADER,
  central: CENTRAL_HEADER,
  end: END_OF_CENTRAL_DIRECTORY,
} as const;
