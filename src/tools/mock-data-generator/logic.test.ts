import { describe, expect, it } from 'vitest';

import { createRandom } from '@/lib/random';
import { THAI_LOCATIONS } from '@/tools/mock-data-generator/data';
import {
  FIELD_TYPES,
  MAX_COLUMNS,
  MAX_ROWS,
  clampRows,
  columnName,
  decodeColumns,
  emptyColumn,
  encodeColumns,
  escapeCsv,
  escapeSqlString,
  generateRows,
  isValidNationalId,
  makeNationalId,
  makePhone,
  makeRowContext,
  makeUuid,
  makeValue,
  nationalIdCheckDigit,
  quoteSqlIdentifier,
  splitList,
  toCsv,
  toJson,
  toSql,
  toSqlValue,
  type Column,
  type FieldType,
} from '@/tools/mock-data-generator/logic';

const SEED = 20260915;

function column(type: FieldType, overrides: Partial<Column> = {}): Column {
  return { ...emptyColumn('a', type), ...overrides };
}

function valueOf(type: FieldType, overrides: Partial<Column> = {}) {
  const random = createRandom(SEED);
  return makeValue(column(type, overrides), makeRowContext(random), random);
}

describe('Thai national id', () => {
  // Worked by hand so the weights and the modulus are pinned, not just the
  // function agreeing with itself: 1·13 + 1·12 + 0·11 + 1·10 + 7·9 + 0·8 + 0·7
  // + 6·6 + 4·5 + 1·4 + 1·3 + 6·2 = 173, and (11 − 173 mod 11) mod 10 = 3.
  it('computes the check digit the way the standard does', () => {
    expect(nationalIdCheckDigit('110170064116')).toBe(3);
    expect(isValidNationalId('1101700641163')).toBe(true);
  });

  it('counts the weights down from thirteen, not up', () => {
    // Reversing the weights would give a different digit for this one.
    expect(nationalIdCheckDigit('123456789012')).toBe(1);
  });

  it('generates ids that pass their own check', () => {
    const random = createRandom(SEED);
    for (let round = 0; round < 200; round += 1) {
      const id = makeNationalId(random);
      expect(id).toHaveLength(13);
      expect(isValidNationalId(id)).toBe(true);
    }
  });

  it('never starts with a zero, which no real id does', () => {
    const random = createRandom(SEED);
    for (let round = 0; round < 50; round += 1) {
      expect(makeNationalId(random).startsWith('0')).toBe(false);
    }
  });

  it('rejects an id with a digit changed', () => {
    const id = makeNationalId(createRandom(SEED));
    const broken = `${id.slice(0, 5)}${(Number(id[5]) + 1) % 10}${id.slice(6)}`;

    expect(isValidNationalId(broken)).toBe(false);
  });

  it('rejects anything that is not thirteen digits', () => {
    expect(isValidNationalId('123')).toBe(false);
    expect(isValidNationalId('abcdefghijklm')).toBe(false);
    expect(isValidNationalId('')).toBe(false);
  });
});

describe('phone numbers', () => {
  it('uses a prefix Thai mobiles actually have', () => {
    const random = createRandom(SEED);
    for (let round = 0; round < 100; round += 1) {
      const phone = makePhone(random);
      expect(phone).toHaveLength(10);
      expect(['06', '08', '09']).toContain(phone.slice(0, 2));
    }
  });
});

describe('uuid', () => {
  it('looks like a version 4 uuid', () => {
    const uuid = makeUuid(createRandom(SEED));
    expect(uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('gives a different one each draw', () => {
    const random = createRandom(SEED);
    const ids = new Set(Array.from({ length: 200 }, () => makeUuid(random)));
    expect(ids.size).toBe(200);
  });
});

describe('a row is one person', () => {
  it('puts the postcode with its own district', () => {
    const random = createRandom(SEED);
    const context = makeRowContext(random);
    const match = THAI_LOCATIONS.find(
      (location) => location.postcode === context.location.postcode,
    );

    expect(match?.district).toBe(context.location.district);
    expect(match?.province).toBe(context.location.province);
  });

  it('keeps every address column in a row agreeing with the others', () => {
    const [row] = generateRows(
      [
        column('province', { name: 'province' }),
        column('district', { name: 'district' }),
        column('postcode', { name: 'postcode' }),
        column('address', { name: 'address' }),
      ],
      1,
      SEED,
    );

    expect(row).toBeDefined();
    const address = String(row?.['address']);
    expect(address).toContain(String(row?.['province']));
    expect(address).toContain(String(row?.['district']));
    expect(address).toContain(String(row?.['postcode']));
  });

  it('builds the email out of the same person as the name column', () => {
    const [row] = generateRows(
      [column('english-name', { name: 'name' }), column('email', { name: 'email' })],
      1,
      SEED,
    );

    const [first = '', last = ''] = String(row?.['name']).toLowerCase().split(' ');
    expect(String(row?.['email'])).toContain(`${first}.${last}`);
  });
});

describe('field values', () => {
  it('produces something for every type it offers', () => {
    for (const type of FIELD_TYPES) {
      const value = valueOf(type, { values: 'a, b, c' });
      expect(['string', 'number', 'boolean']).toContain(typeof value);
    }
  });

  it('keeps a number inside the range given', () => {
    const random = createRandom(SEED);
    const field = column('number', { min: '10', max: '20' });

    for (let round = 0; round < 100; round += 1) {
      const value = makeValue(field, makeRowContext(random), random);
      expect(value).toBeGreaterThanOrEqual(10);
      expect(value).toBeLessThanOrEqual(20);
    }
  });

  it('copes with a range given backwards', () => {
    const value = valueOf('number', { min: '20', max: '10' });
    expect(value).toBeGreaterThanOrEqual(10);
    expect(value).toBeLessThanOrEqual(20);
  });

  it('keeps a date inside the range given', () => {
    const random = createRandom(SEED);
    const field = column('date', { min: '2026-01-01', max: '2026-01-31' });

    for (let round = 0; round < 50; round += 1) {
      const value = String(makeValue(field, makeRowContext(random), random));
      expect(value >= '2026-01-01').toBe(true);
      expect(value <= '2026-01-31').toBe(true);
    }
  });

  it('draws only from the list it was given', () => {
    const random = createRandom(SEED);
    const field = column('list', { values: 'แดง, เขียว, น้ำเงิน' });

    for (let round = 0; round < 50; round += 1) {
      expect(['แดง', 'เขียว', 'น้ำเงิน']).toContain(
        makeValue(field, makeRowContext(random), random),
      );
    }
  });

  it('returns nothing for a list with nothing in it', () => {
    expect(valueOf('list', { values: '   ' })).toBe('');
  });

  it('splits a list on commas or newlines', () => {
    expect(splitList('a, b\nc ,, d')).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('generateRows', () => {
  it('produces the number of rows asked for', () => {
    expect(generateRows([column('uuid', { name: 'id' })], 5, SEED)).toHaveLength(5);
  });

  it('repeats itself for the same seed', () => {
    const columns = [column('thai-name', { name: 'name' }), column('uuid', { name: 'id' })];
    expect(generateRows(columns, 10, SEED)).toEqual(generateRows(columns, 10, SEED));
  });

  it('gives different data for a different seed', () => {
    const columns = [column('uuid', { name: 'id' })];
    expect(generateRows(columns, 5, 1)).not.toEqual(generateRows(columns, 5, 2));
  });

  it('names an unnamed column rather than writing an empty header', () => {
    expect(columnName(column('uuid'), 2)).toBe('column_3');
    expect(columnName(column('uuid', { name: ' id ' }), 0)).toBe('id');
  });
});

// The part the user warned about: a field with a comma or a quote in it.
describe('CSV escaping', () => {
  it('leaves a plain value alone', () => {
    expect(escapeCsv('somchai')).toBe('somchai');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsv('Bangkok, Thailand')).toBe('"Bangkok, Thailand"');
  });

  it('doubles the quotes inside a quoted value', () => {
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
  });

  it('quotes a value containing a newline', () => {
    expect(escapeCsv('line one\nline two')).toBe('"line one\nline two"');
    expect(escapeCsv('carriage\rreturn')).toContain('"');
  });

  it('writes numbers and booleans without quotes', () => {
    expect(escapeCsv(42)).toBe('42');
    expect(escapeCsv(true)).toBe('true');
  });

  it('escapes a header the same way as a value', () => {
    const csv = toCsv([{ 'a,b': 'x' }], ['a,b']);
    expect(csv.split('\n')[0]).toBe('"a,b"');
  });

  it('survives a round trip through a minimal reader', () => {
    const rows = [{ note: 'a "quoted", comma' }, { note: 'plain' }];
    const csv = toCsv(rows, ['note']);
    const lines = csv.split('\n');

    expect(lines).toHaveLength(3);
    expect(lines[1]).toBe('"a ""quoted"", comma"');
  });

  it('does not let a value break out into a new column', () => {
    const csv = toCsv([{ a: 'x,y', b: 'z' }], ['a', 'b']);
    // Three commas would mean the value split the row.
    expect(csv.split('\n')[1]?.match(/,/g)).toHaveLength(2);
  });
});

describe('SQL escaping', () => {
  it('wraps a string in quotes', () => {
    expect(escapeSqlString('somchai')).toBe("'somchai'");
  });

  it('doubles an embedded quote rather than ending the string', () => {
    expect(escapeSqlString("O'Brien")).toBe("'O''Brien'");
  });

  it('neutralises an attempt to close the statement', () => {
    const value = toSqlValue("'); DROP TABLE users; --");
    expect(value).toBe("'''); DROP TABLE users; --'");
    expect(value.slice(1, -1).match(/'/g)?.length).toBe(2);
  });

  it('writes numbers and booleans unquoted', () => {
    expect(toSqlValue(42)).toBe('42');
    expect(toSqlValue(true)).toBe('TRUE');
    expect(toSqlValue(false)).toBe('FALSE');
  });

  it('quotes an identifier that is not a plain word', () => {
    expect(quoteSqlIdentifier('users')).toBe('users');
    expect(quoteSqlIdentifier('user table')).toBe('"user table"');
    expect(quoteSqlIdentifier('ชื่อ')).toBe('"ชื่อ"');
  });

  it('writes one statement per row', () => {
    const sql = toSql([{ a: 1 }, { a: 2 }], ['a'], 'users');
    const lines = sql.split('\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('INSERT INTO users (a) VALUES (1);');
  });

  it('falls back to a table name rather than writing an empty one', () => {
    expect(toSql([{ a: 1 }], ['a'], '  ')).toContain('INSERT INTO mock_data');
  });
});

describe('JSON export', () => {
  it('writes an array of objects', () => {
    const json = JSON.parse(toJson([{ a: 1, b: 'x' }]));
    expect(json).toEqual([{ a: 1, b: 'x' }]);
  });

  it('keeps types rather than turning everything into strings', () => {
    const json = JSON.parse(toJson([{ n: 1, b: true, s: 'x' }]));
    expect(typeof json[0].n).toBe('number');
    expect(typeof json[0].b).toBe('boolean');
  });

  it('escapes Thai text safely', () => {
    expect(JSON.parse(toJson([{ name: 'สมชาย' }]))[0].name).toBe('สมชาย');
  });
});

describe('limits and the link', () => {
  it('never generates more rows than it will hand back', () => {
    expect(clampRows(MAX_ROWS + 1)).toBe(MAX_ROWS);
    expect(clampRows(0)).toBe(1);
    expect(clampRows(Number.NaN)).toBeGreaterThan(0);
  });

  it('round-trips columns', () => {
    const columns = [
      column('number', { id: 'a', name: 'อายุ', min: '1', max: '99' }),
      column('list', { id: 'b', name: 'สี', values: 'แดง, เขียว' }),
    ];
    const back = decodeColumns(encodeColumns(columns));

    expect(back).toHaveLength(2);
    expect(back[0]).toMatchObject({ name: 'อายุ', type: 'number', min: '1' });
    expect(back[1]).toMatchObject({ values: 'แดง, เขียว' });
  });

  it('ignores a link that was tampered with', () => {
    expect(decodeColumns('not json')).toEqual([]);
    expect(decodeColumns('[["a","not-a-type","","",""]]')).toEqual([]);
    expect(decodeColumns('[[1,2,3,4,5]]')).toEqual([]);
  });

  it('never decodes more columns than it will render', () => {
    const many = JSON.stringify(
      Array.from({ length: MAX_COLUMNS + 5 }, () => ['x', 'uuid', '', '', '']),
    );
    expect(decodeColumns(many)).toHaveLength(MAX_COLUMNS);
  });
});
