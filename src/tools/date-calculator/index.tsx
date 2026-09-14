'use client';

import { useId, useMemo } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { Toggle, type ToggleOption } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { toBuddhistYear } from '@/lib/datetime';
import { messages } from '@/tools/date-calculator/i18n';
import { thaiHolidaysFor } from '@/tools/date-calculator/holidays';
import {
  ISO_DATE,
  addToDate,
  countBusinessDays,
  dateSpan,
  formatDate,
  parseDate,
  yearOf,
  type DateUnit,
  type MonthEndMode,
} from '@/tools/date-calculator/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_MODE_KEY = 'm';
const URL_START_KEY = 'from';
const URL_END_KEY = 'to';
const URL_AMOUNT_KEY = 'n';
const URL_UNIT_KEY = 'u';
const URL_MONTH_END_KEY = 'me';
const URL_EXTRA_KEY = 'x';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_AMOUNT = 30;
const INTL_LOCALES = { th: 'th-TH', en: 'en-GB' } as const;
const EXTRA_SEPARATOR = /[\s,]+/;

type Mode = 'add' | 'span';

function readMode(raw: string | undefined): Mode {
  return raw === 'span' ? 'span' : 'add';
}

function readUnit(raw: string | undefined): DateUnit {
  return raw === 'weeks' || raw === 'months' || raw === 'years' ? raw : 'days';
}

function readMonthEnd(raw: string | undefined): MonthEndMode {
  return raw === 'overflow' ? 'overflow' : 'clamp';
}

export default function DateCalculator({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());
  const locale = useLocale();
  const intlLocale = INTL_LOCALES[locale];

  const [urlState, setUrlState] = useUrlState(
    {
      [URL_MODE_KEY]: readMode(searchParams[URL_MODE_KEY]) as string,
      [URL_START_KEY]: searchParams[URL_START_KEY] ?? '',
      [URL_END_KEY]: searchParams[URL_END_KEY] ?? '',
      [URL_AMOUNT_KEY]: searchParams[URL_AMOUNT_KEY] ?? String(DEFAULT_AMOUNT),
      [URL_UNIT_KEY]: readUnit(searchParams[URL_UNIT_KEY]) as string,
      [URL_MONTH_END_KEY]: readMonthEnd(searchParams[URL_MONTH_END_KEY]) as string,
      [URL_EXTRA_KEY]: searchParams[URL_EXTRA_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const mode = readMode(urlState[URL_MODE_KEY]);
  const unit = readUnit(urlState[URL_UNIT_KEY]);
  const monthEnd = readMonthEnd(urlState[URL_MONTH_END_KEY]);
  const amount = Number(urlState[URL_AMOUNT_KEY]) || 0;
  const extraRaw = urlState[URL_EXTRA_KEY];

  const startId = useId();
  const endId = useId();
  const amountId = useId();
  const unitId = useId();
  const monthEndId = useId();
  const extraId = useId();

  const startRaw = urlState[URL_START_KEY];
  const endRaw = urlState[URL_END_KEY];

  const startError =
    !parseDate(startRaw).ok && startRaw.length > 0 ? t.errorNotADate : null;
  const endError = !parseDate(endRaw).ok && endRaw.length > 0 ? t.errorNotADate : null;

  // One memo over primitives only: deriving the range in the component body and
  // listing it as a dependency leaves the lint rule unable to prove it stable.
  const analysis = useMemo(() => {
    const from = parseDate(startRaw);
    if (!from.ok) return null;

    const target =
      mode === 'add'
        ? addToDate(from.utc, amount, unit, monthEnd)
        : (() => {
            const to = parseDate(endRaw);
            return to.ok ? to.utc : null;
          })();

    if (target === null) return null;

    const [earlier, later] = from.utc <= target ? [from.utc, target] : [target, from.utc];
    const fromDate = formatDate(earlier);
    const toDate = formatDate(later);

    const years: number[] = [];
    for (let year = yearOf(earlier); year <= yearOf(later); year += 1) years.push(year);

    const holidays = years
      .flatMap((year) => thaiHolidaysFor(year))
      .filter((holiday) => holiday.date >= fromDate && holiday.date <= toDate);

    const extra = extraRaw
      .split(EXTRA_SEPARATOR)
      .map((entry) => entry.trim())
      .filter((entry) => ISO_DATE.test(entry));

    const all = new Set([...holidays.map((holiday) => holiday.date), ...extra]);

    return {
      added: mode === 'add' ? target : null,
      span: mode === 'span' ? dateSpan(from.utc, target) : null,
      holidays,
      business: countBusinessDays(from.utc, target, all),
    };
  }, [amount, endRaw, extraRaw, mode, monthEnd, startRaw, unit]);

  const added = analysis?.added ?? null;
  const span = analysis?.span ?? null;
  const holidayList = analysis?.holidays ?? [];
  const businessDays = analysis?.business ?? null;

  const weekdayOf = (utc: number) =>
    new Intl.DateTimeFormat(intlLocale, { weekday: 'long', timeZone: 'UTC' }).format(utc);

  const modeOptions: ReadonlyArray<ToggleOption<Mode>> = [
    { value: 'add', label: t.modeAdd },
    { value: 'span', label: t.modeSpan },
  ];

  const today = () => setUrlState({ [URL_START_KEY]: formatDate(Date.now()) });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">{t.mode}</span>
        <Toggle
          options={modeOptions}
          value={mode}
          onChange={(next) => setUrlState({ [URL_MODE_KEY]: next })}
          label={t.mode}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={startId}>{t.start}</Label>
          <div className="flex items-center gap-2">
            <Input
              id={startId}
              type="date"
              value={urlState[URL_START_KEY]}
              aria-invalid={startError ? true : undefined}
              onChange={(event) =>
                setUrlState({ [URL_START_KEY]: event.target.value })
              }
            />
            <Button variant="secondary" size="sm" onClick={today}>
              {t.today}
            </Button>
          </div>
          <FieldError>{startError ?? undefined}</FieldError>
        </div>

        {mode === 'span' ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={endId}>{t.end}</Label>
            <Input
              id={endId}
              type="date"
              value={urlState[URL_END_KEY]}
              aria-invalid={endError ? true : undefined}
              onChange={(event) => setUrlState({ [URL_END_KEY]: event.target.value })}
            />
            <FieldError>{endError ?? undefined}</FieldError>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={amountId}>{t.amount}</Label>
              <Input
                id={amountId}
                type="number"
                inputMode="numeric"
                value={urlState[URL_AMOUNT_KEY]}
                onChange={(event) =>
                  setUrlState({ [URL_AMOUNT_KEY]: event.target.value })
                }
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={unitId}>{t.unit}</Label>
              <Select
                id={unitId}
                value={unit}
                onChange={(event) => setUrlState({ [URL_UNIT_KEY]: event.target.value })}
              >
                <option value="days">{t.unitDays}</option>
                <option value="weeks">{t.unitWeeks}</option>
                <option value="months">{t.unitMonths}</option>
                <option value="years">{t.unitYears}</option>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor={monthEndId}>{t.monthEnd}</Label>
              <Select
                id={monthEndId}
                value={monthEnd}
                onChange={(event) =>
                  setUrlState({ [URL_MONTH_END_KEY]: event.target.value })
                }
              >
                <option value="clamp">{t.monthEndClamp}</option>
                <option value="overflow">{t.monthEndOverflow}</option>
              </Select>
              <p className="text-sm text-muted">{t.monthEndHint}</p>
            </div>
          </>
        )}
      </div>

      {mode === 'add' && added !== null ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted">{t.resultDate}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-title">{formatDate(added)}</p>
            <CopyButton value={formatDate(added)} variant="ghost" size="icon" />
            <Badge tone="accent">
              {format(t.buddhistYear, { year: toBuddhistYear(yearOf(added)) })}
            </Badge>
          </div>
          <p className="text-sm text-muted">
            {format(t.weekday, { day: weekdayOf(added) })}
          </p>
        </section>
      ) : null}

      {mode === 'span' && span !== null ? (
        <section className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted">{t.result}</h2>
          <p className="text-title">
            {format(t.spanCombined, {
              years: span.combined.years,
              months: span.combined.months,
              days: span.combined.days,
            })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Badge tone="neutral">{format(t.spanDays, { count: span.days })}</Badge>
            <Badge tone="neutral">{format(t.spanWeeks, { count: span.weeks })}</Badge>
            <Badge tone="neutral">{format(t.spanMonths, { count: span.months })}</Badge>
            <Badge tone="neutral">{format(t.spanYears, { count: span.years })}</Badge>
          </div>
        </section>
      ) : null}

      {businessDays !== null ? (
        <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
          <h2 className="text-sm font-medium text-muted">{t.business}</h2>
          <p className="text-title">
            {format(t.businessDays, { count: businessDays.business })}
          </p>
          <p className="text-sm text-muted">
            {format(t.businessBreakdown, {
              total: businessDays.total,
              weekends: businessDays.weekends,
              holidays: businessDays.holidays,
            })}
          </p>

          {holidayList.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="text-sm font-medium">{t.holidaysInRange}</h3>
              <ul className="flex flex-col gap-1 text-sm text-muted">
                {holidayList.map((holiday) => (
                  <li key={holiday.date}>
                    <span className="font-mono">{holiday.date}</span> — {holiday[locale]}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-2 border-t border-border pt-6">
        <p className="text-sm text-muted">{t.holidayCoverage}</p>
        <p className="text-sm text-muted">{t.holidayMissing}</p>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={extraId}>{t.extraHolidays}</Label>
          <Textarea
            id={extraId}
            value={extraRaw}
            placeholder="2026-03-03 2026-05-11"
            spellCheck={false}
            onChange={(event) => setUrlState({ [URL_EXTRA_KEY]: event.target.value })}
            className="min-h-20 font-mono text-sm"
          />
          <p className="text-sm text-muted">{t.extraHolidaysHint}</p>
        </div>
      </section>

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            setUrlState({
              [URL_START_KEY]: '',
              [URL_END_KEY]: '',
              [URL_EXTRA_KEY]: '',
            })
          }
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
