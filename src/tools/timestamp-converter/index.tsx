'use client';

import { Clock } from 'lucide-react';
import { useId } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Select } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { messages } from '@/tools/timestamp-converter/i18n';
import {
  ICT_TIME_ZONE,
  UTC_TIME_ZONE,
  formatInZone,
  formatIso,
  formatRelative,
  formatRfc2822,
  fromMilliseconds,
  gregorianYear,
  listTimeZones,
  parseLocalDateTime,
  parseTimestamp,
  toBuddhistYear,
  toLocalInputValue,
  type TimestampUnit,
} from '@/tools/timestamp-converter/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_VALUE_KEY = 'v';
const URL_UNIT_KEY = 'u';
const URL_ZONE_KEY = 'tz';
const URL_DEBOUNCE_MS = 400;

const ICON_SIZE = 16;
const AUTO = 'auto';
const MILLISECONDS_PER_SECOND = 1000;
const INTL_LOCALES = { th: 'th-TH', en: 'en-GB' } as const;

type UnitChoice = TimestampUnit | typeof AUTO;

function readUnit(raw: string | undefined): UnitChoice {
  return raw === 'seconds' || raw === 'milliseconds' ? raw : AUTO;
}

export default function TimestampConverter({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());
  const locale = useLocale();
  const intlLocale = INTL_LOCALES[locale];

  const zones = listTimeZones();

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_VALUE_KEY]: searchParams[URL_VALUE_KEY] ?? '',
      [URL_UNIT_KEY]: readUnit(searchParams[URL_UNIT_KEY]) as string,
      [URL_ZONE_KEY]: zones.includes(searchParams[URL_ZONE_KEY] ?? '')
        ? (searchParams[URL_ZONE_KEY] as string)
        : ICT_TIME_ZONE,
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const raw = urlState[URL_VALUE_KEY];
  const unitChoice = readUnit(urlState[URL_UNIT_KEY]);
  const zone = urlState[URL_ZONE_KEY];

  // Zero until the client has mounted, so the server never renders a clock that
  // would disagree with the browser a moment later.
  const nowSeconds = useNowSeconds();
  const nowMs = nowSeconds * MILLISECONDS_PER_SECOND;
  const clockReady = nowSeconds !== NO_TIME;

  const timestampId = useId();
  const dateTimeId = useId();
  const zoneId = useId();
  const unitId = useId();
  const errorId = useId();

  const parsed = parseTimestamp(raw, unitChoice === AUTO ? undefined : unitChoice);
  const milliseconds = parsed.ok ? parsed.milliseconds : null;

  const error =
    !parsed.ok && raw.trim().length > 0
      ? parsed.code === 'not-a-number'
        ? t.errorNotANumber
        : t.errorOutOfRange
      : null;

  function setTimestamp(milliseconds: number) {
    const unit = unitChoice === AUTO ? 'seconds' : unitChoice;
    setUrlState({ [URL_VALUE_KEY]: String(fromMilliseconds(milliseconds, unit)) });
  }

  function changeDateTime(value: string) {
    const result = parseLocalDateTime(value, zone);
    if (result.ok) setTimestamp(result.milliseconds);
  }

  const rows: Array<[string, string]> = milliseconds === null
    ? []
    : [
        [t.labelIct, formatInZone(milliseconds, ICT_TIME_ZONE, intlLocale)],
        [t.labelUtc, formatInZone(milliseconds, UTC_TIME_ZONE, intlLocale)],
        ...(zone === ICT_TIME_ZONE || zone === UTC_TIME_ZONE
          ? []
          : ([[t.labelZone, formatInZone(milliseconds, zone, intlLocale)]] as Array<
              [string, string]
            >)),
        [t.labelIso, formatIso(milliseconds)],
        [t.labelRfc, formatRfc2822(milliseconds)],
        ...(clockReady
          ? ([
              [t.labelRelative, formatRelative(milliseconds, nowMs, locale)],
            ] as Array<[string, string]>)
          : []),
      ];

  const year = milliseconds === null ? null : gregorianYear(milliseconds, zone);

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={timestampId}>{t.timestamp}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={timestampId}
              value={raw}
              inputMode="numeric"
              spellCheck={false}
              autoComplete="off"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
              onChange={(event) =>
                setUrlState({ [URL_VALUE_KEY]: event.target.value })
              }
              className="font-mono"
            />
            <CopyButton value={raw} variant="secondary" size="icon" />
          </div>
          <p id={errorId}>
            <FieldError>{error ?? undefined}</FieldError>
          </p>
          {parsed.ok && unitChoice === AUTO ? (
            <Badge tone="muted" className="w-fit">
              {format(t.detected, {
                unit: parsed.unit === 'seconds' ? t.unitSeconds : t.unitMilliseconds,
              })}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={unitId}>{t.unit}</Label>
          <Select
            id={unitId}
            value={unitChoice}
            onChange={(event) => setUrlState({ [URL_UNIT_KEY]: event.target.value })}
          >
            <option value={AUTO}>{t.unitAuto}</option>
            <option value="seconds">{t.unitSeconds}</option>
            <option value="milliseconds">{t.unitMilliseconds}</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={dateTimeId}>{t.dateTime}</Label>
          <Input
            id={dateTimeId}
            type="datetime-local"
            step={1}
            value={milliseconds === null ? '' : toLocalInputValue(milliseconds, zone)}
            onChange={(event) => changeDateTime(event.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={zoneId}>{t.zone}</Label>
          <Select
            id={zoneId}
            value={zone}
            onChange={(event) => setUrlState({ [URL_ZONE_KEY]: event.target.value })}
          >
            {zones.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" disabled={!clockReady} onClick={() => setTimestamp(nowMs)}>
          <Clock size={ICON_SIZE} aria-hidden />
          {t.now}
        </Button>
        <span role="status" className="font-mono text-sm text-muted">
          {clockReady ? `${t.liveNow}: ${nowSeconds}` : t.liveWaiting}
        </span>
      </div>

      {rows.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.results}</h2>
            {year !== null ? (
              <>
                <Badge tone="neutral">
                  {format(t.gregorianYear, { year })}
                </Badge>
                <Badge tone="accent">
                  {format(t.buddhistYear, { year: toBuddhistYear(year) })}
                </Badge>
              </>
            ) : null}
          </div>

          <dl className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {rows.map(([label, value]) => (
              <div
                key={label}
                className="flex flex-wrap items-center gap-2 px-4 py-3"
              >
                <dt className="w-full text-sm text-muted sm:w-48">{label}</dt>
                <dd className="min-w-0 flex-1 break-all font-mono text-sm">{value}</dd>
                <CopyButton value={value} variant="ghost" size="icon" />
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setUrlState({ [URL_VALUE_KEY]: '' })}
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
