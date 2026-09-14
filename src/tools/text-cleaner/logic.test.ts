import { describe, expect, it } from 'vitest';

import {
  DEFAULT_RULES,
  RULE_IDS,
  cleanText,
  hasThaiCombining,
  isRuleId,
  resolveExclusive,
  type RuleId,
} from '@/tools/text-cleaner/logic';

const ZWSP = '​';
const ZWNJ = '‌';
const ZWJ = '‍';
const BOM = '﻿';

function clean(text: string, rules: RuleId[]): string {
  return cleanText(text, rules).text;
}

function countFor(text: string, rule: RuleId): number {
  return cleanText(text, [rule]).changes[0]?.count ?? 0;
}

describe('newlines', () => {
  it('turns windows and old mac line endings into plain ones', () => {
    expect(clean('a\r\nb\rc', ['normalize-newlines'])).toBe('a\nb\nc');
  });

  it('counts each ending it replaced', () => {
    expect(countFor('a\r\nb\r\nc', 'normalize-newlines')).toBe(2);
  });

  it('leaves text that is already clean alone', () => {
    expect(countFor('a\nb', 'normalize-newlines')).toBe(0);
  });
});

describe('zero-width characters', () => {
  it('removes the ones that get pasted in invisibly', () => {
    expect(clean(`ก${ZWSP}ข${ZWNJ}ค${ZWJ}ง${BOM}`, ['zero-width'])).toBe('กขคง');
  });

  it('counts every one it removed', () => {
    expect(countFor(`a${ZWSP}${ZWSP}b`, 'zero-width')).toBe(2);
  });

  it('leaves ordinary Thai untouched', () => {
    expect(countFor('สวัสดีครับ', 'zero-width')).toBe(0);
  });
});

describe('Thai mark spacing', () => {
  it('removes a space that split a character from its mark', () => {
    expect(clean('ก ่อน', ['thai-mark-spacing'])).toBe('ก่อน');
    expect(clean('สวั สดี', ['thai-mark-spacing'])).toBe('สวั สดี');
  });

  it('joins a vowel that drifted off its consonant', () => {
    expect(clean('ท ี่', ['thai-mark-spacing'])).toBe('ที่');
  });

  it('leaves a legitimate space between Thai words', () => {
    const text = 'สวัสดี ครับ';
    expect(clean(text, ['thai-mark-spacing'])).toBe(text);
  });

  it('leaves English spacing alone', () => {
    expect(clean('hello world', ['thai-mark-spacing'])).toBe('hello world');
  });
});

describe('repeated Thai marks', () => {
  it('collapses a tone mark typed twice', () => {
    expect(clean('ก่่อน', ['thai-repeated-marks'])).toBe('ก่อน');
  });

  it('collapses a repeated vowel', () => {
    expect(clean('สวัั สดี', ['thai-repeated-marks'])).toBe('สวั สดี');
  });

  it('leaves two different marks in sequence alone', () => {
    const text = 'ที่';
    expect(clean(text, ['thai-repeated-marks'])).toBe(text);
  });
});

describe('whitespace', () => {
  it('trims each line without touching the line breaks', () => {
    expect(clean('  a  \n  b  ', ['trim-lines'])).toBe('a\nb');
  });

  it('collapses runs of spaces', () => {
    expect(clean('a    b', ['collapse-spaces'])).toBe('a b');
  });

  it('leaves a single space alone', () => {
    expect(countFor('a b', 'collapse-spaces')).toBe(0);
  });

  it('collapses three or more blank lines into one', () => {
    expect(clean('a\n\n\n\n\nb', ['collapse-blank-lines'])).toBe('a\n\nb');
  });

  it('keeps a single blank line as a paragraph break', () => {
    expect(clean('a\n\nb', ['collapse-blank-lines'])).toBe('a\n\nb');
  });

  it('trims blank lines from both ends of the document', () => {
    expect(clean('\n\n  a\nb  \n\n', ['trim-document'])).toBe('a\nb');
  });
});

describe('digits', () => {
  it('converts Thai digits to arabic', () => {
    expect(clean('ปี ๒๕๖๘', ['digits-to-arabic'])).toBe('ปี 2568');
  });

  it('converts arabic digits to Thai', () => {
    expect(clean('ปี 2568', ['digits-to-thai'])).toBe('ปี ๒๕๖๘');
  });

  it('counts each digit it converted', () => {
    expect(countFor('๐๑๒', 'digits-to-arabic')).toBe(3);
    expect(countFor('123', 'digits-to-thai')).toBe(3);
  });

  it('round-trips', () => {
    const thai = '๐๑๒๓๔๕๖๗๘๙';
    expect(clean(clean(thai, ['digits-to-arabic']), ['digits-to-thai'])).toBe(thai);
  });

  it('leaves the other script alone', () => {
    expect(countFor('123', 'digits-to-arabic')).toBe(0);
    expect(countFor('๑๒๓', 'digits-to-thai')).toBe(0);
  });
});

describe('smart punctuation', () => {
  it('replaces curly quotes and dashes', () => {
    expect(clean('“a” ‘b’ – c — d…', ['smart-punctuation'])).toBe(
      '"a" \'b\' - c - d...',
    );
  });

  it('counts every replacement', () => {
    expect(countFor('“a”', 'smart-punctuation')).toBe(2);
  });

  it('leaves plain punctuation alone', () => {
    expect(countFor('"a" - b', 'smart-punctuation')).toBe(0);
  });
});

describe('unicode normalization', () => {
  // Written as escapes on purpose: a literal decomposed character in this file
  // would be composed by any editor that saves as NFC, and the test would then
  // pass without exercising anything.
  const DECOMPOSED = 'é';
  const COMPOSED = 'é';

  it('composes a decomposed character', () => {
    expect(DECOMPOSED).not.toBe(COMPOSED);
    expect(clean(DECOMPOSED, ['normalize-unicode'])).toBe(COMPOSED);
  });

  it('counts nothing when the text is already composed', () => {
    expect(countFor(COMPOSED, 'normalize-unicode')).toBe(0);
  });

  it('counts the characters it composed', () => {
    expect(countFor(DECOMPOSED + DECOMPOSED, 'normalize-unicode')).toBe(2);
  });

  it('leaves Thai alone, which is already composed', () => {
    expect(countFor('สวัสดี', 'normalize-unicode')).toBe(0);
  });
});

describe('running several rules', () => {
  it('applies them in a fixed order regardless of how they were listed', () => {
    const messy = '  a\r\n\r\n\r\n\r\n  b  ';
    const forwards = clean(messy, [...DEFAULT_RULES]);
    const backwards = clean(messy, [...DEFAULT_RULES].reverse());

    expect(forwards).toBe(backwards);
  });

  it('reports a count for every enabled rule, including zero', () => {
    const result = cleanText('clean', ['zero-width', 'collapse-spaces']);

    expect(result.changes).toEqual([
      { id: 'zero-width', count: 0 },
      { id: 'collapse-spaces', count: 0 },
    ]);
    expect(result.totalChanges).toBe(0);
  });

  it('does nothing at all when no rule is enabled', () => {
    const messy = '  a  \r\n\r\n\r\n  b  ';
    const result = cleanText(messy, []);

    expect(result.text).toBe(messy);
    expect(result.changes).toEqual([]);
  });

  it('measures before and after', () => {
    const result = cleanText('  a  \n\n\n\n  b  ', [...DEFAULT_RULES]);

    expect(result.before.characters).toBeGreaterThan(result.after.characters);
    expect(result.after.lines).toBeLessThan(result.before.lines);
  });

  it('counts characters by code point, not by UTF-16 unit', () => {
    expect(cleanText('🙂', []).before.characters).toBe(1);
  });

  it('handles an empty input', () => {
    const result = cleanText('', [...DEFAULT_RULES]);

    expect(result.text).toBe('');
    expect(result.totalChanges).toBe(0);
    expect(result.before.lines).toBe(0);
  });

  it('cleans a realistic messy Thai paste', () => {
    const messy = `﻿  ท ี่นี่${ZWSP}ครับ   \r\n\r\n\r\n\r\n  ปี ๒๕๖๘  `;
    const result = cleanText(messy, [...DEFAULT_RULES, 'digits-to-arabic']);

    expect(result.text).toBe('ที่นี่ครับ\n\nปี 2568');
    expect(result.totalChanges).toBeGreaterThan(0);
  });

  // The rule only joins a mark back to its letter. A space between two Thai
  // letters stays, because Thai uses spaces between phrases and telling the two
  // apart needs a dictionary.
  it('leaves a stray space between Thai letters where it is', () => {
    expect(cleanText('สวั สดี', [...DEFAULT_RULES]).text).toBe('สวั สดี');
  });
});

describe('mutually exclusive rules', () => {
  it('drops the opposite digit rule when one is turned on', () => {
    expect(resolveExclusive(['digits-to-thai', 'zero-width'], 'digits-to-arabic')).toEqual(
      ['zero-width'],
    );
  });

  it('leaves unrelated rules alone', () => {
    const enabled: RuleId[] = ['zero-width', 'trim-lines'];
    expect(resolveExclusive(enabled, 'collapse-spaces')).toEqual(enabled);
  });
});

describe('rule ids', () => {
  it('recognises only known ids', () => {
    for (const id of RULE_IDS) expect(isRuleId(id)).toBe(true);
    expect(isRuleId('made-up')).toBe(false);
  });

  it('defaults to rules that are safe on any text', () => {
    for (const id of DEFAULT_RULES) expect(RULE_IDS).toContain(id);
    expect(DEFAULT_RULES).not.toContain('digits-to-thai');
    expect(DEFAULT_RULES).not.toContain('smart-punctuation');
  });
});

describe('hasThaiCombining', () => {
  it('spots text that the Thai rules are relevant to', () => {
    expect(hasThaiCombining('สวัสดี')).toBe(true);
    expect(hasThaiCombining('hello')).toBe(false);
  });
});
