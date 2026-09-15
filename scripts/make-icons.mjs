/**
 * Draws the app icons from the same accent token the site uses, so the icon on
 * a home screen cannot drift away from the brand colour in globals.css.
 *
 * Run with `pnpm icons`. PNG is written by hand rather than with a graphics
 * library: the shapes are two rounded rectangles and a letter, which is less
 * code than a dependency would be.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

// --accent and --on-accent from src/app/globals.css, light theme.
const ACCENT_OKLCH = [0.53, 0.19, 266];
const ON_ACCENT_OKLCH = [0.99, 0, 0];

const SAMPLES = 4; // Supersampling per axis, for smooth edges.
const CORNER_RATIO = 0.22; // Rounded-square radius as a share of the icon.

// A maskable icon may be cropped to a circle, so its art stays in the middle
// 80% that every platform promises to keep.
const SAFE_RATIO = 0.8;

const OUTPUTS = [
  { file: 'public/icon-192.png', size: 192, maskable: false },
  { file: 'public/icon-512.png', size: 512, maskable: false },
  { file: 'public/icon-maskable-512.png', size: 512, maskable: true },
  { file: 'public/apple-touch-icon.png', size: 180, maskable: true },
];

function oklchToRgb([lightness, chroma, hueDegrees]) {
  const hue = (hueDegrees * Math.PI) / 180;
  const a = chroma * Math.cos(hue);
  const b = chroma * Math.sin(hue);

  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const linear = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];

  return linear.map((channel) => {
    const clamped = Math.min(1, Math.max(0, channel));
    const encoded =
      clamped <= 0.0031308
        ? clamped * 12.92
        : 1.055 * clamped ** (1 / 2.4) - 0.055;

    return Math.round(encoded * 255);
  });
}

function insideRoundedRect(x, y, left, top, size, radius) {
  const right = left + size;
  const bottom = top + size;
  if (x < left || x > right || y < top || y > bottom) return false;

  const cornerX = x < left + radius ? left + radius : x > right - radius ? right - radius : x;
  const cornerY = y < top + radius ? top + radius : y > bottom - radius ? bottom - radius : y;

  return (x - cornerX) ** 2 + (y - cornerY) ** 2 <= radius ** 2;
}

/** The "T" of Toolbox: a crossbar and a stem, both centred in the art box. */
function insideGlyph(x, y, boxLeft, boxTop, boxSize) {
  const barThickness = boxSize * 0.2;
  const stemWidth = boxSize * 0.2;
  const barTop = boxTop + boxSize * 0.2;
  const stemBottom = boxTop + boxSize * 0.8;

  const onBar =
    y >= barTop &&
    y <= barTop + barThickness &&
    x >= boxLeft + boxSize * 0.14 &&
    x <= boxLeft + boxSize * 0.86;

  const onStem =
    y >= barTop &&
    y <= stemBottom &&
    Math.abs(x - (boxLeft + boxSize / 2)) <= stemWidth / 2;

  return onBar || onStem;
}

function drawIcon(size, maskable) {
  const accent = oklchToRgb(ACCENT_OKLCH);
  const onAccent = oklchToRgb(ON_ACCENT_OKLCH);

  // A maskable icon must bleed to the edge; the platform rounds it itself.
  const plateSize = maskable ? size : size * 0.94;
  const plateOffset = (size - plateSize) / 2;
  const radius = maskable ? 0 : plateSize * CORNER_RATIO;

  const artSize = plateSize * (maskable ? SAFE_RATIO * 0.78 : 0.72);
  const artOffset = (size - artSize) / 2;

  const pixels = Buffer.alloc(size * size * 4);

  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      let plateHits = 0;
      let glyphHits = 0;

      for (let subRow = 0; subRow < SAMPLES; subRow += 1) {
        for (let subColumn = 0; subColumn < SAMPLES; subColumn += 1) {
          const x = column + (subColumn + 0.5) / SAMPLES;
          const y = row + (subRow + 0.5) / SAMPLES;

          if (insideRoundedRect(x, y, plateOffset, plateOffset, plateSize, radius)) {
            plateHits += 1;
            if (insideGlyph(x, y, artOffset, artOffset, artSize)) glyphHits += 1;
          }
        }
      }

      const total = SAMPLES * SAMPLES;
      const plate = plateHits / total;
      const glyph = glyphHits / total;

      const offset = (row * size + column) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        const mixed = accent[channel] * (1 - glyph) + onAccent[channel] * glyph;
        pixels[offset + channel] = Math.round(mixed);
      }
      pixels[offset + 3] = Math.round(plate * 255);
    }
  }

  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type, body) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(body.length);

  const typed = Buffer.concat([Buffer.from(type, 'ascii'), body]);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(typed));

  return Buffer.concat([length, typed, checksum]);
}

function encodePng(pixels, size) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // Bit depth.
  header[9] = 6; // Truecolour with alpha.

  // Every scanline carries a leading filter byte; 0 means "store as is".
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let row = 0; row < size; row += 1) {
    pixels.copy(raw, row * (size * 4 + 1) + 1, row * size * 4, (row + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const { file, size, maskable } of OUTPUTS) {
  const png = encodePng(drawIcon(size, maskable), size);
  writeFileSync(file, png);
  console.log(`${file}\t${size}×${size}\t${png.length} bytes`);
}
