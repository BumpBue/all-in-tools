import { describe, expect, it } from 'vitest';

import { countWords } from '@/lib/text';

import {
  DEFAULT_OPTIONS,
  MAX_COUNTS,
  UNITS,
  buildSentence,
  clampCount,
  createPicker,
  createRandom,
  generate,
  generateParagraphs,
  trimToWords,
  type LoremOptions,
} from '@/tools/thai-lorem-ipsum/logic';
import { BANKS, MODES } from '@/tools/thai-lorem-ipsum/words';

const SEED = 20260914;

function options(overrides: Partial<LoremOptions> = {}): LoremOptions {
  return { ...DEFAULT_OPTIONS, seed: SEED, ...overrides };
}

const THAI_LETTER = /[฀-๿]/;

describe('createRandom', () => {
  it('repeats itself for the same seed', () => {
    const first = createRandom(SEED);
    const second = createRandom(SEED);

    expect(Array.from({ length: 10 }, first)).toEqual(
      Array.from({ length: 10 }, second),
    );
  });

  it('gives a different run for a different seed', () => {
    const first = Array.from({ length: 10 }, createRandom(1));
    const second = Array.from({ length: 10 }, createRandom(2));

    expect(first).not.toEqual(second);
  });

  it('stays inside zero and one', () => {
    const random = createRandom(SEED);
    for (let draw = 0; draw < 500; draw += 1) {
      const value = random();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not sit on one value', () => {
    const random = createRandom(SEED);
    const draws = new Set(Array.from({ length: 100 }, random));
    expect(draws.size).toBeGreaterThan(90);
  });

  it('uses crypto rather than Math.random when unseeded', () => {
    const draws = new Set(Array.from({ length: 50 }, createRandom(null)));
    expect(draws.size).toBeGreaterThan(40);
  });
});

describe('buildSentence', () => {
  it('reads as Thai rather than as a list of random words', () => {
    const sentence = buildSentence('general', createPicker(SEED), {
      thaiSpacing: true,
      allowConnective: false,
    });

    const bank = BANKS.general;
    expect(bank.subjects.some((word) => sentence.includes(word))).toBe(true);
    expect(bank.verbs.some((word) => sentence.includes(word))).toBe(true);
    expect(bank.objects.some((word) => sentence.includes(word))).toBe(true);
  });

  it('never opens with a connective when it is the first sentence', () => {
    for (let round = 0; round < 50; round += 1) {
      const sentence = buildSentence('general', createPicker(round), {
        thaiSpacing: true,
        allowConnective: false,
      });

      expect(
        BANKS.general.connectives.some((word) => sentence.startsWith(word)),
      ).toBe(false);
    }
  });

  it('runs the clauses together when Thai spacing is off', () => {
    const spaced = buildSentence('general', createPicker(SEED), {
      thaiSpacing: true,
      allowConnective: true,
    });
    const dense = buildSentence('general', createPicker(SEED), {
      thaiSpacing: false,
      allowConnective: true,
    });

    expect(dense.replace(/ /g, '')).toBe(spaced.replace(/ /g, ''));
    expect(dense.length).toBeLessThanOrEqual(spaced.length);
  });
});

describe('createPicker', () => {
  it('avoids answering with the same word twice in a row', () => {
    const list = ['ก', 'ข', 'ค', 'ง'];
    const picker = createPicker(SEED);
    const draws = Array.from({ length: 200 }, () => picker.choose(list));

    const repeats = draws.filter((value, index) => index > 0 && value === draws[index - 1]);
    expect(repeats.length).toBeLessThan(draws.length / 10);
  });

  it('can still answer from a list of one', () => {
    const picker = createPicker(SEED);
    expect(picker.choose(['เดียว'])).toBe('เดียว');
    expect(picker.choose(['เดียว'])).toBe('เดียว');
  });
});

describe('generate', () => {
  it('produces the number of paragraphs asked for', () => {
    expect(generateParagraphs(options({ unit: 'paragraphs', count: 4 }))).toHaveLength(4);
  });

  it('produces the number of sentences asked for', () => {
    const text = generate(options({ unit: 'sentences', count: 5 }));
    expect(text.split(' ').length).toBeGreaterThanOrEqual(5);
  });

  it('produces exactly the number of words asked for', () => {
    for (const count of [10, 25, 60]) {
      const text = generate(options({ unit: 'words', count }));
      expect(countWords(text)).toBe(count);
    }
  });

  it('gives the same text twice for the same seed', () => {
    expect(generate(options())).toBe(generate(options()));
  });

  it('gives different text for a different seed', () => {
    expect(generate(options({ seed: 1 }))).not.toBe(generate(options({ seed: 2 })));
  });

  it('starts with the standard phrase only when asked', () => {
    const withOpening = generate(options({ standardOpening: true }));
    const without = generate(options({ standardOpening: false }));

    expect(withOpening.startsWith(BANKS.general.opening)).toBe(true);
    expect(without.startsWith(BANKS.general.opening)).toBe(false);
  });

  it('says in its own opening that it is only sample text', () => {
    for (const mode of MODES) {
      expect(BANKS[mode].opening).toContain('ตัวอย่าง');
    }
  });

  it('writes Thai in every mode', () => {
    for (const mode of MODES) {
      expect(generate(options({ mode }))).toMatch(THAI_LETTER);
    }
  });

  it('draws only on the bank of the mode asked for', () => {
    const text = generate(options({ mode: 'news', standardOpening: false, count: 3 }));
    const newsWords = [...BANKS.news.subjects, ...BANKS.news.objects];
    const productWords = [...BANKS.product.subjects, ...BANKS.product.objects];

    expect(newsWords.some((word) => text.includes(word))).toBe(true);
    expect(productWords.some((word) => text.includes(word))).toBe(false);
  });

  it('adds a full stop only when asked', () => {
    expect(generate(options({ punctuation: false }))).not.toContain('.');
    expect(generate(options({ punctuation: true }))).toContain('.');
  });

  it('separates paragraphs with a blank line', () => {
    expect(generate(options({ unit: 'paragraphs', count: 2 }))).toContain('\n\n');
  });

  it('wraps each paragraph in a p element for HTML', () => {
    const html = generate(options({ unit: 'paragraphs', count: 2, format: 'html' }));

    expect(html.match(/<p>/g)).toHaveLength(2);
    expect(html).not.toContain('\n\n');
  });

  it('escapes anything that would break the HTML it writes', () => {
    // The bank holds no angle brackets today; the escape has to hold anyway.
    const html = generate(options({ format: 'html' }));
    expect(html.replace(/<\/?p>/g, '')).not.toContain('<');
  });
});

describe('counting', () => {
  it('counts Thai words rather than space-separated runs', () => {
    expect(countWords('ฉันกินข้าว')).toBeGreaterThan(1);
    expect(countWords('')).toBe(0);
    expect(countWords('   ')).toBe(0);
  });

  it('cuts at a word boundary, not mid-word', () => {
    const text = 'ผู้ใช้งานส่วนใหญ่เลือกใช้เครื่องมือที่ใช้งานได้จริง';
    const trimmed = trimToWords(text, 3);

    expect(countWords(trimmed)).toBe(3);
    expect(text.startsWith(trimmed)).toBe(true);
  });

  it('asks for nothing and gets nothing', () => {
    expect(trimToWords('ทดสอบ', 0)).toBe('');
  });
});

describe('clampCount', () => {
  it('keeps a sensible count as it is', () => {
    expect(clampCount('paragraphs', 5)).toBe(5);
  });

  it('never goes below one', () => {
    expect(clampCount('words', 0)).toBe(1);
    expect(clampCount('words', -10)).toBe(1);
  });

  it('stops at the ceiling for each unit', () => {
    for (const unit of UNITS) {
      expect(clampCount(unit, MAX_COUNTS[unit] + 100)).toBe(MAX_COUNTS[unit]);
    }
  });

  it('falls back to the default for a value that is not a number', () => {
    expect(clampCount('paragraphs', Number.NaN)).toBe(3);
  });

  it('rounds a fraction down', () => {
    expect(clampCount('paragraphs', 4.9)).toBe(4);
  });
});
