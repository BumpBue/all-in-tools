'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useT } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import {
  buildUrl,
  decode,
  differsBetweenModes,
  encode,
  parseUrl,
  spaceEncoding,
  type EncodeMode,
  type QueryParam,
  type UrlParts,
} from '@/tools/url-encoder/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_TEXT_KEY = 't';
const URL_SIDE_KEY = 's';
const URL_MODE_KEY = 'm';
const URL_TARGET_KEY = 'u';
const URL_PLUS_KEY = 'p';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 1200;

const ICON_SIZE = 16;
const ON = '1';

type Side = 'plain' | 'encoded';

function readSide(raw: string | undefined): Side {
  return raw === 'encoded' ? 'encoded' : 'plain';
}

function readMode(raw: string | undefined): EncodeMode {
  return raw === 'uri' ? 'uri' : 'component';
}

export default function UrlEncoder({ searchParams }: ToolComponentProps) {
  const t = useT().urlEncoder;

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_TEXT_KEY]: searchParams[URL_TEXT_KEY] ?? '',
      [URL_SIDE_KEY]: readSide(searchParams[URL_SIDE_KEY]) as string,
      [URL_MODE_KEY]: readMode(searchParams[URL_MODE_KEY]) as string,
      [URL_TARGET_KEY]: searchParams[URL_TARGET_KEY] ?? '',
      [URL_PLUS_KEY]: searchParams[URL_PLUS_KEY] === ON ? ON : '',
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const side = readSide(urlState[URL_SIDE_KEY]);
  const mode = readMode(urlState[URL_MODE_KEY]);
  const typed = urlState[URL_TEXT_KEY];
  const target = urlState[URL_TARGET_KEY];
  const plusAsSpace = urlState[URL_PLUS_KEY] === ON;

  const plainId = useId();
  const encodedId = useId();
  const urlId = useId();
  const errorId = useId();

  const decoded = side === 'encoded' ? decode(typed) : null;
  const plain = side === 'plain' ? typed : decoded?.ok ? decoded.value : '';
  const encoded = side === 'plain' ? encode(typed, mode) : typed;
  const decodeError = decoded && !decoded.ok && typed.length > 0 ? t.errorMalformed : null;

  const parsed = useMemo(() => parseUrl(target, plusAsSpace), [plusAsSpace, target]);
  const [edited, setEdited] = useState<QueryParam[] | null>(null);

  const params = edited ?? parsed?.params ?? [];
  const parts: UrlParts | null = parsed?.parts ?? null;
  const rebuilt = parts ? buildUrl(parts, params, plusAsSpace) : '';

  function edit(nextSide: Side, value: string) {
    setUrlState({ [URL_TEXT_KEY]: value, [URL_SIDE_KEY]: nextSide });
  }

  // Editing a row replaces the whole list, so a later change to the URL field
  // starts from the URL again rather than from a stale edit.
  function updateParams(next: QueryParam[]) {
    setEdited(next);
    if (parts) setUrlState({ [URL_TARGET_KEY]: buildUrl(parts, next, plusAsSpace) });
  }

  function changeTarget(value: string) {
    setEdited(null);
    setUrlState({ [URL_TARGET_KEY]: value });
  }

  function clearAll() {
    setEdited(null);
    setUrlState({
      [URL_TEXT_KEY]: '',
      [URL_SIDE_KEY]: 'plain',
      [URL_TARGET_KEY]: '',
    });
  }

  const modeOptions: ReadonlyArray<ToggleOption<EncodeMode>> = [
    { value: 'component', label: t.modeComponent },
    { value: 'uri', label: t.modeUri },
  ];

  const partRows: Array<[string, string]> = parts
    ? [
        [t.partProtocol, parts.protocol],
        [t.partHost, parts.host],
        [t.partPath, parts.path],
        [t.partQuery, parts.query],
        [t.partHash, parts.hash],
      ].filter((row): row is [string, string] => row[1].length > 0)
    : [];

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-4">
        <h2 className="text-base font-semibold">{t.convert}</h2>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{t.mode}</span>
          <Toggle
            options={modeOptions}
            value={mode}
            onChange={(next) => setUrlState({ [URL_MODE_KEY]: next })}
            label={t.mode}
          />
          {differsBetweenModes(plain) ? (
            <Badge tone="accent">{t.modeDiffers}</Badge>
          ) : null}
        </div>

        <p className="text-sm text-muted">{t.modeHint}</p>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={plainId}>{t.plain}</Label>
              <CopyButton value={plain} variant="secondary" size="icon" />
            </div>
            <Textarea
              id={plainId}
              value={plain}
              onChange={(event) => edit('plain', event.target.value)}
              spellCheck={false}
              autoComplete="off"
              className="min-h-32"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor={encodedId}>{t.encoded}</Label>
              <CopyButton value={encoded} variant="secondary" size="icon" />
            </div>
            <Textarea
              id={encodedId}
              value={encoded}
              onChange={(event) => edit('encoded', event.target.value)}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={decodeError ? true : undefined}
              aria-describedby={decodeError ? errorId : undefined}
              className="min-h-32 font-mono text-sm"
            />
            <p id={errorId}>
              <FieldError>{decodeError ?? undefined}</FieldError>
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 border-t border-border pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t.inspector}</h2>
          <p className="text-sm text-muted">{t.inspectorHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={urlId}>{t.url}</Label>
          <Input
            id={urlId}
            value={target}
            placeholder={t.urlPlaceholder}
            onChange={(event) => changeTarget(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            inputMode="url"
            className="font-mono text-sm"
          />
        </div>

        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={plusAsSpace}
            onChange={(event) =>
              setUrlState({ [URL_PLUS_KEY]: event.target.checked ? ON : '' })
            }
          />
          {t.plusAsSpace}
        </label>
        <p className="text-sm text-muted">
          {format(t.plusHint, { space: spaceEncoding(plusAsSpace) })}
        </p>

        {target.trim().length > 0 && !parsed ? (
          <FieldError>{t.errorNotUrl}</FieldError>
        ) : null}

        {parsed ? (
          <>
            {parsed.relative ? <Badge tone="muted">{t.relative}</Badge> : null}

            <dl className="grid gap-2 rounded-card border border-border bg-surface p-4 sm:grid-cols-[8rem_1fr]">
              {partRows.map(([label, value]) => (
                <div key={label} className="contents">
                  <dt className="text-sm text-muted">{label}</dt>
                  <dd className="min-w-0 break-all font-mono text-sm">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{t.params}</h3>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    updateParams([...params, { key: '', value: '', hasValue: true }])
                  }
                >
                  <Plus size={ICON_SIZE} aria-hidden />
                  {t.paramAdd}
                </Button>
              </div>

              {params.length === 0 ? (
                <p className="text-sm text-muted">{t.paramsEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {params.map((param, index) => (
                    <li key={index} className="flex flex-wrap items-center gap-2">
                      <Input
                        value={param.key}
                        aria-label={t.paramKey}
                        onChange={(event) =>
                          updateParams(
                            params.map((row, position) =>
                              position === index
                                ? { ...row, key: event.target.value }
                                : row,
                            ),
                          )
                        }
                        spellCheck={false}
                        className="w-full font-mono text-sm sm:w-44"
                      />
                      <Input
                        value={param.value}
                        aria-label={t.paramValue}
                        onChange={(event) =>
                          updateParams(
                            params.map((row, position) =>
                              position === index
                                ? { ...row, value: event.target.value, hasValue: true }
                                : row,
                            ),
                          )
                        }
                        spellCheck={false}
                        className="min-w-0 flex-1 font-mono text-sm"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t.paramRemove}
                        title={t.paramRemove}
                        onClick={() =>
                          updateParams(params.filter((_, position) => position !== index))
                        }
                      >
                        <Trash2 size={ICON_SIZE} aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.rebuilt}</Label>
                <CopyButton value={rebuilt} variant="secondary" size="icon" />
              </div>
              <p className="min-w-0 break-all rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm">
                {rebuilt}
              </p>
            </div>
          </>
        ) : null}
      </section>

      <div>
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
