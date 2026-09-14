import {
  TOOL_STORAGE_PREFIX,
  TOOL_STORAGE_VERSION,
  buildToolStorageKey,
  parseToolStorageKey,
} from '@/config/storage-keys';

const EXPORT_APP_ID = 'tools';
const EXPORT_SCHEMA_VERSION = 1;
const EXPORT_JSON_INDENT = 2;

const QUOTA_EXCEEDED_NAMES = ['QuotaExceededError', 'NS_ERROR_DOM_QUOTA_REACHED'];
const QUOTA_EXCEEDED_CODES = [22, 1014];

export type StorageFailure =
  | 'unavailable'
  | 'quota-exceeded'
  | 'serialize-failed'
  | 'unknown';

export interface StorageWriteFailure {
  ok: false;
  reason: StorageFailure;
  message: string;
}

export type StorageWriteResult = { ok: true } | StorageWriteFailure;

export type ImportMode = 'replace' | 'merge';

export interface ImportResult {
  ok: boolean;
  imported: number;
  errors: string[];
}

export interface StorageEnvelope<T> {
  version: number;
  data: T;
  updatedAt: number;
}

export interface ExportPayload {
  app: typeof EXPORT_APP_ID;
  schemaVersion: number;
  exportedAt: number;
  tools: Record<string, StorageEnvelope<unknown>>;
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    // Private modes and blocked-cookie settings throw on property access alone.
    return null;
  }
}

function isQuotaExceeded(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    QUOTA_EXCEEDED_NAMES.includes(error.name) ||
    QUOTA_EXCEEDED_CODES.includes(error.code)
  );
}

function toWriteFailure(error: unknown): StorageWriteFailure {
  if (isQuotaExceeded(error)) {
    return {
      ok: false,
      reason: 'quota-exceeded',
      message: 'พื้นที่จัดเก็บในเบราว์เซอร์เต็ม ลบข้อมูลของเครื่องมือที่ไม่ใช้แล้วลองอีกครั้ง',
    };
  }
  return {
    ok: false,
    reason: 'unknown',
    message: error instanceof Error ? error.message : 'บันทึกข้อมูลไม่สำเร็จ',
  };
}

const UNAVAILABLE: StorageWriteFailure = {
  ok: false,
  reason: 'unavailable',
  message: 'เบราว์เซอร์นี้ไม่อนุญาตให้บันทึกข้อมูลลงเครื่อง ข้อมูลจะหายเมื่อปิดหน้า',
};

function isEnvelope(value: unknown): value is StorageEnvelope<unknown> {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    'data' in candidate
  );
}

export function getItem<T>(key: string, fallback: T): T {
  const storage = getStorage();
  if (!storage) return fallback;

  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;

    const parsed: unknown = JSON.parse(raw);
    if (!isEnvelope(parsed)) return fallback;
    if (parsed.version !== TOOL_STORAGE_VERSION) return fallback;

    return parsed.data as T;
  } catch {
    return fallback;
  }
}

export function setItem<T>(key: string, value: T): StorageWriteResult {
  const storage = getStorage();
  if (!storage) return UNAVAILABLE;

  let serialized: string;
  try {
    const envelope: StorageEnvelope<T> = {
      version: TOOL_STORAGE_VERSION,
      data: value,
      updatedAt: Date.now(),
    };
    serialized = JSON.stringify(envelope);
  } catch (error) {
    return {
      ok: false,
      reason: 'serialize-failed',
      message: error instanceof Error ? error.message : 'ข้อมูลนี้แปลงเป็น JSON ไม่ได้',
    };
  }

  try {
    storage.setItem(key, serialized);
    return { ok: true };
  } catch (error) {
    return toWriteFailure(error);
  }
}

export function removeItem(key: string): StorageWriteResult {
  const storage = getStorage();
  if (!storage) return UNAVAILABLE;

  try {
    storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return toWriteFailure(error);
  }
}

export function listToolKeys(): string[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(TOOL_STORAGE_PREFIX)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}

export function clearAll(): StorageWriteResult {
  const storage = getStorage();
  if (!storage) return UNAVAILABLE;

  try {
    for (const key of listToolKeys()) storage.removeItem(key);
    return { ok: true };
  } catch (error) {
    return toWriteFailure(error);
  }
}

export function exportAll(): string {
  const storage = getStorage();
  const tools: Record<string, StorageEnvelope<unknown>> = {};

  if (storage) {
    for (const key of listToolKeys()) {
      const slug = parseToolStorageKey(key);
      if (!slug) continue;

      try {
        const raw = storage.getItem(key);
        if (raw === null) continue;

        const parsed: unknown = JSON.parse(raw);
        if (isEnvelope(parsed)) tools[slug] = parsed;
      } catch {
        continue;
      }
    }
  }

  const payload: ExportPayload = {
    app: EXPORT_APP_ID,
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: Date.now(),
    tools,
  };

  return JSON.stringify(payload, null, EXPORT_JSON_INDENT);
}

function validateExportPayload(json: string): {
  entries: Array<[string, StorageEnvelope<unknown>]>;
  errors: string[];
} {
  const errors: string[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { entries: [], errors: ['ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้'] };
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { entries: [], errors: ['โครงสร้างไฟล์ไม่ถูกต้อง'] };
  }

  const payload = parsed as Record<string, unknown>;

  if (payload.app !== EXPORT_APP_ID) {
    errors.push('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของเว็บนี้');
  }

  if (
    typeof payload.schemaVersion !== 'number' ||
    payload.schemaVersion > EXPORT_SCHEMA_VERSION
  ) {
    errors.push('ไฟล์นี้มาจากเวอร์ชันที่ใหม่กว่า อัปเดตหน้าเว็บก่อนแล้วลองใหม่');
  }

  const tools = payload.tools;
  if (typeof tools !== 'object' || tools === null || Array.isArray(tools)) {
    errors.push('ไม่พบส่วนข้อมูลเครื่องมือในไฟล์');
    return { entries: [], errors };
  }

  const entries: Array<[string, StorageEnvelope<unknown>]> = [];

  for (const [slug, value] of Object.entries(tools)) {
    if (parseToolStorageKey(buildToolStorageKey(slug)) === null) {
      errors.push(`ชื่อเครื่องมือไม่ถูกต้อง: ${slug}`);
      continue;
    }
    if (!isEnvelope(value)) {
      errors.push(`ข้อมูลของ ${slug} ไม่ครบถ้วน`);
      continue;
    }
    entries.push([slug, value]);
  }

  return { entries, errors };
}

export function importAll(json: string, mode: ImportMode = 'merge'): ImportResult {
  const { entries, errors } = validateExportPayload(json);
  if (errors.length > 0) return { ok: false, imported: 0, errors };

  const storage = getStorage();
  if (!storage) return { ok: false, imported: 0, errors: [UNAVAILABLE.message] };

  const incomingKeys = new Set(entries.map(([slug]) => buildToolStorageKey(slug)));
  const writeErrors: string[] = [];
  let imported = 0;

  // Write before pruning so a quota failure cannot destroy existing data first.
  for (const [slug, envelope] of entries) {
    try {
      storage.setItem(buildToolStorageKey(slug), JSON.stringify(envelope));
      imported += 1;
    } catch (error) {
      writeErrors.push(`${slug}: ${toWriteFailure(error).message}`);
    }
  }

  // Pruning only after every write landed keeps a partial import from deleting
  // data that was not replaced.
  if (mode === 'replace' && writeErrors.length === 0) {
    for (const key of listToolKeys()) {
      if (!incomingKeys.has(key)) storage.removeItem(key);
    }
  }

  return { ok: writeErrors.length === 0, imported, errors: writeErrors };
}
