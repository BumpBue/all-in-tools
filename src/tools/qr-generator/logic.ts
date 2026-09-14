import qrcode from 'qrcode-generator';

export const QR_MODES = ['text', 'wifi', 'vcard', 'promptpay'] as const;
export type QrMode = (typeof QR_MODES)[number];

export const ERROR_LEVELS = ['L', 'M', 'Q', 'H'] as const;
export type ErrorLevel = (typeof ERROR_LEVELS)[number];
export const DEFAULT_ERROR_LEVEL: ErrorLevel = 'M';

/** Roughly how much of the code each level can lose and still be read. */
export const ERROR_LEVEL_RECOVERY: Readonly<Record<ErrorLevel, number>> = {
  L: 7,
  M: 15,
  Q: 25,
  H: 30,
};

/** A logo covers modules, so it only fits inside what the level can spare. */
export const LOGO_SAFE_LEVELS: readonly ErrorLevel[] = ['Q', 'H'];
export const MAX_LOGO_PERCENT = 22;
export const DEFAULT_LOGO_PERCENT = 18;

export const EXPORT_SIZES = [256, 512, 1024] as const;
export type ExportSize = (typeof EXPORT_SIZES)[number];

export const DEFAULT_DARK = '#000000';
export const DEFAULT_LIGHT = '#ffffff';
export const DEFAULT_MARGIN = 4;

export const MAX_CONTENT_LENGTH = 2_000;

const AUTO_VERSION = 0;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const WIFI_SECURITIES = ['WPA', 'WEP', 'nopass'] as const;
export type WifiSecurity = (typeof WIFI_SECURITIES)[number];

export const PROMPTPAY_TARGETS = ['phone', 'national-id', 'ewallet'] as const;
export type PromptPayTarget = (typeof PROMPTPAY_TARGETS)[number];

// EMVCo tags, in the order the standard puts them.
const TAG_FORMAT = '00';
const TAG_METHOD = '01';
const TAG_MERCHANT = '29';
const TAG_CURRENCY = '53';
const TAG_AMOUNT = '54';
const TAG_COUNTRY = '58';
const TAG_CRC = '63';

const PROMPTPAY_AID = 'A000000677010111';
const PROMPTPAY_SUB_TAGS: Readonly<Record<PromptPayTarget, string>> = {
  phone: '01',
  'national-id': '02',
  ewallet: '03',
};

const THB_CURRENCY = '764';
const THAILAND = 'TH';
const METHOD_STATIC = '11';
const METHOD_WITH_AMOUNT = '12';

const PHONE_FIELD_LENGTH = 13;
const NATIONAL_ID_LENGTH = 13;
const EWALLET_LENGTH = 15;
const THAI_COUNTRY_CODE = '66';

const CRC_POLYNOMIAL = 0x1021;
const CRC_INITIAL = 0xffff;
const CRC_MASK = 0xffff;
const CRC_HEX_LENGTH = 4;
const BITS_PER_BYTE = 8;
const HEX = 16;

export type QrErrorCode =
  | 'empty'
  | 'too-long'
  | 'no-ssid'
  | 'no-name'
  | 'bad-promptpay-id'
  | 'bad-amount';

export type PayloadResult =
  | { ok: true; payload: string }
  | { ok: false; code: QrErrorCode };

export function crc16(text: string): number {
  let crc = CRC_INITIAL;

  for (const byte of new TextEncoder().encode(text)) {
    crc ^= byte << BITS_PER_BYTE;

    for (let bit = 0; bit < BITS_PER_BYTE; bit += 1) {
      crc = (crc & 0x8000) === 0 ? crc << 1 : (crc << 1) ^ CRC_POLYNOMIAL;
      crc &= CRC_MASK;
    }
  }

  return crc;
}

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, '0')}${value}`;
}

/** WiFi payloads use \ ; , : and " as syntax, so they have to be escaped. */
export function escapeWifi(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

export interface WifiInput {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}

export function buildWifi(input: WifiInput): PayloadResult {
  if (input.ssid.trim().length === 0) return { ok: false, code: 'no-ssid' };

  const parts = [
    `T:${input.security}`,
    `S:${escapeWifi(input.ssid)}`,
    input.security === 'nopass' ? '' : `P:${escapeWifi(input.password)}`,
    input.hidden ? 'H:true' : '',
  ].filter((part) => part.length > 0);

  return { ok: true, payload: `WIFI:${parts.join(';')};;` };
}

export interface VCardInput {
  firstName: string;
  lastName: string;
  organization: string;
  title: string;
  phone: string;
  email: string;
  url: string;
  address: string;
  note: string;
}

/** vCard is line-based and the spec calls for CRLF, which some readers insist on. */
export function buildVCard(input: VCardInput): PayloadResult {
  const full = `${input.firstName} ${input.lastName}`.trim();
  if (full.length === 0) return { ok: false, code: 'no-name' };

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${input.lastName};${input.firstName};;;`,
    `FN:${full}`,
    input.organization && `ORG:${input.organization}`,
    input.title && `TITLE:${input.title}`,
    input.phone && `TEL;TYPE=CELL:${input.phone}`,
    input.email && `EMAIL:${input.email}`,
    input.url && `URL:${input.url}`,
    input.address && `ADR;TYPE=HOME:;;${input.address};;;;`,
    input.note && `NOTE:${input.note}`,
    'END:VCARD',
  ].filter((line): line is string => typeof line === 'string' && line.length > 0);

  return { ok: true, payload: lines.join('\r\n') };
}

/**
 * PromptPay wants a 13 digit field: the country code, the number without its
 * leading zero, left-padded with zeros.
 */
export function normalizePromptPayId(
  raw: string,
  target: PromptPayTarget,
): string | null {
  const digits = raw.replace(/\D/g, '');

  if (target === 'phone') {
    const local = digits.startsWith('0') ? digits.slice(1) : digits;
    const withCountry = local.startsWith(THAI_COUNTRY_CODE)
      ? local
      : `${THAI_COUNTRY_CODE}${local}`;

    if (withCountry.length !== THAI_COUNTRY_CODE.length + 9) return null;
    return withCountry.padStart(PHONE_FIELD_LENGTH, '0');
  }

  if (target === 'national-id') {
    return digits.length === NATIONAL_ID_LENGTH ? digits : null;
  }

  return digits.length === EWALLET_LENGTH ? digits : null;
}

export interface PromptPayInput {
  target: PromptPayTarget;
  id: string;
  amount: string;
}

export function buildPromptPay(input: PromptPayInput): PayloadResult {
  const account = normalizePromptPayId(input.id, input.target);
  if (account === null) return { ok: false, code: 'bad-promptpay-id' };

  const trimmedAmount = input.amount.trim();
  const amount = trimmedAmount.length === 0 ? null : Number(trimmedAmount);

  if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
    return { ok: false, code: 'bad-amount' };
  }

  const merchant =
    tlv(TAG_FORMAT, PROMPTPAY_AID) +
    tlv(PROMPTPAY_SUB_TAGS[input.target], account);

  const body =
    tlv(TAG_FORMAT, '01') +
    tlv(TAG_METHOD, amount === null ? METHOD_STATIC : METHOD_WITH_AMOUNT) +
    tlv(TAG_MERCHANT, merchant) +
    tlv(TAG_CURRENCY, THB_CURRENCY) +
    (amount === null ? '' : tlv(TAG_AMOUNT, amount.toFixed(2))) +
    tlv(TAG_COUNTRY, THAILAND);

  // The checksum covers its own tag and length, which are written first.
  const withCrcTag = `${body}${TAG_CRC}${String(CRC_HEX_LENGTH).padStart(2, '0')}`;
  const checksum = crc16(withCrcTag)
    .toString(HEX)
    .toUpperCase()
    .padStart(CRC_HEX_LENGTH, '0');

  return { ok: true, payload: `${withCrcTag}${checksum}` };
}

export function buildText(text: string): PayloadResult {
  if (text.trim().length === 0) return { ok: false, code: 'empty' };
  if (text.length > MAX_CONTENT_LENGTH) return { ok: false, code: 'too-long' };

  return { ok: true, payload: text };
}

export interface QrMatrix {
  size: number;
  /** Row-major; true is a dark module. */
  modules: boolean[][];
}

// The library reads bytes through this hook, and its own encoder predates
// TextEncoder and mishandles anything outside Latin-1 — Thai included.
qrcode.stringToBytes = (text: string) => [...new TextEncoder().encode(text)];

export function buildMatrix(payload: string, level: ErrorLevel): QrMatrix {
  const code = qrcode(AUTO_VERSION, level);
  code.addData(payload, 'Byte');
  code.make();

  const size = code.getModuleCount();
  const modules = Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, column) => code.isDark(row, column)),
  );

  return { size, modules };
}

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

export function readColor(raw: string | undefined, fallback: string): string {
  if (raw === undefined) return fallback;
  const withHash = raw.startsWith('#') ? raw : `#${raw}`;
  return isHexColor(withHash) ? withHash.toLowerCase() : fallback;
}

/**
 * Drawn as one path of rectangles rather than one element per module: a
 * version 40 code is 177×177, and 31,000 elements is a slow document.
 */
export interface SvgOptions {
  dark: string;
  light: string;
  margin: number;
  size: number;
  logo?: { href: string; percent: number } | undefined;
}

export function toSvg(matrix: QrMatrix, options: SvgOptions): string {
  const total = matrix.size + options.margin * 2;
  const commands: string[] = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let column = 0; column < matrix.size; column += 1) {
      if (matrix.modules[row]?.[column] !== true) continue;
      commands.push(`M${column + options.margin} ${row + options.margin}h1v1h-1z`);
    }
  }

  const logo = options.logo;
  const overlay =
    logo === undefined
      ? ''
      : (() => {
          const side = (total * logo.percent) / 100;
          const start = (total - side) / 2;
          const padding = side / 10;

          return [
            `<rect x="${start - padding}" y="${start - padding}"`,
            ` width="${side + padding * 2}" height="${side + padding * 2}"`,
            ` fill="${options.light}"/>`,
            `<image x="${start}" y="${start}" width="${side}" height="${side}"`,
            ` preserveAspectRatio="xMidYMid meet" href="${logo.href}"/>`,
          ].join('');
        })();

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${options.size}" height="${options.size}"`,
    ` viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges">`,
    `<rect width="${total}" height="${total}" fill="${options.light}"/>`,
    `<path fill="${options.dark}" d="${commands.join('')}"/>`,
    overlay,
    '</svg>',
  ].join('');
}

export function logoCoversTooMuch(percent: number, level: ErrorLevel): boolean {
  return percent > ERROR_LEVEL_RECOVERY[level];
}
