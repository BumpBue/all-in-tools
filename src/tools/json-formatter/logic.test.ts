import { describe, expect, it } from 'vitest';

import {
  INDENT_STYLES,
  buildTree,
  byteLength,
  formatJson,
  indentOf,
  joinPath,
  jsonStats,
  kindOf,
  minifyJson,
  parseJson,
  sortKeys,
  toTypeScript,
  type JsonValue,
} from '@/tools/json-formatter/logic';

const SAMPLE: JsonValue = {
  name: 'ทดสอบ',
  count: 3,
  active: true,
  missing: null,
  items: [
    { id: 1, label: 'one' },
    { id: 2, label: 'two', extra: true },
  ],
};

function ok(raw: string): JsonValue {
  const result = parseJson(raw);
  if (!result.ok) throw new Error(`expected "${raw}" to parse`);
  return result.value;
}

function failure(raw: string) {
  const result = parseJson(raw);
  if (result.ok) throw new Error(`expected "${raw}" to fail`);
  return result;
}

describe('parseJson', () => {
  it('reads valid JSON', () => {
    expect(ok('{"a":1}')).toEqual({ a: 1 });
    expect(ok('[1,2,3]')).toEqual([1, 2, 3]);
    expect(ok('"text"')).toBe('text');
    expect(ok('null')).toBeNull();
  });

  it('reports an empty input without inventing a location', () => {
    expect(failure('')).toMatchObject({ message: 'empty', line: null, column: null });
    expect(failure('   ').message).toBe('empty');
  });

  it('points at the line and column of the problem', () => {
    const broken = '{\n  "a": 1,\n  "b": ,\n}';
    const result = failure(broken);

    expect(result.line).toBe(3);
    expect(result.column).toBeGreaterThan(1);
  });

  it('starts counting lines and columns at one', () => {
    const result = failure('{');
    expect(result.line).toBe(1);
    expect(result.column).toBeGreaterThanOrEqual(1);
  });

  // These two messages are worded differently by the engine: one carries a
  // position, the other only a quoted snippet.
  it('locates both shapes of engine message', () => {
    expect(failure('{"a":1,}').line).toBe(1);
    expect(failure('[1,2,]').line).toBe(1);
  });

  it('finds the failing line in a multi-line document', () => {
    const broken = ['{', '  "a": 1,', '  "b": [1,2,],', '  "c": 3', '}'].join('\n');
    expect(failure(broken).line).toBe(3);
  });

  it('locates a problem on the first line', () => {
    const result = failure('{ "a": }');
    expect(result.line).toBe(1);
  });

  it('keeps the engine message for the details', () => {
    expect(failure('{oops}').message.length).toBeGreaterThan(0);
  });
});

describe('formatting', () => {
  it('indents with spaces or a tab', () => {
    expect(formatJson({ a: 1 }, '2')).toBe('{\n  "a": 1\n}');
    expect(formatJson({ a: 1 }, '4')).toBe('{\n    "a": 1\n}');
    expect(formatJson({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}');
  });

  it('offers three indent styles', () => {
    expect(INDENT_STYLES).toEqual(['2', '4', 'tab']);
    expect(indentOf('2')).toBe(2);
    expect(indentOf('tab')).toBe('\t');
  });

  it('minifies to a single line', () => {
    expect(minifyJson(SAMPLE)).not.toContain('\n');
    expect(minifyJson({ a: 1, b: [2] })).toBe('{"a":1,"b":[2]}');
  });

  it('round-trips through format and parse', () => {
    expect(ok(formatJson(SAMPLE, '2'))).toEqual(SAMPLE);
    expect(ok(minifyJson(SAMPLE))).toEqual(SAMPLE);
  });

  it('keeps Thai text intact', () => {
    expect(ok(minifyJson(SAMPLE))).toMatchObject({ name: 'ทดสอบ' });
  });
});

describe('sortKeys', () => {
  it('sorts one level', () => {
    expect(Object.keys(sortKeys({ b: 1, a: 2 }) as object)).toEqual(['a', 'b']);
  });

  it('sorts every level', () => {
    const sorted = sortKeys({ b: { d: 1, c: 2 }, a: 3 }) as {
      b: Record<string, number>;
    };
    expect(Object.keys(sorted)).toEqual(['a', 'b']);
    expect(Object.keys(sorted.b)).toEqual(['c', 'd']);
  });

  it('sorts objects inside arrays', () => {
    const sorted = sortKeys([{ b: 1, a: 2 }]) as Array<Record<string, number>>;
    expect(Object.keys(sorted[0])).toEqual(['a', 'b']);
  });

  it('leaves array order alone', () => {
    expect(sortKeys([3, 1, 2])).toEqual([3, 1, 2]);
  });

  it('changes no values', () => {
    expect(sortKeys(SAMPLE)).toEqual(SAMPLE);
  });
});

describe('jsonStats', () => {
  it('counts keys, nodes and containers', () => {
    const stats = jsonStats(SAMPLE);

    expect(stats.keys).toBe(10);
    expect(stats.objects).toBe(3);
    expect(stats.arrays).toBe(1);
  });

  it('measures depth from one', () => {
    expect(jsonStats(1).maxDepth).toBe(1);
    expect(jsonStats({ a: 1 }).maxDepth).toBe(2);
    expect(jsonStats({ a: { b: { c: 1 } } }).maxDepth).toBe(4);
  });

  it('handles empty containers', () => {
    expect(jsonStats({}).keys).toBe(0);
    expect(jsonStats([]).arrays).toBe(1);
  });
});

describe('kindOf', () => {
  it('tells null and arrays from plain objects', () => {
    expect(kindOf(null)).toBe('null');
    expect(kindOf([])).toBe('array');
    expect(kindOf({})).toBe('object');
    expect(kindOf('x')).toBe('string');
    expect(kindOf(1)).toBe('number');
    expect(kindOf(true)).toBe('boolean');
  });
});

describe('joinPath', () => {
  it('uses dot notation for plain names', () => {
    expect(joinPath('root', 'items')).toBe('root.items');
  });

  it('uses brackets for an index', () => {
    expect(joinPath('root.items', 0)).toBe('root.items[0]');
  });

  it('quotes a key that is not an identifier', () => {
    expect(joinPath('root', 'a key')).toBe('root["a key"]');
    expect(joinPath('root', '2fa')).toBe('root["2fa"]');
  });
});

describe('buildTree', () => {
  it('carries a usable path on every node', () => {
    const tree = buildTree(SAMPLE);
    const items = tree.children.find((child) => child.label === 'items');

    expect(items?.path).toBe('root.items');
    expect(items?.children[0]?.path).toBe('root.items[0]');
    expect(items?.children[0]?.children[1]?.path).toBe('root.items[0].label');
  });

  it('gives leaves no children', () => {
    const tree = buildTree(SAMPLE);
    expect(tree.children.find((child) => child.label === 'count')?.children).toEqual([]);
  });

  it('labels each node by its kind', () => {
    const tree = buildTree(SAMPLE);
    expect(tree.kind).toBe('object');
    expect(tree.children.find((child) => child.label === 'items')?.kind).toBe('array');
  });
});

describe('toTypeScript', () => {
  it('turns an object into an interface', () => {
    const output = toTypeScript({ id: 1, name: 'x' }, 'User');

    expect(output).toContain('interface User {');
    expect(output).toContain('id: number;');
    expect(output).toContain('name: string;');
  });

  it('names a nested interface after its key', () => {
    const output = toTypeScript({ profile: { age: 30 } }, 'User');
    expect(output).toContain('interface Profile {');
    expect(output).toContain('profile: Profile;');
  });

  it('merges the objects in an array into one interface', () => {
    const output = toTypeScript(SAMPLE);

    expect(output).toContain('interface Item {');
    expect(output).toContain('items: Item[];');
  });

  it('marks a key missing from some elements as optional', () => {
    const output = toTypeScript(SAMPLE);
    expect(output).toContain('extra?: boolean;');
    expect(output).toContain('id: number;');
  });

  it('writes a union when a value has more than one type', () => {
    const output = toTypeScript({ mixed: [1, 'two'] }, 'Thing');
    expect(output).toMatch(/mixed: \((number \| string|string \| number)\)\[\]|mixed: (number \| string|string \| number)\[\]/);
  });

  it('writes null for a null value', () => {
    expect(toTypeScript({ missing: null }, 'Thing')).toContain('missing: null;');
  });

  it('handles an empty array', () => {
    expect(toTypeScript({ list: [] }, 'Thing')).toContain('list: unknown[];');
  });

  it('quotes a key that is not an identifier', () => {
    expect(toTypeScript({ 'a key': 1 }, 'Thing')).toContain('"a key": number;');
  });

  it('falls back to a type alias for a bare value', () => {
    expect(toTypeScript(42, 'Count')).toBe('type Count = number;');
  });

  it('does not reuse one interface name for two shapes', () => {
    const output = toTypeScript(
      { a: { item: { x: 1 } }, b: { item: { y: 2 } } },
      'Root',
    );
    const names = [...output.matchAll(/interface (\w+)/g)].map((match) => match[1]);

    expect(new Set(names).size).toBe(names.length);
  });
});

describe('byteLength', () => {
  it('counts utf-8 bytes, not characters', () => {
    expect(byteLength('abc')).toBe(3);
    expect(byteLength('ก')).toBe(3);
    expect(byteLength('🙂')).toBe(4);
  });
});
