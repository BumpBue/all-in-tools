const QUOTE = '"';
const COMMA = ',';
const TAB = '\t';

export interface ImportedCard {
  front: string;
  back: string;
}

/**
 * RFC 4180 in the other direction: a quoted field may hold commas, newlines and
 * doubled quotes. Splitting on commas would tear apart any card whose front
 * contains one, which for a vocabulary deck is most of them.
 *
 * A tab is accepted as the separator too, because that is what a spreadsheet
 * puts on the clipboard.
 */
export function parseDelimited(text: string): ImportedCard[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let index = 0;

  const endField = () => {
    row.push(field);
    field = '';
  };

  const endRow = () => {
    endField();
    if (row.some((value) => value.trim().length > 0)) rows.push(row);
    row = [];
  };

  while (index < text.length) {
    const character = text[index];

    if (quoted) {
      if (character === QUOTE) {
        if (text[index + 1] === QUOTE) {
          field += QUOTE;
          index += 2;
          continue;
        }
        quoted = false;
        index += 1;
        continue;
      }

      field += character;
      index += 1;
      continue;
    }

    if (character === QUOTE && field.length === 0) {
      quoted = true;
      index += 1;
      continue;
    }

    if (character === COMMA || character === TAB) {
      endField();
      index += 1;
      continue;
    }

    if (character === '\r') {
      index += 1;
      continue;
    }

    if (character === '\n') {
      endRow();
      index += 1;
      continue;
    }

    field += character;
    index += 1;
  }

  if (field.length > 0 || row.length > 0) endRow();

  return rows.map((values) => ({
    front: (values[0] ?? '').trim(),
    back: (values[1] ?? '').trim(),
  }));
}
