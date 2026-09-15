import { describe, expect, it } from 'vitest';

import { TEST_SLUG_PREFIX } from '@/test/fixtures';

import {
  CATEGORY_META,
  CATEGORY_ORDER,
  TOOLS,
  TOOLS_BY_CATEGORY,
  TOOLS_BY_SLUG,
  TOOL_COUNT,
  getRelatedTools,
  getTool,
  isToolCategory,
  searchTools,
} from '@/config/tools';
import { buildToolStorageKey } from '@/config/storage-keys';

const EXPECTED_TOOL_COUNT = 36;
const LOWEST_ID = 1;
const HIGHEST_ID = 36;
const EXPECTED_PER_CATEGORY = {
  productivity: 9,
  finance: 7,
  developer: 13,
  design: 7,
} as const;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const THAI_CHARACTER_PATTERN = /[฀-๿]/;

describe('registry shape', () => {
  it('holds exactly 36 tools', () => {
    expect(TOOL_COUNT).toBe(EXPECTED_TOOL_COUNT);
    expect(TOOLS).toHaveLength(EXPECTED_TOOL_COUNT);
  });

  it('uses every id from 1 to 36 exactly once', () => {
    const ids = TOOLS.map((tool) => tool.id).sort((a, b) => a - b);
    const expected = Array.from(
      { length: HIGHEST_ID - LOWEST_ID + 1 },
      (_, index) => LOWEST_ID + index,
    );
    expect(ids).toEqual(expected);
  });

  it('has unique, url-safe slugs', () => {
    const slugs = TOOLS.map((tool) => tool.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) {
      expect(slug, `slug "${slug}" is not url-safe`).toMatch(SLUG_PATTERN);
    }
  });

  it('fills both languages for every name and description', () => {
    for (const tool of TOOLS) {
      expect(tool.name.th.length, tool.slug).toBeGreaterThan(0);
      expect(tool.name.en.length, tool.slug).toBeGreaterThan(0);
      expect(tool.description.th.length, tool.slug).toBeGreaterThan(0);
      expect(tool.description.en.length, tool.slug).toBeGreaterThan(0);
    }
  });

  it('gives every tool at least one Thai and one non-Thai keyword', () => {
    for (const tool of TOOLS) {
      const thai = tool.keywords.filter((k) => THAI_CHARACTER_PATTERN.test(k));
      const latin = tool.keywords.filter((k) => !THAI_CHARACTER_PATTERN.test(k));
      expect(thai.length, `${tool.slug} has no Thai keyword`).toBeGreaterThan(0);
      expect(latin.length, `${tool.slug} has no English keyword`).toBeGreaterThan(0);
    }
  });
});

describe('storage keys', () => {
  it('derives a key for every tool that needs storage, and none for the rest', () => {
    for (const tool of TOOLS) {
      if (tool.needsStorage) {
        expect(tool.storageKey, tool.slug).toBe(buildToolStorageKey(tool.slug));
      } else {
        expect(tool.storageKey, tool.slug).toBeUndefined();
      }
    }
  });

  it('keeps storage keys unique', () => {
    const keys = TOOLS.flatMap((tool) => (tool.storageKey ? [tool.storageKey] : []));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('category grouping', () => {
  it('covers every category with metadata', () => {
    for (const category of CATEGORY_ORDER) {
      expect(CATEGORY_META[category]).toBeDefined();
      expect(CATEGORY_META[category].th.length).toBeGreaterThan(0);
    }
  });

  it('splits the tools into the expected per-category counts', () => {
    for (const [category, count] of Object.entries(EXPECTED_PER_CATEGORY)) {
      expect(
        TOOLS_BY_CATEGORY[category as keyof typeof EXPECTED_PER_CATEGORY],
        category,
      ).toHaveLength(count);
    }
  });

  it('accounts for every tool across the categories', () => {
    const grouped = CATEGORY_ORDER.flatMap((c) => TOOLS_BY_CATEGORY[c]);
    expect(grouped).toHaveLength(TOOL_COUNT);
  });

  it('recognises valid categories only', () => {
    expect(isToolCategory('developer')).toBe(true);
    expect(isToolCategory('nonsense')).toBe(false);
  });
});

describe('getTool', () => {
  it('finds a tool by slug', () => {
    expect(getTool('base-converter')?.id).toBe(19);
  });

  it('returns undefined for an unknown slug', () => {
    expect(getTool('not-a-real-tool')).toBeUndefined();
  });

  it('exposes the same objects through the slug lookup', () => {
    for (const tool of TOOLS) {
      expect(TOOLS_BY_SLUG[tool.slug]).toBe(tool);
    }
  });
});

describe('searchTools', () => {
  it('returns nothing for an empty or whitespace query', () => {
    expect(searchTools('')).toEqual([]);
    expect(searchTools('   ')).toEqual([]);
  });

  it('finds a tool by its Thai name', () => {
    expect(searchTools('แปลงเลขฐาน')[0]?.slug).toBe('base-converter');
  });

  it('finds a tool by a Thai keyword that is not in its name', () => {
    expect(searchTools('ไบนารี')[0]?.slug).toBe('base-converter');
  });

  it('finds a tool by an English keyword', () => {
    expect(searchTools('hexadecimal')[0]?.slug).toBe('base-converter');
  });

  it('ignores letter case', () => {
    expect(searchTools('JSON')[0]?.slug).toBe('json-formatter');
    expect(searchTools('json')[0]?.slug).toBe('json-formatter');
  });

  it('tolerates a dropped character', () => {
    const slugs = searchTools('pomdoro').map((tool) => tool.slug);
    expect(slugs).toContain('pomodoro');
  });

  it('ranks a ready tool above a planned one at equal relevance', () => {
    const results = searchTools('เลขฐาน');
    expect(results[0]?.status).toBe('ready');
  });

  it('returns an empty list when nothing matches', () => {
    expect(searchTools('zzzzqqqxyw')).toEqual([]);
  });
});

describe('slugs reserved for tests', () => {
  // Fixtures build slugs with this prefix so deleting or overwriting one can
  // never touch a real tool. The guarantee only holds if no tool uses it.
  it('is a prefix no real tool uses', () => {
    const clashes = TOOLS.filter((tool) => tool.slug.startsWith(TEST_SLUG_PREFIX));
    expect(clashes).toEqual([]);
  });
});

describe('getRelatedTools', () => {
  const baseConverter = getTool('base-converter')!;

  it('returns tools from the same category', () => {
    for (const related of getRelatedTools(baseConverter, 4)) {
      expect(related.category).toBe('developer');
    }
  });

  it('never includes the tool itself', () => {
    const slugs = getRelatedTools(baseConverter, 4).map((tool) => tool.slug);
    expect(slugs).not.toContain('base-converter');
  });

  it('returns the same list every call, so server and client agree', () => {
    const first = getRelatedTools(baseConverter, 4).map((tool) => tool.slug);
    const second = getRelatedTools(baseConverter, 4).map((tool) => tool.slug);
    expect(first).toEqual(second);
  });

  it('honours the requested count', () => {
    expect(getRelatedTools(baseConverter, 4)).toHaveLength(4);
    expect(getRelatedTools(baseConverter, 2)).toHaveLength(2);
  });

  it('puts ready tools before planned ones', () => {
    const pomodoro = getTool('pomodoro')!;
    const statuses = getRelatedTools(pomodoro, 9).map((tool) => tool.status);
    const sorted = [...statuses].sort((a, b) => (a === 'ready' ? -1 : 0) - (b === 'ready' ? -1 : 0));
    expect(statuses).toEqual(sorted);
  });
});
