'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldHint, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { downloadText } from '@/lib/download';
import { drawSeed } from '@/lib/random';
import { THAI_LOCATIONS } from '@/tools/mock-data-generator/data';
import { messages } from '@/tools/mock-data-generator/i18n';
import {
  DEFAULT_ROWS,
  FIELD_TYPES,
  FORMATS,
  LARGE_ROWS,
  MAX_COLUMNS,
  MAX_ROWS,
  PREVIEW_ROWS,
  clampRows,
  columnName,
  decodeColumns,
  emptyColumn,
  encodeColumns,
  generateRows,
  toCsv,
  toJson,
  toSql,
  type Column,
  type ExportFormat,
  type FieldType,
} from '@/tools/mock-data-generator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_COLUMNS_KEY = 'c';
const URL_ROWS_KEY = 'n';
const URL_FORMAT_KEY = 'f';
const URL_TABLE_KEY = 't';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 2_000;

const RANGE_TYPES: readonly FieldType[] = ['date', 'number'];
const MIME_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv',
  json: 'application/json',
  sql: 'application/sql',
};

const DEFAULT_COLUMNS: ReadonlyArray<[string, FieldType]> = [
  ['id', 'uuid'],
  ['name', 'thai-name'],
  ['email', 'email'],
  ['phone', 'phone'],
];

function readFormat(raw: string | undefined): ExportFormat {
  return FORMATS.includes(raw as ExportFormat) ? (raw as ExportFormat) : 'csv';
}

export default function MockDataGenerator({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_COLUMNS_KEY]: searchParams[URL_COLUMNS_KEY] ?? '',
      [URL_ROWS_KEY]: searchParams[URL_ROWS_KEY] ?? String(DEFAULT_ROWS),
      [URL_FORMAT_KEY]: readFormat(searchParams[URL_FORMAT_KEY]) as string,
      [URL_TABLE_KEY]: searchParams[URL_TABLE_KEY] ?? 'users',
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const outputFormat = readFormat(urlState[URL_FORMAT_KEY]);
  const table = urlState[URL_TABLE_KEY];
  const rowCount = clampRows(Number(urlState[URL_ROWS_KEY]));

  const columns = useMemo(() => {
    const decoded = decodeColumns(urlState[URL_COLUMNS_KEY]);
    if (decoded.length > 0) return decoded;

    return DEFAULT_COLUMNS.map(([name, type], index) => ({
      ...emptyColumn(`default-${index}`, type),
      name,
    }));
  }, [urlState]);

  // Drawn by the button, never while rendering: the server and the browser
  // would pick different numbers and disagree about every row.
  const [seed, setSeed] = useState<number | null>(null);
  const [seedField, setSeedField] = useState('');

  const fieldId = useId();
  const rowsId = useId();
  const seedId = useId();
  const tableId = useId();

  const typedSeed = Number(seedField.trim());
  const activeSeed =
    seedField.trim().length > 0 && Number.isFinite(typedSeed)
      ? Math.floor(Math.abs(typedSeed))
      : seed;

  const rows = useMemo(
    () => (activeSeed === null ? [] : generateRows(columns, rowCount, activeSeed)),
    [activeSeed, columns, rowCount],
  );

  const headers = columns.map((column, index) => columnName(column, index));

  const output = useMemo(() => {
    if (rows.length === 0) return '';
    if (outputFormat === 'csv') return toCsv(rows, headers);
    if (outputFormat === 'json') return toJson(rows);
    return toSql(rows, headers, table);
  }, [headers, outputFormat, rows, table]);

  const typeLabels: Record<FieldType, string> = {
    'thai-name': t.typeThaiName,
    'english-name': t.typeEnglishName,
    email: t.typeEmail,
    phone: t.typePhone,
    'national-id': t.typeNationalId,
    province: t.typeProvince,
    district: t.typeDistrict,
    subdistrict: t.typeSubdistrict,
    postcode: t.typePostcode,
    address: t.typeAddress,
    date: t.typeDate,
    number: t.typeNumber,
    boolean: t.typeBoolean,
    uuid: t.typeUuid,
    text: t.typeText,
    list: t.typeList,
  };

  function writeColumns(next: Column[]) {
    setUrlState({ [URL_COLUMNS_KEY]: encodeColumns(next) });
  }

  function updateColumn(id: string, patch: Partial<Column>) {
    writeColumns(columns.map((each) => (each.id === id ? { ...each, ...patch } : each)));
  }

  const previewRows = rows.slice(0, PREVIEW_ROWS);

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.columns}</h2>
          <span className="text-sm text-muted">
            {format(t.maxColumns, { count: MAX_COLUMNS })}
          </span>
        </div>

        {columns.length === 0 ? (
          <p className="text-sm text-muted">{t.noColumns}</p>
        ) : null}

        <ul className="flex flex-col gap-3">
          {columns.map((column, index) => (
            <li
              key={column.id}
              className="flex flex-wrap items-end gap-3 rounded-card border border-border bg-surface p-3"
            >
              <div className="flex min-w-40 flex-1 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-${column.id}-name`}>{t.columnName}</Label>
                <Input
                  id={`${fieldId}-${column.id}-name`}
                  value={column.name}
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={columnName(column, index)}
                  onChange={(event) =>
                    updateColumn(column.id, { name: event.target.value })
                  }
                />
              </div>

              <div className="flex min-w-44 flex-col gap-1.5">
                <Label htmlFor={`${fieldId}-${column.id}-type`}>{t.columnType}</Label>
                <Select
                  id={`${fieldId}-${column.id}-type`}
                  value={column.type}
                  onChange={(event) =>
                    updateColumn(column.id, { type: event.target.value as FieldType })
                  }
                >
                  {FIELD_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </Select>
              </div>

              {RANGE_TYPES.includes(column.type) ? (
                <>
                  <div className="flex w-32 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${column.id}-min`}>{t.rangeFrom}</Label>
                    <Input
                      id={`${fieldId}-${column.id}-min`}
                      value={column.min}
                      type={column.type === 'date' ? 'date' : 'text'}
                      inputMode={column.type === 'number' ? 'numeric' : undefined}
                      autoComplete="off"
                      onChange={(event) =>
                        updateColumn(column.id, { min: event.target.value })
                      }
                    />
                  </div>

                  <div className="flex w-32 flex-col gap-1.5">
                    <Label htmlFor={`${fieldId}-${column.id}-max`}>{t.rangeTo}</Label>
                    <Input
                      id={`${fieldId}-${column.id}-max`}
                      value={column.max}
                      type={column.type === 'date' ? 'date' : 'text'}
                      inputMode={column.type === 'number' ? 'numeric' : undefined}
                      autoComplete="off"
                      onChange={(event) =>
                        updateColumn(column.id, { max: event.target.value })
                      }
                    />
                  </div>
                </>
              ) : null}

              {column.type === 'list' ? (
                <div className="flex min-w-60 flex-1 flex-col gap-1.5">
                  <Label htmlFor={`${fieldId}-${column.id}-values`}>{t.listValues}</Label>
                  <Textarea
                    id={`${fieldId}-${column.id}-values`}
                    value={column.values}
                    spellCheck={false}
                    onChange={(event) =>
                      updateColumn(column.id, { values: event.target.value })
                    }
                    className="min-h-10"
                  />
                </div>
              ) : null}

              <Button
                variant="ghost"
                size="icon"
                aria-label={format(t.removeColumn, {
                  name: column.name || t.unnamed,
                })}
                onClick={() =>
                  writeColumns(columns.filter((other) => other.id !== column.id))
                }
              >
                ×
              </Button>
            </li>
          ))}
        </ul>

        <div>
          <Button
            variant="secondary"
            size="sm"
            disabled={columns.length >= MAX_COLUMNS}
            onClick={() =>
              writeColumns([...columns, emptyColumn(`new-${columns.length}`)])
            }
          >
            {t.addColumn}
          </Button>
        </div>
      </section>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex w-32 flex-col gap-1.5">
          <Label htmlFor={rowsId}>{t.rows}</Label>
          <Input
            id={rowsId}
            value={urlState[URL_ROWS_KEY]}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) => setUrlState({ [URL_ROWS_KEY]: event.target.value })}
            className="text-right font-mono"
          />
        </div>

        <div className="flex w-40 flex-col gap-1.5">
          <Label htmlFor={seedId}>{t.seed}</Label>
          <Input
            id={seedId}
            value={seedField}
            inputMode="numeric"
            autoComplete="off"
            placeholder={t.seedPlaceholder}
            onChange={(event) => setSeedField(event.target.value)}
            className="font-mono"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t.format}</span>
          <Toggle
            label={t.format}
            value={outputFormat}
            onChange={(next) => setUrlState({ [URL_FORMAT_KEY]: next })}
            options={FORMATS.map((value) => ({
              value,
              label: value.toUpperCase(),
            }))}
          />
        </div>

        {outputFormat === 'sql' ? (
          <div className="flex w-40 flex-col gap-1.5">
            <Label htmlFor={tableId}>{t.tableName}</Label>
            <Input
              id={tableId}
              value={table}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setUrlState({ [URL_TABLE_KEY]: event.target.value })}
              className="font-mono"
            />
          </div>
        ) : null}

        <Button onClick={() => setSeed(drawSeed())}>{t.generate}</Button>
      </div>

      <FieldHint>{format(t.maxRows, { count: MAX_ROWS })}</FieldHint>
      <FieldHint>{t.seedHint}</FieldHint>
      {rowCount >= LARGE_ROWS ? (
        <p role="status" className="text-sm text-danger">
          {t.manyRows}
        </p>
      ) : null}

      {output.length === 0 ? (
        <p className="text-sm text-muted">{t.waiting}</p>
      ) : (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">
              {format(t.preview, { shown: previewRows.length, total: rows.length })}
            </Badge>

            <div className="ml-auto flex gap-2">
              <CopyButton value={output} label={t.copy} variant="secondary" size="sm" showLabel />
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  downloadText(
                    output,
                    `mock-data.${outputFormat}`,
                    MIME_TYPES[outputFormat],
                  )
                }
              >
                {t.download}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-card border border-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-subtle">
                <tr>
                  {headers.map((header) => (
                    <th key={header} className="px-3 py-2 font-medium whitespace-nowrap">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, index) => (
                  <tr key={index} className="border-t border-border">
                    {headers.map((header) => (
                      <td key={header} className="px-3 py-2 whitespace-nowrap">
                        {String(row[header])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <pre className="max-h-72 overflow-auto rounded-card border border-border bg-surface p-3 font-mono text-xs">
            {output.slice(0, 4000)}
          </pre>
        </section>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <FieldHint>{t.idNote}</FieldHint>
        <FieldHint>
          {format(t.addressNote, { count: THAI_LOCATIONS.length })}
        </FieldHint>
        <FieldHint>{outputFormat === 'sql' ? t.sqlNote : t.csvNote}</FieldHint>
      </div>
    </div>
  );
}
