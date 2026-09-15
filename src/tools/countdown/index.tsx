'use client';

import { useId, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint, Input, Label } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { ICT_TIME_ZONE, formatInZone, toBuddhistYear } from '@/lib/datetime';
import { downloadText } from '@/lib/download';
import { buildIcs } from '@/lib/ics';
import { messages } from '@/tools/countdown/i18n';
import {
  EMPTY_DATA,
  MAX_EVENTS,
  dayKeyOf,
  fromInputValue,
  migrate,
  pinnedEvent,
  reduce,
  remainingFrom,
  scheduleOf,
  sortEvents,
  toInputValue,
  type CountdownAction,
  type CountdownData,
} from '@/tools/countdown/logic';

const STORAGE_KEY = buildToolStorageKey('countdown');
const MILLISECONDS_PER_SECOND = 1000;
const ICS_FILENAME = 'countdown.ics';
const ICS_MIME = 'text/calendar';
const ICS_STAMP = '20000101T000000Z';
const DEFAULT_OFFSET_DAYS = 7;

export default function Countdown() {
  const locale = useLocale();
  const t = messages(locale);

  const [stored, setStored, status] = useLocalStorage<CountdownData>(
    STORAGE_KEY,
    EMPTY_DATA,
  );

  const data = migrate(stored);

  // The clock comes from the shared tick, never from Date.now() in render.
  const nowSeconds = useNowSeconds();
  const now = nowSeconds * MILLISECONDS_PER_SECOND;

  const [name, setName] = useState('');
  const [when, setWhen] = useState('');
  const fieldId = useId();

  function send(action: CountdownAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  function addEvent() {
    const at = fromInputValue(when);
    if (name.trim().length === 0 || at === null) return;

    send({ type: 'add', name, at });
    setName('');
    setWhen('');
  }

  if (nowSeconds === NO_TIME) {
    return <p className="text-sm text-muted">{t.waiting}</p>;
  }

  const sorted = sortEvents(data.events, now);
  const headline = pinnedEvent(data.events, now);
  const headlineLeft = headline ? remainingFrom(headline.at, now) : null;

  const defaultWhen = toInputValue(now + DEFAULT_OFFSET_DAYS * 86_400_000);

  return (
    <div className="flex flex-col gap-6">
      {headline && headlineLeft ? (
        <section className="flex flex-col items-center gap-2 rounded-card border border-border bg-surface p-6 text-center">
          <h2 className="text-title">{headline.name}</h2>
          <p className="text-sm text-muted">
            {headlineLeft.past ? t.since : t.until}
          </p>

          <div className="flex flex-wrap items-baseline justify-center gap-4">
            {(
              [
                [headlineLeft.days, t.days],
                [headlineLeft.hours, t.hours],
                [headlineLeft.minutes, t.minutes],
                [headlineLeft.seconds, t.seconds],
              ] as Array<[number, string]>
            ).map(([value, label]) => (
              <div key={label} className="flex flex-col items-center">
                <span className="font-mono text-display">{value}</span>
                <span className="text-xs text-muted">{label}</span>
              </div>
            ))}
          </div>

          <p className="text-sm text-muted">
            {formatInZone(headline.at, ICT_TIME_ZONE, locale)}
            {locale === 'th'
              ? ''
              : ` · ${format(t.buddhistYear, {
                  year: toBuddhistYear(new Date(headline.at).getFullYear()),
                })}`}
          </p>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex min-w-48 flex-1 flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-name`}>{t.newEvent}</Label>
            <Input
              id={`${fieldId}-name`}
              value={name}
              placeholder={t.newEventPlaceholder}
              spellCheck={false}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${fieldId}-when`}>{t.when}</Label>
            <Input
              id={`${fieldId}-when`}
              type="datetime-local"
              value={when}
              placeholder={defaultWhen}
              onChange={(event) => setWhen(event.target.value)}
            />
          </div>

          <Button onClick={addEvent}>{t.add}</Button>
        </div>

        <FieldHint>{format(t.maxEvents, { count: MAX_EVENTS })}</FieldHint>

        {data.events.length === 0 ? (
          <p className="text-sm text-muted">{t.noEvents}</p>
        ) : null}
      </section>

      <ul className="flex flex-col gap-3">
        {sorted.map((item) => {
          const left = remainingFrom(item.at, now);

          return (
            <li
              key={item.id}
              className={`flex flex-col gap-2 rounded-card border p-3 ${
                item.pinned ? 'border-accent' : 'border-border'
              } ${left.past ? 'bg-surface-subtle' : 'bg-surface'}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={item.name}
                  aria-label={t.rename}
                  spellCheck={false}
                  onChange={(event) =>
                    send({ type: 'rename', id: item.id, name: event.target.value })
                  }
                  className="min-w-40 flex-1"
                />

                <Input
                  type="datetime-local"
                  value={toInputValue(item.at)}
                  aria-label={t.reschedule}
                  onChange={(event) => {
                    const at = fromInputValue(event.target.value);
                    if (at !== null) send({ type: 'reschedule', id: item.id, at });
                  }}
                  className="w-56"
                />

                <Button
                  variant={item.pinned ? 'primary' : 'ghost'}
                  size="sm"
                  aria-label={format(t.pin, { name: item.name })}
                  onClick={() => send({ type: 'pin', id: item.id })}
                >
                  {item.pinned ? t.pinned : '☆'}
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={format(t.remove, { name: item.name })}
                  onClick={() => send({ type: 'remove', id: item.id })}
                >
                  ×
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={left.past ? 'muted' : 'accent'}>
                  {left.past
                    ? format(t.passedDays, { days: left.days })
                    : `${t.until}: ${left.days} ${t.days} ${left.hours}:${String(
                        left.minutes,
                      ).padStart(2, '0')}:${String(left.seconds).padStart(2, '0')}`}
                </Badge>
                <span className="text-sm text-muted">
                  {formatInZone(item.at, ICT_TIME_ZONE, locale)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {data.events.length > 0 ? (
        <section className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="w-fit"
            onClick={() =>
              downloadText(
                buildIcs({
                  schedule: scheduleOf(data.events),
                  calendarName: t.calendarName,
                  title: (day, count) =>
                    data.events
                      .filter((each) => dayKeyOf(each.at) === day)
                      .map((each) => each.name)
                      .join(', ') || format(t.icsTitle, { count }),
                  stamp: ICS_STAMP,
                }),
                ICS_FILENAME,
                ICS_MIME,
              )
            }
          >
            {t.exportIcs}
          </Button>
          <FieldHint>{t.icsNote}</FieldHint>
        </section>
      ) : null}

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <FieldHint>{t.storageNote}</FieldHint>
    </div>
  );
}
