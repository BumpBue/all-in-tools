export const THAI_READING_WPM = 180;
export const LATIN_READING_WPM = 230;
export const THAI_SPEAKING_WPM = 130;
export const LATIN_SPEAKING_WPM = 150;

export const MIN_WPM = 40;
export const MAX_WPM = 600;
export const TOP_WORD_COUNT = 20;

const THAI_LETTER = /[฀-๿]/;
const LATIN_LETTER = /[A-Za-z]/;
const DIGIT = /[0-9๐-๙]/;
const LATIN_WORD = /[A-Za-z0-9'’-]+/g;
const SENTENCE_END = /[.!?。！？ฯ]+|\n{2,}/;
const PARAGRAPH_BREAK = /\n\s*\n/;
const WHITESPACE = /\s/g;

/** Common words that say nothing about what a text is about. */
export const THAI_STOP_WORDS = new Set([
  'ที่', 'และ', 'ของ', 'ใน', 'การ', 'มี', 'ได้', 'ให้', 'ไม่', 'เป็น',
  'จะ', 'ก็', 'กับ', 'ว่า', 'นี้', 'นั้น', 'จาก', 'แต่', 'หรือ', 'ความ',
  'ไป', 'มา', 'อยู่', 'ด้วย', 'ๆ', 'คือ', 'ถ้า', 'เพราะ', 'แล้ว', 'ต้อง',
]);

export const LATIN_STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in',
  'on', 'at', 'by', 'for', 'with', 'is', 'are', 'was', 'were', 'be',
  'been', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'from', 'we',
  'you', 'they', 'he', 'she', 'i', 'not', 'no', 'do', 'does', 'did',
]);

export type SegmenterSupport = 'intl' | 'fallback';

export interface WordCounts {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  thaiWords: number;
  latinWords: number;
  numbers: number;
  sentences: number;
  paragraphs: number;
  lines: number;
}

export interface WordFrequency {
  word: string;
  count: number;
}

export interface ReadingTime {
  readingSeconds: number;
  speakingSeconds: number;
}

function hasIntlSegmenter(): boolean {
  return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
}

export function segmenterSupport(): SegmenterSupport {
  return hasIntlSegmenter() ? 'intl' : 'fallback';
}

/**
 * Thai does not put spaces between words, so splitting on whitespace
 * undercounts it badly. Intl.Segmenter knows where the boundaries are; without
 * it the fallback treats each run of Thai letters as one word, which is wrong
 * but at least admits to being an estimate.
 */
export function segmentWords(text: string): string[] {
  if (text.trim().length === 0) return [];

  if (hasIntlSegmenter()) {
    const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
    return [...segmenter.segment(text)]
      .filter((piece) => piece.isWordLike === true)
      .map((piece) => piece.segment);
  }

  const thaiRuns = text.match(/[฀-๿]+/g) ?? [];
  const latinRuns = text.match(LATIN_WORD) ?? [];
  return [...thaiRuns, ...latinRuns];
}

function classify(word: string): 'thai' | 'latin' | 'number' | 'other' {
  if (THAI_LETTER.test(word)) return 'thai';
  if (LATIN_LETTER.test(word)) return 'latin';
  if (DIGIT.test(word)) return 'number';
  return 'other';
}

export function countText(text: string): WordCounts {
  const words = segmentWords(text);

  let thaiWords = 0;
  let latinWords = 0;
  let numbers = 0;

  for (const word of words) {
    const kind = classify(word);
    if (kind === 'thai') thaiWords += 1;
    else if (kind === 'latin') latinWords += 1;
    else if (kind === 'number') numbers += 1;
  }

  const trimmed = text.trim();

  return {
    characters: [...text].length,
    charactersNoSpaces: [...text.replace(WHITESPACE, '')].length,
    words: words.length,
    thaiWords,
    latinWords,
    numbers,
    sentences:
      trimmed.length === 0
        ? 0
        : trimmed.split(SENTENCE_END).filter((part) => part.trim().length > 0).length,
    paragraphs:
      trimmed.length === 0
        ? 0
        : trimmed.split(PARAGRAPH_BREAK).filter((part) => part.trim().length > 0).length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
  };
}

export function wordFrequency(
  text: string,
  removeStopWords: boolean,
  limit: number = TOP_WORD_COUNT,
): WordFrequency[] {
  const counts = new Map<string, number>();

  for (const raw of segmentWords(text)) {
    const word = raw.trim().toLowerCase();
    if (word.length === 0) continue;
    if (classify(word) === 'other') continue;
    if (removeStopWords && (THAI_STOP_WORDS.has(word) || LATIN_STOP_WORDS.has(word))) {
      continue;
    }
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .slice(0, limit);
}

const SECONDS_PER_MINUTE = 60;

export function estimateTime(
  words: number,
  readingWpm: number,
  speakingWpm: number,
): ReadingTime {
  return {
    readingSeconds: Math.round((words / readingWpm) * SECONDS_PER_MINUTE),
    speakingSeconds: Math.round((words / speakingWpm) * SECONDS_PER_MINUTE),
  };
}

export function clampWpm(value: number): number {
  if (!Number.isFinite(value)) return LATIN_READING_WPM;
  return Math.min(Math.max(Math.round(value), MIN_WPM), MAX_WPM);
}

/** Positive when over the target, negative when short of it. */
export function targetDifference(words: number, target: number): number {
  return words - target;
}
