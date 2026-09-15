/**
 * Tools that own data keep a schema number inside it.
 *
 * The storage envelope has a version of its own, but that one describes the
 * envelope: `getItem` throws the data away when it does not match. A tool's
 * schema number describes the shape of what is inside, and it has to survive
 * being read by a newer version of the tool — so every tool with a data model
 * exports a `migrate` that turns whatever was in storage into something valid,
 * even when the answer is "start again".
 */
export interface Versioned {
  schema: number;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function storedSchema(value: unknown): number | null {
  if (!isRecord(value)) return null;
  return typeof value.schema === 'number' ? value.schema : null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

export function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}
