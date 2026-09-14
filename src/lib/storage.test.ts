import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildToolStorageKey } from '@/config/storage-keys';
import {
  clearAll,
  exportAll,
  getItem,
  importAll,
  listToolKeys,
  inspectImport,
  removeItem,
  setItem,
  summarizeStorage,
  type ExportPayload,
} from '@/lib/storage';

const QUOTA_ERROR_NAME = 'QuotaExceededError';
const FALLBACK = { note: 'fallback' };
const SAMPLE_SLUG = 'pomodoro';
const SAMPLE_KEY = buildToolStorageKey(SAMPLE_SLUG);
const UNRELATED_KEY = 'analytics:session';

class MemoryStorage implements Storage {
  private entries = new Map<string, string>();
  failNextWrite: Error | null = null;

  get length(): number {
    return this.entries.size;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failNextWrite) {
      const error = this.failNextWrite;
      throw error;
    }
    this.entries.set(key, value);
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

function quotaError(): DOMException {
  return new DOMException('quota', QUOTA_ERROR_NAME);
}

let storage: MemoryStorage;

function useStorage(value: MemoryStorage | null) {
  vi.stubGlobal('window', value === null ? {} : { localStorage: value });
}

beforeEach(() => {
  storage = new MemoryStorage();
  useStorage(storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('when localStorage is unavailable', () => {
  it('returns the fallback on read', () => {
    vi.unstubAllGlobals();
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
  });

  it('reports the failure on write instead of throwing', () => {
    vi.unstubAllGlobals();
    const result = setItem(SAMPLE_KEY, { a: 1 });
    expect(result).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('survives a browser that throws on property access', () => {
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('blocked', 'SecurityError');
      },
    });
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
    expect(setItem(SAMPLE_KEY, { a: 1 })).toMatchObject({ reason: 'unavailable' });
  });
});

describe('round trip', () => {
  it('writes and reads a value back', () => {
    expect(setItem(SAMPLE_KEY, { minutes: 25 })).toEqual({ ok: true });
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ minutes: 25 });
  });

  it('wraps the value in a versioned envelope', () => {
    setItem(SAMPLE_KEY, { minutes: 25 });
    const raw = JSON.parse(storage.getItem(SAMPLE_KEY) ?? '{}');
    expect(raw).toMatchObject({ version: 1, data: { minutes: 25 } });
    expect(typeof raw.updatedAt).toBe('number');
  });

  it('stores falsy values without falling back', () => {
    setItem(SAMPLE_KEY, 0);
    expect(getItem<number>(SAMPLE_KEY, 99)).toBe(0);
  });

  it('removes a value', () => {
    setItem(SAMPLE_KEY, { minutes: 25 });
    expect(removeItem(SAMPLE_KEY)).toEqual({ ok: true });
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
  });
});

describe('when the quota is full', () => {
  it('reports quota-exceeded rather than a generic failure', () => {
    storage.failNextWrite = quotaError();
    expect(setItem(SAMPLE_KEY, { minutes: 25 })).toMatchObject({
      ok: false,
      reason: 'quota-exceeded',
    });
  });

  it('reports other write failures as unknown', () => {
    storage.failNextWrite = new Error('disk on fire');
    expect(setItem(SAMPLE_KEY, { minutes: 25 })).toMatchObject({
      ok: false,
      reason: 'unknown',
      message: 'disk on fire',
    });
  });

  it('reports values that cannot be serialized', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(setItem(SAMPLE_KEY, circular)).toMatchObject({
      ok: false,
      reason: 'serialize-failed',
    });
  });
});

describe('when stored data is corrupt', () => {
  it('falls back on invalid JSON', () => {
    storage.setItem(SAMPLE_KEY, '{not json');
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
  });

  it('falls back when the envelope is missing', () => {
    storage.setItem(SAMPLE_KEY, JSON.stringify({ minutes: 25 }));
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
  });

  it('falls back when the envelope version is unknown', () => {
    storage.setItem(
      SAMPLE_KEY,
      JSON.stringify({ version: 99, data: { minutes: 1 }, updatedAt: 0 }),
    );
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual(FALLBACK);
  });
});

describe('key scanning', () => {
  it('lists only tool keys', () => {
    setItem(SAMPLE_KEY, 1);
    setItem(buildToolStorageKey('flashcards'), 2);
    storage.setItem(UNRELATED_KEY, 'x');

    expect(listToolKeys().sort()).toEqual(
      [SAMPLE_KEY, buildToolStorageKey('flashcards')].sort(),
    );
  });

  it('clears tool keys and leaves everything else alone', () => {
    setItem(SAMPLE_KEY, 1);
    storage.setItem(UNRELATED_KEY, 'x');

    expect(clearAll()).toEqual({ ok: true });
    expect(listToolKeys()).toEqual([]);
    expect(storage.getItem(UNRELATED_KEY)).toBe('x');
  });
});

describe('exportAll', () => {
  it('produces the documented metadata envelope', () => {
    setItem(SAMPLE_KEY, { minutes: 25 });
    const payload: ExportPayload = JSON.parse(exportAll());

    expect(payload.app).toBe('tools');
    expect(payload.schemaVersion).toBe(1);
    expect(typeof payload.exportedAt).toBe('number');
    expect(payload.tools[SAMPLE_SLUG]).toMatchObject({
      version: 1,
      data: { minutes: 25 },
    });
  });

  it('keys tools by slug, not by storage key', () => {
    setItem(SAMPLE_KEY, 1);
    const payload: ExportPayload = JSON.parse(exportAll());
    expect(Object.keys(payload.tools)).toEqual([SAMPLE_SLUG]);
  });

  it('skips unrelated and unreadable entries', () => {
    storage.setItem(UNRELATED_KEY, 'x');
    storage.setItem(buildToolStorageKey('flashcards'), '{broken');

    const payload: ExportPayload = JSON.parse(exportAll());
    expect(payload.tools).toEqual({});
  });

  it('exports an empty payload when storage is unavailable', () => {
    vi.unstubAllGlobals();
    const payload: ExportPayload = JSON.parse(exportAll());
    expect(payload.tools).toEqual({});
  });
});

describe('importAll validation', () => {
  it('rejects text that is not JSON', () => {
    const result = importAll('not json at all');
    expect(result.ok).toBe(false);
    expect(result.imported).toBe(0);
    expect(result.errors).toHaveLength(1);
  });

  it('rejects a payload from a different app', () => {
    const result = importAll(
      JSON.stringify({ app: 'something-else', schemaVersion: 1, tools: {} }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a payload from a newer schema version', () => {
    const result = importAll(
      JSON.stringify({ app: 'tools', schemaVersion: 99, tools: {} }),
    );
    expect(result.ok).toBe(false);
  });

  it('rejects a payload with no tools section', () => {
    const result = importAll(JSON.stringify({ app: 'tools', schemaVersion: 1 }));
    expect(result.ok).toBe(false);
  });

  it('rejects an entry whose envelope is incomplete', () => {
    const result = importAll(
      JSON.stringify({
        app: 'tools',
        schemaVersion: 1,
        tools: { pomodoro: { data: { minutes: 25 } } },
      }),
    );
    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain('pomodoro');
  });

  it('rejects an entry with an unsafe slug', () => {
    const result = importAll(
      JSON.stringify({
        app: 'tools',
        schemaVersion: 1,
        tools: { '../evil': { version: 1, data: 1, updatedAt: 0 } },
      }),
    );
    expect(result.ok).toBe(false);
  });

  it('writes nothing at all when validation fails', () => {
    setItem(SAMPLE_KEY, { keep: true });
    importAll(
      JSON.stringify({
        app: 'tools',
        schemaVersion: 1,
        tools: {
          pomodoro: { version: 1, data: { minutes: 50 }, updatedAt: 0 },
          flashcards: { data: 'missing envelope fields' },
        },
      }),
    );
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ keep: true });
  });
});

describe('importAll modes', () => {
  const payload = JSON.stringify({
    app: 'tools',
    schemaVersion: 1,
    tools: { pomodoro: { version: 1, data: { minutes: 50 }, updatedAt: 123 } },
  });

  beforeEach(() => {
    setItem(SAMPLE_KEY, { minutes: 25 });
    setItem(buildToolStorageKey('habit-tracker'), { streak: 7 });
  });

  it('merge overwrites matching keys and keeps the rest', () => {
    const result = importAll(payload, 'merge');

    expect(result).toEqual({ ok: true, imported: 1, errors: [] });
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ minutes: 50 });
    expect(getItem(buildToolStorageKey('habit-tracker'), FALLBACK)).toEqual({
      streak: 7,
    });
  });

  it('replace drops tool data that is absent from the file', () => {
    const result = importAll(payload, 'replace');

    expect(result.ok).toBe(true);
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ minutes: 50 });
    expect(getItem(buildToolStorageKey('habit-tracker'), FALLBACK)).toEqual(FALLBACK);
  });

  it('replace leaves keys outside the tool prefix alone', () => {
    storage.setItem(UNRELATED_KEY, 'x');
    importAll(payload, 'replace');
    expect(storage.getItem(UNRELATED_KEY)).toBe('x');
  });

  it('defaults to merge', () => {
    importAll(payload);
    expect(getItem(buildToolStorageKey('habit-tracker'), FALLBACK)).toEqual({
      streak: 7,
    });
  });

  it('keeps existing data when the write hits the quota', () => {
    storage.failNextWrite = quotaError();
    const result = importAll(payload, 'replace');

    expect(result.ok).toBe(false);
    expect(result.imported).toBe(0);
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ minutes: 25 });
    expect(getItem(buildToolStorageKey('habit-tracker'), FALLBACK)).toEqual({
      streak: 7,
    });
  });

  it('reports the failure when storage is unavailable', () => {
    vi.unstubAllGlobals();
    expect(importAll(payload)).toMatchObject({ ok: false, imported: 0 });
  });
});

describe('summarizeStorage', () => {
  it('is empty when nothing is stored', () => {
    expect(summarizeStorage()).toEqual({ tools: [], totalBytes: 0 });
  });

  it('counts array entries as items', () => {
    setItem(SAMPLE_KEY, [{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(summarizeStorage().tools[0]).toMatchObject({
      slug: SAMPLE_SLUG,
      itemCount: 3,
    });
  });

  it('counts object keys as items', () => {
    setItem(SAMPLE_KEY, { a: 1, b: 2 });
    expect(summarizeStorage().tools[0]?.itemCount).toBe(2);
  });

  it('counts a scalar as a single item', () => {
    setItem(SAMPLE_KEY, 42);
    expect(summarizeStorage().tools[0]?.itemCount).toBe(1);
  });

  it('reports a non-zero size and a total across tools', () => {
    setItem(SAMPLE_KEY, [1, 2, 3]);
    setItem(buildToolStorageKey('habit-tracker'), { streak: 7 });

    const summary = summarizeStorage();
    expect(summary.tools).toHaveLength(2);
    expect(summary.totalBytes).toBe(
      summary.tools.reduce((sum, tool) => sum + tool.bytes, 0),
    );
    expect(summary.totalBytes).toBeGreaterThan(0);
  });

  it('puts the most recently updated tool first', () => {
    setItem(buildToolStorageKey('habit-tracker'), 1);
    storage.setItem(
      SAMPLE_KEY,
      JSON.stringify({ version: 1, data: 1, updatedAt: Date.now() + 10_000 }),
    );

    expect(summarizeStorage().tools[0]?.slug).toBe(SAMPLE_SLUG);
  });

  // Two tools saved in the same millisecond used to come back in key order,
  // which made the list reshuffle between redraws.
  it('orders tools saved at the same moment by slug', () => {
    const sameMoment = Date.now();
    for (const slug of ['pomodoro', 'flashcards', 'habit-tracker']) {
      storage.setItem(
        buildToolStorageKey(slug),
        JSON.stringify({ version: 1, data: 1, updatedAt: sameMoment }),
      );
    }

    expect(summarizeStorage().tools.map((tool) => tool.slug)).toEqual([
      'flashcards',
      'habit-tracker',
      'pomodoro',
    ]);
  });

  it('skips unreadable entries and keys outside the prefix', () => {
    setItem(SAMPLE_KEY, [1]);
    storage.setItem(UNRELATED_KEY, 'x');
    storage.setItem(buildToolStorageKey('flashcards'), '{broken');

    expect(summarizeStorage().tools.map((tool) => tool.slug)).toEqual([SAMPLE_SLUG]);
  });

  it('is empty when storage is unavailable', () => {
    vi.unstubAllGlobals();
    expect(summarizeStorage()).toEqual({ tools: [], totalBytes: 0 });
  });
});

describe('inspectImport', () => {
  const payload = JSON.stringify({
    app: 'tools',
    schemaVersion: 1,
    tools: {
      pomodoro: { version: 1, data: [1, 2], updatedAt: 5 },
      flashcards: { version: 1, data: { a: 1 }, updatedAt: 6 },
    },
  });

  it('summarizes what the file would write', () => {
    const preview = inspectImport(payload);

    expect(preview.ok).toBe(true);
    expect(preview.errors).toEqual([]);
    expect(preview.tools).toEqual([
      { slug: 'pomodoro', itemCount: 2, updatedAt: 5 },
      { slug: 'flashcards', itemCount: 1, updatedAt: 6 },
    ]);
  });

  it('writes nothing while inspecting', () => {
    setItem(SAMPLE_KEY, { keep: true });
    inspectImport(payload);
    expect(getItem(SAMPLE_KEY, FALLBACK)).toEqual({ keep: true });
  });

  it('reports why a bad file was rejected', () => {
    const preview = inspectImport('{ not json');
    expect(preview.ok).toBe(false);
    expect(preview.errors).toHaveLength(1);
    expect(preview.tools).toEqual([]);
  });

  it('names the tool whose entry is malformed', () => {
    const preview = inspectImport(
      JSON.stringify({
        app: 'tools',
        schemaVersion: 1,
        tools: { pomodoro: { data: 'no envelope' } },
      }),
    );

    expect(preview.ok).toBe(false);
    expect(preview.errors[0]).toContain('pomodoro');
  });
});
