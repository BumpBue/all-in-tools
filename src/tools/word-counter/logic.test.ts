import { describe, expect, it } from 'vitest';

import {
  LATIN_READING_WPM,
  MAX_WPM,
  MIN_WPM,
  TOP_WORD_COUNT,
  clampWpm,
  countText,
  estimateTime,
  segmentWords,
  segmenterSupport,
  targetDifference,
  wordFrequency,
} from '@/tools/word-counter/logic';

const THAI = 'สวัสดีครับ ผมกำลังทดสอบเครื่องมือนับคำภาษาไทย';
const ENGLISH = 'The quick brown fox jumps over the lazy dog.';

describe('segmenter availability', () => {
  it('reports which method is in use', () => {
    expect(['intl', 'fallback']).toContain(segmenterSupport());
  });
});

describe('segmentWords', () => {
  it('splits English on word boundaries', () => {
    expect(segmentWords('hello world')).toEqual(['hello', 'world']);
  });

  it('finds more than one word in Thai with no spaces', () => {
    // Whitespace splitting would call this one word.
    expect(segmentWords('สวัสดีครับ').length).toBeGreaterThan(1);
  });

  it('handles a mix of scripts', () => {
    const words = segmentWords('ทดสอบ test 123');
    expect(words.some((word) => /[฀-๿]/.test(word))).toBe(true);
    expect(words).toContain('test');
    expect(words).toContain('123');
  });

  it('returns nothing for empty or blank text', () => {
    expect(segmentWords('')).toEqual([]);
    expect(segmentWords('   \n ')).toEqual([]);
  });

  it('leaves punctuation out of the word list', () => {
    expect(segmentWords('hi, there!')).toEqual(['hi', 'there']);
  });
});

describe('countText', () => {
  it('counts characters with and without spaces', () => {
    const counts = countText('a b c');
    expect(counts.characters).toBe(5);
    expect(counts.charactersNoSpaces).toBe(3);
  });

  it('counts characters by code point', () => {
    expect(countText('🙂').characters).toBe(1);
  });

  it('separates Thai, Latin and numeric words', () => {
    const counts = countText('ทดสอบ hello 42');
    expect(counts.thaiWords).toBeGreaterThan(0);
    expect(counts.latinWords).toBe(1);
    expect(counts.numbers).toBe(1);
  });

  it('counts sentences on terminators', () => {
    expect(countText('One. Two! Three?').sentences).toBe(3);
  });

  it('counts a Thai paiyannoi as a sentence end', () => {
    expect(countText('อย่างนี้ฯ แบบนั้น.').sentences).toBe(2);
  });

  it('counts paragraphs on blank lines', () => {
    expect(countText('one\n\ntwo\n\n\nthree').paragraphs).toBe(3);
  });

  it('counts lines including single breaks', () => {
    expect(countText('a\nb\nc').lines).toBe(3);
  });

  it('is all zero for empty text', () => {
    expect(countText('')).toMatchObject({
      characters: 0,
      words: 0,
      sentences: 0,
      paragraphs: 0,
      lines: 0,
    });
  });

  it('counts a real Thai sentence as several words', () => {
    expect(countText(THAI).words).toBeGreaterThan(5);
  });

  it('counts the English pangram as nine words', () => {
    expect(countText(ENGLISH).words).toBe(9);
  });
});

describe('wordFrequency', () => {
  it('ranks by count', () => {
    const top = wordFrequency('a a a b b c', false);
    expect(top.slice(0, 3)).toEqual([
      { word: 'a', count: 3 },
      { word: 'b', count: 2 },
      { word: 'c', count: 1 },
    ]);
  });

  it('is case insensitive', () => {
    expect(wordFrequency('The the THE', false)[0]).toEqual({ word: 'the', count: 3 });
  });

  it('drops English stop words when asked', () => {
    const words = wordFrequency(ENGLISH, true).map((entry) => entry.word);
    expect(words).not.toContain('the');
    expect(words).toContain('fox');
  });

  it('drops Thai stop words when asked', () => {
    const words = wordFrequency('การ การ ทดสอบ ทดสอบ ทดสอบ', true).map((e) => e.word);
    expect(words).not.toContain('การ');
    expect(words).toContain('ทดสอบ');
  });

  it('keeps stop words when not asked', () => {
    expect(wordFrequency(ENGLISH, false).map((e) => e.word)).toContain('the');
  });

  it('stops at the requested limit', () => {
    const text = Array.from({ length: 40 }, (_, index) => `word${index}`).join(' ');
    expect(wordFrequency(text, false)).toHaveLength(TOP_WORD_COUNT);
    expect(wordFrequency(text, false, 5)).toHaveLength(5);
  });

  it('breaks ties in a stable order', () => {
    const first = wordFrequency('beta alpha', false);
    const second = wordFrequency('alpha beta', false);
    expect(first).toEqual(second);
  });

  it('returns nothing for empty text', () => {
    expect(wordFrequency('', false)).toEqual([]);
  });
});

describe('estimateTime', () => {
  it('scales with the word count', () => {
    expect(estimateTime(230, 230, 150).readingSeconds).toBe(60);
    expect(estimateTime(460, 230, 150).readingSeconds).toBe(120);
  });

  it('makes speaking slower than reading at the defaults', () => {
    const time = estimateTime(1000, 230, 150);
    expect(time.speakingSeconds).toBeGreaterThan(time.readingSeconds);
  });

  it('is zero for no words', () => {
    expect(estimateTime(0, 230, 150)).toEqual({
      readingSeconds: 0,
      speakingSeconds: 0,
    });
  });
});

describe('clampWpm', () => {
  it('keeps the value inside a usable range', () => {
    expect(clampWpm(0)).toBe(MIN_WPM);
    expect(clampWpm(10_000)).toBe(MAX_WPM);
    expect(clampWpm(Number.NaN)).toBe(LATIN_READING_WPM);
    expect(clampWpm(200.6)).toBe(201);
  });
});

describe('targetDifference', () => {
  it('is positive when over and negative when short', () => {
    expect(targetDifference(120, 100)).toBe(20);
    expect(targetDifference(80, 100)).toBe(-20);
    expect(targetDifference(100, 100)).toBe(0);
  });
});
