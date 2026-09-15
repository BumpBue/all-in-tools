'use client';

import {
  outputMime,
  targetSize,
  type OutputFormat,
  type ResizeOptions,
  type Size,
} from '@/tools/image-resizer/logic';

export interface ResizeRequest {
  file: File;
  options: ResizeOptions;
  format: OutputFormat;
  quality: number;
}

export interface ResizeOutcome {
  blob: Blob;
  mime: string;
  source: Size;
  output: Size;
}

/**
 * A phone writes the sensor's pixels and an EXIF tag saying which way up they
 * are. `imageOrientation: 'from-image'` is what applies that tag; without it
 * every portrait photo comes out on its side.
 */
async function decode(file: File): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

function makeCanvas(size: Size): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(size.width, size.height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = size.width;
  canvas.height = size.height;
  return canvas;
}

async function toBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  mime: string,
  quality: number,
): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mime, quality });
  }

  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

export function canResizeHere(): boolean {
  return typeof createImageBitmap === 'function';
}

export async function resizeImage(request: ResizeRequest): Promise<ResizeOutcome> {
  const bitmap = await decode(request.file);

  try {
    const source = { width: bitmap.width, height: bitmap.height };
    const output = targetSize(source, request.options);
    const mime = outputMime(request.format, request.file.type);

    const canvas = makeCanvas(output);
    const context = canvas.getContext('2d') as
      | CanvasRenderingContext2D
      | OffscreenCanvasRenderingContext2D
      | null;

    if (!context) throw new Error('no 2d context');

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, output.width, output.height);

    const blob = await toBlob(canvas, mime, request.quality);
    if (!blob) throw new Error('the canvas produced no image');

    return { blob, mime, source, output };
  } finally {
    bitmap.close();
  }
}
