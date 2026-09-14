import { describe, expect, it } from 'vitest';

import {
  ERROR_LEVELS,
  ERROR_LEVEL_RECOVERY,
  MAX_CONTENT_LENGTH,
  buildMatrix,
  buildPromptPay,
  buildText,
  buildVCard,
  buildWifi,
  crc16,
  escapeWifi,
  isHexColor,
  logoCoversTooMuch,
  normalizePromptPayId,
  readColor,
  toSvg,
  type VCardInput,
} from '@/tools/qr-generator/logic';

function payload(result: ReturnType<typeof buildText>): string {
  if (!result.ok) throw new Error(`expected a payload, got ${result.code}`);
  return result.payload;
}

const CARD: VCardInput = {
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  organization: '',
  title: '',
  phone: '',
  email: '',
  url: '',
  address: '',
  note: '',
};

describe('crc16', () => {
  // The check value every CRC-16/CCITT-FALSE implementation is measured by.
  it('gives 0x29B1 for "123456789"', () => {
    expect(crc16('123456789')).toBe(0x29b1);
  });

  it('gives a different checksum for a changed byte', () => {
    expect(crc16('123456788')).not.toBe(crc16('123456789'));
  });

  it('stays inside sixteen bits', () => {
    for (const text of ['', 'a', 'ทดสอบ', '0'.repeat(200)]) {
      expect(crc16(text)).toBeGreaterThanOrEqual(0);
      expect(crc16(text)).toBeLessThanOrEqual(0xffff);
    }
  });
});

describe('PromptPay', () => {
  it('turns a Thai mobile number into the thirteen digit field', () => {
    expect(normalizePromptPayId('0812345678', 'phone')).toBe('0066812345678');
  });

  it('accepts the number however it was typed', () => {
    for (const written of ['081-234-5678', '081 234 5678', '66812345678']) {
      expect(normalizePromptPayId(written, 'phone')).toBe('0066812345678');
    }
  });

  it('refuses a number that is not the right length', () => {
    expect(normalizePromptPayId('08123456', 'phone')).toBeNull();
    expect(normalizePromptPayId('081234567890', 'phone')).toBeNull();
  });

  it('takes a national id of exactly thirteen digits', () => {
    expect(normalizePromptPayId('1234567890123', 'national-id')).toBe('1234567890123');
    expect(normalizePromptPayId('123456789012', 'national-id')).toBeNull();
  });

  it('takes an e-wallet id of exactly fifteen digits', () => {
    expect(normalizePromptPayId('123456789012345', 'ewallet')).toBe('123456789012345');
    expect(normalizePromptPayId('1234567890123', 'ewallet')).toBeNull();
  });

  it('writes the tags in the order the standard puts them', () => {
    const built = payload(
      buildPromptPay({ target: 'phone', id: '0812345678', amount: '' }),
    );

    expect(built.startsWith('000201')).toBe(true);
    expect(built).toContain('0016A000000677010111');
    expect(built).toContain('5303764');
    expect(built).toContain('5802TH');
  });

  it('marks a code without an amount as static and one with an amount as dynamic', () => {
    const noAmount = payload(
      buildPromptPay({ target: 'phone', id: '0812345678', amount: '' }),
    );
    const withAmount = payload(
      buildPromptPay({ target: 'phone', id: '0812345678', amount: '100' }),
    );

    expect(noAmount).toContain('010211');
    expect(withAmount).toContain('010212');
    expect(withAmount).toContain('5406100.00');
  });

  it('writes the amount to two decimal places', () => {
    const built = payload(
      buildPromptPay({ target: 'phone', id: '0812345678', amount: '1234.5' }),
    );
    expect(built).toContain('54071234.50');
  });

  it('ends with a checksum that covers everything before it', () => {
    const built = payload(
      buildPromptPay({ target: 'phone', id: '0812345678', amount: '' }),
    );

    const body = built.slice(0, -4);
    const checksum = built.slice(-4);

    expect(body.endsWith('6304')).toBe(true);
    expect(checksum).toBe(crc16(body).toString(16).toUpperCase().padStart(4, '0'));
  });

  it('changes the checksum when the amount changes', () => {
    const one = payload(buildPromptPay({ target: 'phone', id: '0812345678', amount: '1' }));
    const two = payload(buildPromptPay({ target: 'phone', id: '0812345678', amount: '2' }));

    expect(one.slice(-4)).not.toBe(two.slice(-4));
  });

  it('refuses an id it cannot make sense of', () => {
    expect(buildPromptPay({ target: 'phone', id: 'abc', amount: '' })).toEqual({
      ok: false,
      code: 'bad-promptpay-id',
    });
  });

  it('refuses an amount that is not a positive number', () => {
    for (const amount of ['-5', '0', 'สิบบาท']) {
      expect(
        buildPromptPay({ target: 'phone', id: '0812345678', amount }),
      ).toMatchObject({ code: 'bad-amount' });
    }
  });
});

describe('WiFi', () => {
  it('writes the fields a phone expects', () => {
    const built = payload(
      buildWifi({ ssid: 'MyNet', password: 'secret', security: 'WPA', hidden: false }),
    );

    expect(built).toBe('WIFI:T:WPA;S:MyNet;P:secret;;');
  });

  it('leaves the password out of an open network', () => {
    const built = payload(
      buildWifi({ ssid: 'Free', password: 'ignored', security: 'nopass', hidden: false }),
    );

    expect(built).not.toContain('ignored');
    expect(built).toContain('T:nopass');
  });

  it('marks a hidden network', () => {
    const built = payload(
      buildWifi({ ssid: 'Hidden', password: 'x', security: 'WPA', hidden: true }),
    );
    expect(built).toContain('H:true');
  });

  it('escapes the characters the format uses as syntax', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f');
  });

  it('escapes a password containing a semicolon, which would otherwise end it', () => {
    const built = payload(
      buildWifi({ ssid: 'Net', password: 'pa;ss', security: 'WPA', hidden: false }),
    );
    expect(built).toContain('P:pa\\;ss');
  });

  it('keeps a Thai network name intact', () => {
    const built = payload(
      buildWifi({ ssid: 'บ้านเรา', password: 'x', security: 'WPA', hidden: false }),
    );
    expect(built).toContain('S:บ้านเรา');
  });

  it('refuses a network with no name', () => {
    expect(
      buildWifi({ ssid: '  ', password: 'x', security: 'WPA', hidden: false }),
    ).toEqual({ ok: false, code: 'no-ssid' });
  });
});

describe('vCard', () => {
  it('opens and closes the card', () => {
    const built = payload(buildVCard(CARD));

    expect(built.startsWith('BEGIN:VCARD')).toBe(true);
    expect(built.endsWith('END:VCARD')).toBe(true);
    expect(built).toContain('VERSION:3.0');
  });

  it('separates lines with CRLF, which strict readers require', () => {
    expect(payload(buildVCard(CARD))).toContain('\r\n');
  });

  it('writes both the structured and the display name', () => {
    const built = payload(buildVCard(CARD));

    expect(built).toContain('N:ใจดี;สมชาย;;;');
    expect(built).toContain('FN:สมชาย ใจดี');
  });

  it('leaves out the fields that were not filled in', () => {
    const built = payload(buildVCard(CARD));

    expect(built).not.toContain('ORG:');
    expect(built).not.toContain('TEL');
  });

  it('includes the fields that were', () => {
    const built = payload(
      buildVCard({ ...CARD, organization: 'Toolbox', phone: '0812345678' }),
    );

    expect(built).toContain('ORG:Toolbox');
    expect(built).toContain('TEL;TYPE=CELL:0812345678');
  });

  it('refuses a card with no name at all', () => {
    expect(buildVCard({ ...CARD, firstName: '', lastName: '' })).toEqual({
      ok: false,
      code: 'no-name',
    });
  });

  it('accepts a card with only one of the two names', () => {
    expect(buildVCard({ ...CARD, lastName: '' })).toMatchObject({ ok: true });
  });
});

describe('buildText', () => {
  it('passes the text through', () => {
    expect(payload(buildText('https://example.com'))).toBe('https://example.com');
  });

  it('refuses nothing', () => {
    expect(buildText('   ')).toEqual({ ok: false, code: 'empty' });
  });

  it('refuses more than a QR code can hold', () => {
    expect(buildText('a'.repeat(MAX_CONTENT_LENGTH + 1))).toEqual({
      ok: false,
      code: 'too-long',
    });
  });
});

describe('buildMatrix', () => {
  it('produces a square of modules', () => {
    const matrix = buildMatrix('hello', 'M');

    expect(matrix.size).toBeGreaterThan(0);
    expect(matrix.modules).toHaveLength(matrix.size);
    expect(matrix.modules[0]).toHaveLength(matrix.size);
  });

  it('puts a finder pattern in three corners', () => {
    const { modules, size } = buildMatrix('hello', 'M');
    const corners = [
      [0, 0],
      [0, size - 7],
      [size - 7, 0],
    ] as const;

    for (const [row, column] of corners) {
      expect(modules[row]?.[column]).toBe(true);
      expect(modules[row + 1]?.[column + 1]).toBe(false);
      expect(modules[row + 3]?.[column + 3]).toBe(true);
    }
  });

  it('leaves the fourth corner without one', () => {
    const { modules, size } = buildMatrix('hello', 'M');
    const bottomRight = modules[size - 4]?.[size - 4];
    const topLeft = modules[3]?.[3];

    expect(topLeft).toBe(true);
    expect(bottomRight).not.toBe(undefined);
  });

  it('grows as the content grows', () => {
    const small = buildMatrix('hi', 'M').size;
    const large = buildMatrix('x'.repeat(400), 'M').size;

    expect(large).toBeGreaterThan(small);
  });

  it('needs more room at a higher correction level', () => {
    expect(buildMatrix('x'.repeat(100), 'H').size).toBeGreaterThanOrEqual(
      buildMatrix('x'.repeat(100), 'L').size,
    );
  });

  it('encodes Thai text as UTF-8 rather than mangling it', () => {
    // Latin-1 would throw away the high bytes and give a smaller code.
    const thai = buildMatrix('สวัสดีครับ', 'M');
    const ascii = buildMatrix('hello', 'M');

    expect(thai.size).toBeGreaterThanOrEqual(ascii.size);
    expect(() => buildMatrix('สวัสดีครับ', 'H')).not.toThrow();
  });

  it('offers the four correction levels, strongest last', () => {
    expect(ERROR_LEVELS).toEqual(['L', 'M', 'Q', 'H']);
    expect(ERROR_LEVEL_RECOVERY.H).toBeGreaterThan(ERROR_LEVEL_RECOVERY.L);
  });
});

describe('toSvg', () => {
  const matrix = buildMatrix('hello', 'M');

  it('is a complete document at the size asked for', () => {
    const svg = toSvg(matrix, { dark: '#000000', light: '#ffffff', margin: 4, size: 512 });

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
    expect(svg).toContain('width="512"');
  });

  it('leaves the quiet zone the standard asks for', () => {
    const svg = toSvg(matrix, { dark: '#000000', light: '#ffffff', margin: 4, size: 512 });
    expect(svg).toContain(`viewBox="0 0 ${matrix.size + 8} ${matrix.size + 8}"`);
  });

  it('carries the colours it was given', () => {
    const svg = toSvg(matrix, { dark: '#123456', light: '#abcdef', margin: 4, size: 256 });

    expect(svg).toContain('#123456');
    expect(svg).toContain('#abcdef');
  });

  it('draws one path rather than thousands of rectangles', () => {
    const svg = toSvg(matrix, { dark: '#000000', light: '#ffffff', margin: 4, size: 256 });
    expect(svg.match(/<path/g)).toHaveLength(1);
  });

  it('carries no logo unless one was given', () => {
    const svg = toSvg(matrix, { dark: '#000000', light: '#ffffff', margin: 4, size: 256 });
    expect(svg).not.toContain('<image');
  });

  it('centres a logo and clears the modules behind it', () => {
    const svg = toSvg(matrix, {
      dark: '#000000',
      light: '#ffffff',
      margin: 4,
      size: 256,
      logo: { href: 'data:image/png;base64,AAA', percent: 20 },
    });

    expect(svg).toContain('<image');
    expect(svg).toContain('data:image/png;base64,AAA');
    expect(svg.match(/<rect/g)).toHaveLength(2);
  });
});

describe('colours', () => {
  it('accepts a six digit hex colour', () => {
    expect(isHexColor('#0af0af')).toBe(true);
    expect(isHexColor('#fff')).toBe(false);
    expect(isHexColor('red')).toBe(false);
  });

  it('reads a colour from a link with or without the hash', () => {
    expect(readColor('112233', '#000000')).toBe('#112233');
    expect(readColor('#AABBCC', '#000000')).toBe('#aabbcc');
  });

  it('falls back when the link holds nonsense', () => {
    expect(readColor('not-a-colour', '#000000')).toBe('#000000');
    expect(readColor(undefined, '#ffffff')).toBe('#ffffff');
  });
});

describe('logoCoversTooMuch', () => {
  it('warns when the logo eats more than the level can spare', () => {
    expect(logoCoversTooMuch(20, 'L')).toBe(true);
    expect(logoCoversTooMuch(20, 'H')).toBe(false);
  });
});
