import { describe, expect, it } from 'vitest';

import {
  DEFAULT_OPTIONS,
  DEFAULT_QUALITY,
  MAX_DIMENSION,
  MAX_FILES,
  MAX_FILE_BYTES,
  checkFiles,
  clampQuality,
  extensionFor,
  isAcceptedType,
  outputMime,
  outputName,
  savedPercent,
  targetSize,
  uniqueNames,
  type ResizeOptions,
} from '@/tools/image-resizer/logic';

const LANDSCAPE = { width: 4000, height: 3000 };
const PORTRAIT = { width: 1200, height: 1600 };

function options(overrides: Partial<ResizeOptions> = {}): ResizeOptions {
  return { ...DEFAULT_OPTIONS, ...overrides };
}

function fakeFile(name: string, type: string, size: number): File {
  const file = new File(['x'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

describe('targetSize by percent', () => {
  it('scales both sides', () => {
    expect(targetSize(LANDSCAPE, options({ mode: 'percent', percent: 50 }))).toEqual({
      width: 2000,
      height: 1500,
    });
  });

  it('keeps the aspect ratio', () => {
    const size = targetSize(LANDSCAPE, options({ mode: 'percent', percent: 37 }));
    expect(size.width / size.height).toBeCloseTo(4 / 3, 2);
  });

  it('never enlarges past the original', () => {
    expect(targetSize(LANDSCAPE, options({ mode: 'percent', percent: 500 }))).toEqual(
      LANDSCAPE,
    );
  });

  it('never shrinks to nothing', () => {
    const size = targetSize({ width: 10, height: 10 }, options({ mode: 'percent', percent: 1 }));
    expect(size.width).toBeGreaterThanOrEqual(1);
  });
});

describe('targetSize by longest side', () => {
  it('fits the longer side to the number given', () => {
    expect(targetSize(LANDSCAPE, options({ mode: 'longest', longest: 1000 }))).toEqual({
      width: 1000,
      height: 750,
    });
  });

  it('knows which side is longer on a portrait image', () => {
    expect(targetSize(PORTRAIT, options({ mode: 'longest', longest: 800 }))).toEqual({
      width: 600,
      height: 800,
    });
  });

  it('leaves an image that is already smaller alone', () => {
    // Enlarging a small photo to 4000px gives a blurry 4000px photo.
    expect(targetSize({ width: 800, height: 600 }, options({ mode: 'longest', longest: 4000 })))
      .toEqual({ width: 800, height: 600 });
  });

  it('handles a square', () => {
    expect(targetSize({ width: 500, height: 500 }, options({ mode: 'longest', longest: 250 })))
      .toEqual({ width: 250, height: 250 });
  });
});

describe('targetSize by dimensions', () => {
  it('fits inside the box rather than stretching to fill it', () => {
    const size = targetSize(LANDSCAPE, options({ mode: 'dimensions', width: 1000, height: 1000 }));

    expect(size).toEqual({ width: 1000, height: 750 });
    expect(size.width / size.height).toBeCloseTo(4 / 3, 2);
  });

  it('stretches only when the lock is off', () => {
    expect(
      targetSize(
        LANDSCAPE,
        options({ mode: 'dimensions', width: 1000, height: 1000, lockAspect: false }),
      ),
    ).toEqual({ width: 1000, height: 1000 });
  });

  it('never enlarges either side', () => {
    const size = targetSize(
      { width: 500, height: 400 },
      options({ mode: 'dimensions', width: 4000, height: 4000 }),
    );
    expect(size).toEqual({ width: 500, height: 400 });
  });

  it('refuses a dimension past what a canvas will hold', () => {
    const size = targetSize(
      { width: 40_000, height: 40_000 },
      options({ mode: 'dimensions', width: 99_999, height: 99_999, lockAspect: false }),
    );

    expect(size.width).toBeLessThanOrEqual(MAX_DIMENSION);
  });

  it('copes with a source of no size at all', () => {
    expect(targetSize({ width: 0, height: 0 }, options())).toEqual({ width: 1, height: 1 });
  });
});

describe('output naming', () => {
  it('keeps the source type when asked to keep it', () => {
    expect(outputMime('keep', 'image/png')).toBe('image/png');
    expect(outputMime('jpeg', 'image/png')).toBe('image/jpeg');
  });

  it('falls back to jpeg for a source type it cannot write', () => {
    expect(outputMime('keep', 'image/bmp')).toBe('image/jpeg');
  });

  it('swaps the extension to match the format', () => {
    expect(outputName('holiday.png', 'image/jpeg')).toBe('holiday.jpg');
    expect(outputName('holiday.jpeg', 'image/webp')).toBe('holiday.webp');
  });

  it('copes with a name that has no extension', () => {
    expect(outputName('scan', 'image/png')).toBe('scan.png');
  });

  it('copes with a name that is only an extension', () => {
    expect(outputName('.gitignore', 'image/png')).toBe('image.png');
  });

  it('keeps the dots inside a name', () => {
    expect(outputName('photo.2026.01.jpg', 'image/webp')).toBe('photo.2026.01.webp');
  });

  it('knows the extension for each type it writes', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('image/webp')).toBe('webp');
    expect(extensionFor('application/pdf')).toBe('img');
  });
});

describe('uniqueNames', () => {
  it('leaves distinct names alone', () => {
    expect(uniqueNames(['a.jpg', 'b.jpg'])).toEqual(['a.jpg', 'b.jpg']);
  });

  it('numbers a repeat rather than overwriting it in the zip', () => {
    expect(uniqueNames(['a.jpg', 'a.jpg', 'a.jpg'])).toEqual([
      'a.jpg',
      'a-2.jpg',
      'a-3.jpg',
    ]);
  });

  it('numbers a repeat with no extension', () => {
    expect(uniqueNames(['scan', 'scan'])).toEqual(['scan', 'scan-2']);
  });

  it('gives every name in a long list its own place', () => {
    const names = uniqueNames(Array.from({ length: 10 }, () => 'same.png'));
    expect(new Set(names).size).toBe(10);
  });
});

describe('savedPercent', () => {
  it('reports the share taken off', () => {
    expect(savedPercent(1000, 250)).toBe(75);
    expect(savedPercent(1000, 1000)).toBe(0);
  });

  it('never reports a negative saving when the file grew', () => {
    expect(savedPercent(100, 400)).toBe(0);
  });

  it('copes with nothing to compare against', () => {
    expect(savedPercent(0, 100)).toBe(0);
  });
});

describe('checkFiles', () => {
  it('accepts an image it can read', () => {
    const { accepted, rejected } = checkFiles([fakeFile('a.jpg', 'image/jpeg', 1000)], 0);

    expect(accepted).toHaveLength(1);
    expect(rejected).toHaveLength(0);
  });

  it('turns away a file that is not an image', () => {
    const { rejected } = checkFiles([fakeFile('notes.pdf', 'application/pdf', 100)], 0);
    expect(rejected[0]).toEqual({ name: 'notes.pdf', reason: 'type' });
  });

  it('turns away a file too big to decode comfortably', () => {
    const { rejected } = checkFiles(
      [fakeFile('huge.jpg', 'image/jpeg', MAX_FILE_BYTES + 1)],
      0,
    );
    expect(rejected[0]?.reason).toBe('size');
  });

  it('stops at the file count it will handle', () => {
    const files = Array.from({ length: 5 }, (_, index) =>
      fakeFile(`f${index}.jpg`, 'image/jpeg', 10),
    );
    const { accepted, rejected } = checkFiles(files, MAX_FILES - 2);

    expect(accepted).toHaveLength(2);
    expect(rejected.every((each) => each.reason === 'count')).toBe(true);
  });

  it('says which kinds it takes', () => {
    expect(isAcceptedType('image/png')).toBe(true);
    expect(isAcceptedType('image/svg+xml')).toBe(false);
  });
});

describe('clampQuality', () => {
  it('keeps a sensible value', () => {
    expect(clampQuality(0.8)).toBe(0.8);
  });

  it('holds the ends', () => {
    expect(clampQuality(5)).toBe(1);
    expect(clampQuality(0)).toBeGreaterThan(0);
    expect(clampQuality(Number.NaN)).toBe(DEFAULT_QUALITY);
  });
});
