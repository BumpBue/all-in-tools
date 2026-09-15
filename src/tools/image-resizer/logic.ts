export const RESIZE_MODES = ['dimensions', 'percent', 'longest'] as const;
export type ResizeMode = (typeof RESIZE_MODES)[number];

export const OUTPUT_FORMATS = ['keep', 'jpeg', 'png', 'webp'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const MIME_TYPES: Readonly<Record<Exclude<OutputFormat, 'keep'>, string>> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

export const EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export const ACCEPTED_TYPES = Object.keys(EXTENSIONS);

/** Per file. Bigger than this and decoding it is the slow part, not resizing. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 30;
export const MAX_DIMENSION = 10_000;

export const DEFAULT_QUALITY = 0.82;
export const MIN_QUALITY = 0.3;
export const MAX_QUALITY = 1;
export const DEFAULT_PERCENT = 50;
export const DEFAULT_LONGEST = 1_600;

const PERCENT = 100;

export interface Size {
  width: number;
  height: number;
}

export interface ResizeOptions {
  mode: ResizeMode;
  width: number;
  height: number;
  percent: number;
  longest: number;
  lockAspect: boolean;
}

export const DEFAULT_OPTIONS: ResizeOptions = {
  mode: 'longest',
  width: 1_200,
  height: 1_200,
  percent: DEFAULT_PERCENT,
  longest: DEFAULT_LONGEST,
  lockAspect: true,
};

function clampSize(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1;
  return Math.min(MAX_DIMENSION, Math.round(value));
}

/**
 * Never enlarges: asking for a 4000px longest side from a 800px photo would
 * give a blurry 4000px photo, which is worse than the one that came in.
 */
export function targetSize(source: Size, options: ResizeOptions): Size {
  if (source.width <= 0 || source.height <= 0) return { width: 1, height: 1 };

  if (options.mode === 'percent') {
    const scale = Math.min(PERCENT, Math.max(1, options.percent)) / PERCENT;
    return {
      width: clampSize(source.width * scale),
      height: clampSize(source.height * scale),
    };
  }

  if (options.mode === 'longest') {
    const longest = Math.max(source.width, source.height);
    const wanted = Math.min(clampSize(options.longest), longest);
    const scale = wanted / longest;

    return {
      width: clampSize(source.width * scale),
      height: clampSize(source.height * scale),
    };
  }

  const width = Math.min(clampSize(options.width), source.width);
  const height = Math.min(clampSize(options.height), source.height);

  if (!options.lockAspect) return { width, height };

  // Fit inside the box rather than stretching to fill it.
  const scale = Math.min(width / source.width, height / source.height, 1);
  return {
    width: clampSize(source.width * scale),
    height: clampSize(source.height * scale),
  };
}

export function outputMime(format: OutputFormat, sourceType: string): string {
  if (format === 'keep') {
    return sourceType in EXTENSIONS ? sourceType : MIME_TYPES.jpeg;
  }

  return MIME_TYPES[format];
}

export function extensionFor(mime: string): string {
  return EXTENSIONS[mime] ?? 'img';
}

export function outputName(originalName: string, mime: string): string {
  const dot = originalName.lastIndexOf('.');
  const base = dot === -1 ? originalName : originalName.slice(0, dot);

  return `${base || 'image'}.${extensionFor(mime)}`;
}

/** Two files of the same name in one zip: the second becomes name-2.jpg. */
export function uniqueNames(names: string[]): string[] {
  const seen = new Map<string, number>();

  return names.map((name) => {
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    if (count === 0) return name;

    const dot = name.lastIndexOf('.');
    const base = dot === -1 ? name : name.slice(0, dot);
    const extension = dot === -1 ? '' : name.slice(dot);

    return `${base}-${count + 1}${extension}`;
  });
}

export function savedPercent(before: number, after: number): number {
  if (before <= 0) return 0;
  return Math.max(0, Math.round((1 - after / before) * PERCENT));
}

export function isAcceptedType(type: string): boolean {
  return type in EXTENSIONS;
}

export function clampQuality(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_QUALITY;
  return Math.min(MAX_QUALITY, Math.max(MIN_QUALITY, value));
}

export type RejectionReason = 'type' | 'size' | 'count';

export interface FileCheck {
  accepted: File[];
  rejected: Array<{ name: string; reason: RejectionReason }>;
}

export function checkFiles(files: File[], alreadyHave: number): FileCheck {
  const accepted: File[] = [];
  const rejected: FileCheck['rejected'] = [];

  for (const file of files) {
    if (!isAcceptedType(file.type)) {
      rejected.push({ name: file.name, reason: 'type' });
      continue;
    }
    if (file.size > MAX_FILE_BYTES) {
      rejected.push({ name: file.name, reason: 'size' });
      continue;
    }
    if (alreadyHave + accepted.length >= MAX_FILES) {
      rejected.push({ name: file.name, reason: 'count' });
      continue;
    }

    accepted.push(file);
  }

  return { accepted, rejected };
}
