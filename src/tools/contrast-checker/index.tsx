'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Textarea } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { parseColor, rgbToHex } from '@/lib/color';
import { messages } from '@/tools/contrast-checker/i18n';
import {
  AA_NORMAL,
  apcaContrast,
  apcaUse,
  checkContrast,
  contrastRatio,
  nearestPassing,
  parseColorList,
  type ApcaUse,
} from '@/tools/contrast-checker/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_TEXT_KEY = 'fg';
const URL_BACKGROUND_KEY = 'bg';
const URL_LIST_KEY = 'list';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 1200;

const DEFAULT_TEXT = '#767676';
const DEFAULT_BACKGROUND = '#ffffff';
const ICON_SIZE = 16;

export default function ContrastChecker({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_TEXT_KEY]: searchParams[URL_TEXT_KEY] ?? DEFAULT_TEXT,
      [URL_BACKGROUND_KEY]: searchParams[URL_BACKGROUND_KEY] ?? DEFAULT_BACKGROUND,
      [URL_LIST_KEY]: searchParams[URL_LIST_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const textRaw = urlState[URL_TEXT_KEY];
  const backgroundRaw = urlState[URL_BACKGROUND_KEY];
  const listRaw = urlState[URL_LIST_KEY];

  const textId = useId();
  const backgroundId = useId();
  const listId = useId();

  const text = parseColor(textRaw);
  const background = parseColor(backgroundRaw);

  const textError = text === null && textRaw.trim().length > 0 ? t.errorText : null;
  const backgroundError =
    background === null && backgroundRaw.trim().length > 0 ? t.errorBackground : null;

  const wcag = text && background ? checkContrast(text, background) : null;
  const lc = text && background ? apcaContrast(text, background) : null;
  const suggestion =
    text && background && wcag && !wcag.aaNormal
      ? nearestPassing(text, background, AA_NORMAL)
      : null;

  const useLabels: Record<ApcaUse, string> = {
    any: t.apcaAny,
    body: t.apcaBody,
    large: t.apcaLarge,
    none: t.apcaNone,
  };

  const list = background ? parseColorList(listRaw) : [];

  const verdict = (passed: boolean) => (
    <Badge tone={passed ? 'success' : 'muted'}>{passed ? t.pass : t.fail}</Badge>
  );

  const swatchStyle =
    text && background
      ? { color: rgbToHex(text), backgroundColor: rgbToHex(background) }
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={textId}>{t.text}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={textId}
              value={textRaw}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={textError ? true : undefined}
              onChange={(event) => setUrlState({ [URL_TEXT_KEY]: event.target.value })}
              className="font-mono"
            />
            <input
              type="color"
              aria-label={t.text}
              value={text ? rgbToHex(text) : DEFAULT_TEXT}
              onChange={(event) => setUrlState({ [URL_TEXT_KEY]: event.target.value })}
              className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-border"
            />
          </div>
          <FieldError>{textError ?? undefined}</FieldError>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={backgroundId}>{t.background}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={backgroundId}
              value={backgroundRaw}
              spellCheck={false}
              autoComplete="off"
              aria-invalid={backgroundError ? true : undefined}
              onChange={(event) =>
                setUrlState({ [URL_BACKGROUND_KEY]: event.target.value })
              }
              className="font-mono"
            />
            <input
              type="color"
              aria-label={t.background}
              value={background ? rgbToHex(background) : DEFAULT_BACKGROUND}
              onChange={(event) =>
                setUrlState({ [URL_BACKGROUND_KEY]: event.target.value })
              }
              className="h-10 w-12 shrink-0 cursor-pointer rounded-control border border-border"
            />
          </div>
          <FieldError>{backgroundError ?? undefined}</FieldError>
        </div>
      </div>

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setUrlState({
              [URL_TEXT_KEY]: backgroundRaw,
              [URL_BACKGROUND_KEY]: textRaw,
            })
          }
        >
          <ArrowLeftRight size={ICON_SIZE} aria-hidden />
          {t.swap}
        </Button>
      </div>

      {wcag && lc !== null ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <h2 className="text-sm font-medium text-muted">{t.wcag}</h2>
              <p className="font-mono text-display">
                {format(t.ratio, { ratio: wcag.ratio })}
              </p>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <dt>AA · {t.normalText}</dt>
                  <dd>{verdict(wcag.aaNormal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>AA · {t.largeText}</dt>
                  <dd>{verdict(wcag.aaLarge)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>AAA · {t.normalText}</dt>
                  <dd>{verdict(wcag.aaaNormal)}</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt>AAA · {t.largeText}</dt>
                  <dd>{verdict(wcag.aaaLarge)}</dd>
                </div>
              </dl>
            </section>

            <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
              <h2 className="text-sm font-medium text-muted">{t.apca}</h2>
              <p className="font-mono text-display">
                {format(t.apcaValue, { value: lc })}
              </p>
              <Badge
                tone={apcaUse(lc) === 'none' ? 'muted' : 'accent'}
                className="w-fit"
              >
                {useLabels[apcaUse(lc)]}
              </Badge>
              <p className="text-sm text-muted">{t.apcaWhy}</p>
            </section>
          </div>

          {suggestion ? (
            <section className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface-subtle p-4">
              <span
                aria-hidden
                style={{ backgroundColor: rgbToHex(suggestion) }}
                className="size-8 rounded-control border border-border"
              />
              <p className="text-sm">
                {format(t.suggested, {
                  hex: rgbToHex(suggestion),
                  ratio: background ? contrastRatio(suggestion, background) : 0,
                })}
              </p>
              <Button
                size="sm"
                onClick={() =>
                  setUrlState({ [URL_TEXT_KEY]: rgbToHex(suggestion) })
                }
              >
                {t.suggestApply}
              </Button>
            </section>
          ) : wcag.aaNormal ? null : (
            <p className="text-sm text-muted">{t.suggestNone}</p>
          )}

          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">{t.samples}</h2>
            <div style={swatchStyle} className="flex flex-col gap-3 rounded-card p-6">
              <p className="text-[14px]">{t.sampleSmall}</p>
              <p className="text-[16px]">{t.sampleBody}</p>
              <p className="text-[24px] font-semibold">{t.sampleLarge}</p>
            </div>
          </section>
        </>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-border pt-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">{t.batch}</h2>
          <p className="text-sm text-muted">{t.batchHint}</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={listId}>{t.batchColor}</Label>
          <Textarea
            id={listId}
            value={listRaw}
            placeholder="--brand: #4682b4;"
            spellCheck={false}
            onChange={(event) => setUrlState({ [URL_LIST_KEY]: event.target.value })}
            className="min-h-28 font-mono text-sm"
          />
        </div>

        {list.length === 0 ? (
          <p className="text-sm text-muted">{t.batchEmpty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {list.map((entry) => {
              const result = background ? checkContrast(entry.rgb, background) : null;
              const entryLc = background ? apcaContrast(entry.rgb, background) : 0;

              return (
                <li
                  key={`${entry.name}-${entry.value}`}
                  className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm"
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: entry.value }}
                    className="size-6 shrink-0 rounded border border-border"
                  />
                  <span className="min-w-0 flex-1 break-all font-mono">{entry.name}</span>
                  <span className="font-mono text-muted">
                    {result ? format(t.ratio, { ratio: result.ratio }) : ''}
                  </span>
                  <span className="font-mono text-muted">
                    {format(t.apcaValue, { value: entryLc })}
                  </span>
                  {result ? verdict(result.aaNormal) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
