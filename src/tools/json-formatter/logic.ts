export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type IndentStyle = '2' | '4' | 'tab';
export const INDENT_STYLES: readonly IndentStyle[] = ['2', '4', 'tab'];

/** Above this, parsing is left to an explicit click rather than every keystroke. */
export const LARGE_INPUT_BYTES = 512 * 1024;

const TAB = '\t';
const DEFAULT_ROOT_NAME = 'Root';
// V8 words the same failure two ways. One carries a position, the other only a
// quoted snippet of the source, so both have to be read.
const POSITION_PATTERN = /at position (\d+)/;
const LINE_COLUMN_PATTERN = /line (\d+) column (\d+)/;
const TOKEN_SNIPPET_PATTERN =
  /Unexpected token '(.+?)',\s*(?:\.\.\.)?"([\s\S]*)"(?:\.\.\.)? is not valid JSON/;

export interface JsonError {
  ok: false;
  message: string;
  /** 1-based, or null when the engine gave nothing to locate. */
  line: number | null;
  column: number | null;
  position: number | null;
}

export type JsonResult = { ok: true; value: JsonValue } | JsonError;

export function indentOf(style: IndentStyle): string | number {
  if (style === 'tab') return TAB;
  return Number(style);
}

/**
 * Works out the line and column itself instead of trusting the engine's
 * message, which words the same failure differently across browsers.
 */
function locate(raw: string, position: number): { line: number; column: number } {
  const before = raw.slice(0, Math.max(position, 0));
  const lines = before.split('\n');

  return { line: lines.length, column: (lines[lines.length - 1]?.length ?? 0) + 1 };
}

/**
 * Finds where the engine stopped when the message only quotes a snippet. V8
 * centres that snippet on the failure, so the last occurrence of the offending
 * character inside it is the one that broke the parse.
 */
function positionFromSnippet(raw: string, message: string): number | null {
  const match = TOKEN_SNIPPET_PATTERN.exec(message);
  if (!match) return null;

  const [, token, snippet] = match;
  const snippetStart = raw.indexOf(snippet);
  if (snippetStart === -1) return null;

  const offset = snippet.lastIndexOf(token);
  return offset === -1 ? null : snippetStart + offset;
}

export function parseJson(raw: string): JsonResult {
  if (raw.trim().length === 0) {
    return { ok: false, message: 'empty', line: null, column: null, position: null };
  }

  try {
    return { ok: true, value: JSON.parse(raw) as JsonValue };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    const lineColumn = LINE_COLUMN_PATTERN.exec(message);
    if (lineColumn) {
      const position = POSITION_PATTERN.exec(message);
      return {
        ok: false,
        message,
        line: Number(lineColumn[1]),
        column: Number(lineColumn[2]),
        position: position ? Number(position[1]) : null,
      };
    }

    const position =
      Number(POSITION_PATTERN.exec(message)?.[1] ?? Number.NaN);
    const found = Number.isNaN(position)
      ? positionFromSnippet(raw, message)
      : position;

    if (found === null) {
      return { ok: false, message, line: null, column: null, position: null };
    }

    return { ok: false, message, position: found, ...locate(raw, found) };
  }
}

export function formatJson(value: JsonValue, style: IndentStyle): string {
  return JSON.stringify(value, null, indentOf(style));
}

export function minifyJson(value: JsonValue): string {
  return JSON.stringify(value);
}

function isPlainObject(value: JsonValue): value is { [key: string]: JsonValue } {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sortKeys(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
}

export interface JsonStats {
  keys: number;
  nodes: number;
  maxDepth: number;
  arrays: number;
  objects: number;
}

export function jsonStats(value: JsonValue): JsonStats {
  const stats: JsonStats = { keys: 0, nodes: 0, maxDepth: 0, arrays: 0, objects: 0 };

  const walk = (current: JsonValue, depth: number) => {
    stats.nodes += 1;
    stats.maxDepth = Math.max(stats.maxDepth, depth);

    if (Array.isArray(current)) {
      stats.arrays += 1;
      for (const item of current) walk(item, depth + 1);
      return;
    }

    if (isPlainObject(current)) {
      stats.objects += 1;
      for (const key of Object.keys(current)) {
        stats.keys += 1;
        walk(current[key], depth + 1);
      }
    }
  };

  walk(value, 1);
  return stats;
}

export type JsonKind =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object';

export function kindOf(value: JsonValue): JsonKind {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value as JsonKind;
}

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** The accessor a reader would paste into code to reach this node. */
export function joinPath(parent: string, key: string | number): string {
  if (typeof key === 'number') return `${parent}[${key}]`;
  return IDENTIFIER.test(key) ? `${parent}.${key}` : `${parent}[${JSON.stringify(key)}]`;
}

export interface TreeNode {
  path: string;
  label: string;
  kind: JsonKind;
  value: JsonValue;
  children: TreeNode[];
}

export function buildTree(
  value: JsonValue,
  label = DEFAULT_ROOT_NAME.toLowerCase(),
  path = DEFAULT_ROOT_NAME.toLowerCase(),
): TreeNode {
  const kind = kindOf(value);

  const children: TreeNode[] = Array.isArray(value)
    ? value.map((item, index) =>
        buildTree(item, String(index), joinPath(path, index)),
      )
    : isPlainObject(value)
      ? Object.keys(value).map((key) => buildTree(value[key], key, joinPath(path, key)))
      : [];

  return { path, label, kind, value, children };
}

function pascalCase(raw: string): string {
  const cleaned = raw.replace(/[^A-Za-z0-9]+/g, ' ').trim();
  if (cleaned.length === 0) return 'Value';

  return cleaned
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function singular(name: string): string {
  return name.endsWith('s') && name.length > 1 ? name.slice(0, -1) : `${name}Item`;
}

interface TypeContext {
  interfaces: Map<string, string>;
  used: Set<string>;
}

function uniqueName(context: TypeContext, wanted: string): string {
  let name = wanted;
  let counter = 2;

  while (context.used.has(name)) {
    name = `${wanted}${counter}`;
    counter += 1;
  }

  context.used.add(name);
  return name;
}

/** Merges the objects in an array so one interface covers every element. */
function mergeObjects(
  items: Array<{ [key: string]: JsonValue }>,
): { shape: Map<string, JsonValue[]>; optional: Set<string> } {
  const shape = new Map<string, JsonValue[]>();
  const seen = new Map<string, number>();

  for (const item of items) {
    for (const [key, value] of Object.entries(item)) {
      shape.set(key, [...(shape.get(key) ?? []), value]);
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
  }

  const optional = new Set(
    [...seen.entries()]
      .filter(([, count]) => count < items.length)
      .map(([key]) => key),
  );

  return { shape, optional };
}

function typeFor(values: JsonValue[], name: string, context: TypeContext): string {
  if (values.length === 0) return 'unknown';

  const kinds = new Set(values.map(kindOf));

  if (kinds.size > 1) {
    const parts = [...kinds].map((kind) =>
      typeFor(
        values.filter((value) => kindOf(value) === kind),
        name,
        context,
      ),
    );
    return [...new Set(parts)].join(' | ');
  }

  const kind = [...kinds][0];

  if (kind === 'array') {
    const items = (values as JsonValue[][]).flat();
    return items.length === 0
      ? 'unknown[]'
      : `${typeFor(items, singular(name), context)}[]`;
  }

  if (kind === 'object') {
    const objects = values as Array<{ [key: string]: JsonValue }>;
    const { shape, optional } = mergeObjects(objects);

    if (shape.size === 0) return 'Record<string, never>';

    const interfaceName = uniqueName(context, pascalCase(name));
    const body = [...shape.entries()]
      .map(([key, keyValues]) => {
        const safeKey = IDENTIFIER.test(key) ? key : JSON.stringify(key);
        const mark = optional.has(key) ? '?' : '';
        return `  ${safeKey}${mark}: ${typeFor(keyValues, key, context)};`;
      })
      .join('\n');

    context.interfaces.set(interfaceName, `interface ${interfaceName} {\n${body}\n}`);
    return interfaceName;
  }

  return kind === 'null' ? 'null' : kind;
}

export function toTypeScript(value: JsonValue, rootName = DEFAULT_ROOT_NAME): string {
  const context: TypeContext = { interfaces: new Map(), used: new Set() };
  const rootType = typeFor([value], rootName, context);

  const declarations = [...context.interfaces.values()].reverse();

  if (declarations.length === 0) return `type ${pascalCase(rootName)} = ${rootType};`;
  if (rootType === pascalCase(rootName)) return declarations.join('\n\n');

  return [...declarations, `type ${pascalCase(rootName)} = ${rootType};`].join('\n\n');
}

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}
