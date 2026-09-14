const LATIN_WORD = /[A-Za-z0-9'’-]+/g;
const THAI_RUN = /[฀-๿]+/g;

export type SegmenterSupport = 'intl' | 'fallback';

export function hasSegmenter(): boolean {
  return typeof Intl !== 'undefined' && 'Segmenter' in Intl;
}

export function segmenterSupport(): SegmenterSupport {
  return hasSegmenter() ? 'intl' : 'fallback';
}

/**
 * Thai does not put spaces between words, so splitting on whitespace
 * undercounts it badly. Intl.Segmenter knows where the boundaries are; without
 * it the fallback treats each run of Thai letters as one word, which is wrong
 * but at least admits to being an estimate.
 *
 * Three tools count words, and they must all agree on what a word is.
 */
export function segmentWords(text: string): string[] {
  if (text.trim().length === 0) return [];

  if (hasSegmenter()) {
    return [...new Intl.Segmenter('th', { granularity: 'word' }).segment(text)]
      .filter((piece) => piece.isWordLike === true)
      .map((piece) => piece.segment);
  }

  return [...(text.match(THAI_RUN) ?? []), ...(text.match(LATIN_WORD) ?? [])];
}

export function countWords(text: string): number {
  return segmentWords(text).length;
}

/** Graphemes, not code points: a Thai tone mark belongs to the letter it sits on. */
export function segmentGraphemes(text: string): string[] {
  if (text.length === 0) return [];

  if (hasSegmenter()) {
    return [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text)].map(
      (piece) => piece.segment,
    );
  }

  return [...text];
}
