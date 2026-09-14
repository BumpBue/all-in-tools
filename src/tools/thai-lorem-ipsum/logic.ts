import { createRandom, intBetween, pickFrom } from '@/lib/random';
import { countWords, hasSegmenter } from '@/lib/text';
import { BANKS, type LoremMode } from '@/tools/thai-lorem-ipsum/words';

export const UNITS = ['words', 'sentences', 'paragraphs'] as const;
export type LoremUnit = (typeof UNITS)[number];

export const FORMATS = ['text', 'html'] as const;
export type LoremFormat = (typeof FORMATS)[number];

export const MAX_COUNTS: Readonly<Record<LoremUnit, number>> = {
  words: 2_000,
  sentences: 200,
  paragraphs: 50,
};

export const DEFAULT_COUNTS: Readonly<Record<LoremUnit, number>> = {
  words: 60,
  sentences: 5,
  paragraphs: 3,
};

const SENTENCES_PER_PARAGRAPH_MIN = 3;
const SENTENCES_PER_PARAGRAPH_MAX = 6;
const CONNECTIVE_CHANCE = 0.35;
const ADVERBIAL_CHANCE = 0.5;

const SENTENCE_SEPARATOR = ' ';
const PARAGRAPH_SEPARATOR = '\n\n';
const FULL_STOP = '.';

export interface LoremOptions {
  mode: LoremMode;
  unit: LoremUnit;
  count: number;
  standardOpening: boolean;
  thaiSpacing: boolean;
  punctuation: boolean;
  format: LoremFormat;
  /** null means take randomness from crypto; a number makes the text repeatable. */
  seed: number | null;
}

export const DEFAULT_OPTIONS: LoremOptions = {
  mode: 'general',
  unit: 'paragraphs',
  count: DEFAULT_COUNTS.paragraphs,
  standardOpening: true,
  thaiSpacing: true,
  punctuation: false,
  format: 'text',
  seed: null,
};

export interface Picker {
  random: () => number;
  choose: (list: readonly string[]) => string;
}

/**
 * Draws from a list without repeating its last answer where it can. Two
 * sentences in a row about the same subject read as a bug rather than as
 * filler, and one retry is enough to make that rare.
 */
export function createPicker(seed: number | null): Picker {
  const random = createRandom(seed);
  const last = new Map<readonly string[], string>();

  return {
    random,
    choose: (list) => {
      let value = pickFrom(list, random);
      if (list.length > 1 && last.get(list) === value) value = pickFrom(list, random);
      last.set(list, value);
      return value;
    },
  };
}

export function buildSentence(
  mode: LoremMode,
  picker: Picker,
  options: { thaiSpacing: boolean; allowConnective: boolean },
): string {
  const bank = BANKS[mode];
  const gap = options.thaiSpacing ? ' ' : '';

  const parts: string[] = [];

  if (options.allowConnective && picker.random() < CONNECTIVE_CHANCE) {
    parts.push(`${picker.choose(bank.connectives)}${options.thaiSpacing ? ' ' : ''}`);
  }

  parts.push(picker.choose(bank.subjects));
  parts.push(picker.choose(bank.verbs));
  parts.push(picker.choose(bank.objects));

  if (picker.random() < ADVERBIAL_CHANCE) {
    parts.push(`${gap}${picker.choose(bank.adverbials)}`);
  }

  return parts.join('');
}

export function buildParagraph(
  mode: LoremMode,
  picker: Picker,
  options: { thaiSpacing: boolean; punctuation: boolean; opening: string | null },
  sentenceCount: number,
): string {
  const sentences: string[] = [];

  if (options.opening !== null) sentences.push(options.opening);

  while (sentences.length < sentenceCount) {
    sentences.push(
      buildSentence(mode, picker, {
        thaiSpacing: options.thaiSpacing,
        allowConnective: sentences.length > 0,
      }),
    );
  }

  const ending = options.punctuation ? FULL_STOP : '';
  return sentences.map((sentence) => `${sentence}${ending}`).join(SENTENCE_SEPARATOR);
}

/** Cuts the text after the nth word, leaving whole words behind. */
export function trimToWords(text: string, wanted: number): string {
  if (wanted <= 0) return '';
  if (!hasSegmenter()) {
    return text.split(/\s+/).slice(0, wanted).join(' ');
  }

  let seen = 0;
  let end = text.length;

  for (const piece of new Intl.Segmenter('th', { granularity: 'word' }).segment(text)) {
    if (piece.isWordLike !== true) continue;

    seen += 1;
    if (seen === wanted) {
      end = piece.index + piece.segment.length;
      break;
    }
  }

  return text.slice(0, end).trimEnd();
}

export function clampCount(unit: LoremUnit, count: number): number {
  if (!Number.isFinite(count)) return DEFAULT_COUNTS[unit];
  return Math.min(MAX_COUNTS[unit], Math.max(1, Math.floor(count)));
}

export function generateParagraphs(options: LoremOptions): string[] {
  const picker = createPicker(options.seed);
  const { random } = picker;
  const count = clampCount(options.unit, options.count);
  const opening = options.standardOpening ? BANKS[options.mode].opening : null;

  const paragraph = (index: number, sentenceCount: number) =>
    buildParagraph(
      options.mode,
      picker,
      {
        thaiSpacing: options.thaiSpacing,
        punctuation: options.punctuation,
        opening: index === 0 ? opening : null,
      },
      sentenceCount,
    );

  if (options.unit === 'paragraphs') {
    return Array.from({ length: count }, (_, index) =>
      paragraph(
        index,
        intBetween(SENTENCES_PER_PARAGRAPH_MIN, SENTENCES_PER_PARAGRAPH_MAX, random),
      ),
    );
  }

  if (options.unit === 'sentences') return [paragraph(0, count)];

  // Words: keep adding paragraphs until there are enough, then cut.
  const paragraphs: string[] = [];
  let index = 0;

  while (countWords(paragraphs.join(PARAGRAPH_SEPARATOR)) < count) {
    paragraphs.push(
      paragraph(
        index,
        intBetween(SENTENCES_PER_PARAGRAPH_MIN, SENTENCES_PER_PARAGRAPH_MAX, random),
      ),
    );
    index += 1;
  }

  const trimmed = trimToWords(paragraphs.join(PARAGRAPH_SEPARATOR), count);
  return trimmed.split(PARAGRAPH_SEPARATOR);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function generate(options: LoremOptions): string {
  const paragraphs = generateParagraphs(options);

  if (options.format === 'html') {
    return paragraphs
      .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
      .join('\n');
  }

  return paragraphs.join(PARAGRAPH_SEPARATOR);
}
