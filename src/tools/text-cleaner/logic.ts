export const RULE_IDS = [
  'normalize-newlines',
  'normalize-unicode',
  'zero-width',
  'thai-mark-spacing',
  'thai-repeated-marks',
  'trim-lines',
  'collapse-spaces',
  'collapse-blank-lines',
  'trim-document',
  'smart-punctuation',
  'digits-to-arabic',
  'digits-to-thai',
] as const;

export type RuleId = (typeof RULE_IDS)[number];

/** Turning one on turns the other off; together they would fight. */
export const EXCLUSIVE_PAIRS: ReadonlyArray<readonly [RuleId, RuleId]> = [
  ['digits-to-arabic', 'digits-to-thai'],
];

export const DEFAULT_RULES: readonly RuleId[] = [
  'normalize-newlines',
  'normalize-unicode',
  'zero-width',
  'thai-mark-spacing',
  'trim-lines',
  'collapse-spaces',
  'collapse-blank-lines',
  'trim-document',
];

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';
const ARABIC_DIGITS = '0123456789';

/** Thai vowels above/below and tone marks: they attach to the previous letter. */
const THAI_COMBINING = 'ัิ-ฺ็-๎';
const THAI_COMBINING_CLASS = new RegExp(`[${THAI_COMBINING}]`);

const ZERO_WIDTH = /[​‌‍﻿]/g;
const LINE_EDGE_SPACE = /^[ \t]+|[ \t]+$/gm;
const REPEATED_SPACE = / {2,}/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;
const DOCUMENT_EDGE = /^\s+|\s+$/g;
const WINDOWS_NEWLINE = /\r\n?/g;
const SPACE_BEFORE_THAI_MARK = new RegExp(`[ \\t]+(?=[${THAI_COMBINING}])`, 'g');
const REPEATED_THAI_MARK = new RegExp(`([${THAI_COMBINING}])\\1+`, 'g');

const SMART_PUNCTUATION: ReadonlyArray<readonly [RegExp, string]> = [
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  [/[–—]/g, '-'],
  [/…/g, '...'],
];

export interface Rule {
  id: RuleId;
  apply: (text: string) => string;
  count: (text: string) => number;
}

function countMatches(text: string, pattern: RegExp): number {
  return text.match(new RegExp(pattern.source, pattern.flags))?.length ?? 0;
}

function replaceRule(id: RuleId, pattern: RegExp, replacement: string): Rule {
  return {
    id,
    apply: (text) => text.replace(new RegExp(pattern.source, pattern.flags), replacement),
    count: (text) => countMatches(text, pattern),
  };
}

function translateDigits(text: string, from: string, to: string): string {
  return [...text]
    .map((character) => {
      const index = from.indexOf(character);
      return index === -1 ? character : to[index];
    })
    .join('');
}

function countDigits(text: string, digits: string): number {
  return [...text].filter((character) => digits.includes(character)).length;
}

const RULES: Rule[] = [
  replaceRule('normalize-newlines', WINDOWS_NEWLINE, '\n'),
  {
    id: 'normalize-unicode',
    apply: (text) => text.normalize('NFC'),
    // Composing usually shortens the text; when it does not, report a single
    // change rather than claiming none.
    count: (text) => {
      const normalized = text.normalize('NFC');
      if (normalized === text) return 0;
      return Math.max(text.length - normalized.length, 1);
    },
  },
  replaceRule('zero-width', ZERO_WIDTH, ''),
  replaceRule('thai-mark-spacing', SPACE_BEFORE_THAI_MARK, ''),
  replaceRule('thai-repeated-marks', REPEATED_THAI_MARK, '$1'),
  replaceRule('trim-lines', LINE_EDGE_SPACE, ''),
  replaceRule('collapse-spaces', REPEATED_SPACE, ' '),
  replaceRule('collapse-blank-lines', EXTRA_BLANK_LINES, '\n\n'),
  replaceRule('trim-document', DOCUMENT_EDGE, ''),
  {
    id: 'smart-punctuation',
    apply: (text) =>
      SMART_PUNCTUATION.reduce(
        (current, [pattern, replacement]) =>
          current.replace(new RegExp(pattern.source, pattern.flags), replacement),
        text,
      ),
    count: (text) =>
      SMART_PUNCTUATION.reduce(
        (total, [pattern]) => total + countMatches(text, pattern),
        0,
      ),
  },
  {
    id: 'digits-to-arabic',
    apply: (text) => translateDigits(text, THAI_DIGITS, ARABIC_DIGITS),
    count: (text) => countDigits(text, THAI_DIGITS),
  },
  {
    id: 'digits-to-thai',
    apply: (text) => translateDigits(text, ARABIC_DIGITS, THAI_DIGITS),
    count: (text) => countDigits(text, ARABIC_DIGITS),
  },
];

export interface CleanStats {
  characters: number;
  lines: number;
}

export interface CleanResult {
  text: string;
  /** How many places each enabled rule changed, in the order they ran. */
  changes: Array<{ id: RuleId; count: number }>;
  totalChanges: number;
  before: CleanStats;
  after: CleanStats;
}

function measure(text: string): CleanStats {
  return {
    characters: [...text].length,
    lines: text.length === 0 ? 0 : text.split('\n').length,
  };
}

export function isRuleId(value: string): value is RuleId {
  return (RULE_IDS as readonly string[]).includes(value);
}

export function resolveExclusive(enabled: RuleId[], justEnabled: RuleId): RuleId[] {
  const blocked = EXCLUSIVE_PAIRS.flatMap(([first, second]) => {
    if (first === justEnabled) return [second];
    if (second === justEnabled) return [first];
    return [];
  });

  return enabled.filter((id) => !blocked.includes(id));
}

/** Rules run in a fixed order so the result never depends on click order. */
export function cleanText(text: string, enabled: readonly RuleId[]): CleanResult {
  const active = new Set(enabled);
  const changes: Array<{ id: RuleId; count: number }> = [];

  let current = text;
  for (const rule of RULES) {
    if (!active.has(rule.id)) continue;

    const count = rule.count(current);
    if (count > 0) current = rule.apply(current);
    changes.push({ id: rule.id, count });
  }

  return {
    text: current,
    changes,
    totalChanges: changes.reduce((total, change) => total + change.count, 0),
    before: measure(text),
    after: measure(current),
  };
}

export function hasThaiCombining(text: string): boolean {
  return THAI_COMBINING_CLASS.test(text);
}
