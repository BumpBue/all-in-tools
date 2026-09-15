'use client';

import Link from 'next/link';
import { useState } from 'react';

import { Button, buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { FieldError, FieldHint } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { NO_TIME, useNowSeconds } from '@/hooks/use-now';
import { useLocale } from '@/hooks/use-t';
import { toDayKey } from '@/lib/day';
import { downloadText } from '@/lib/download';
import { buildIcs } from '@/lib/ics';

import {
  DECKS_STORAGE_SLUG,
  EMPTY_DECKS,
  GRADES,
  dueCards,
  migrate,
  reduce,
  reviewCard,
  totalDue,
  upcomingSchedule,
  type DeckAction,
  type DecksData,
  type Grade,
} from '@/tools/_shared/decks';
import { messages } from '@/tools/spaced-repetition/i18n';

const STORAGE_KEY = buildToolStorageKey(DECKS_STORAGE_SLUG);
const MILLISECONDS_PER_SECOND = 1000;
const DECKS_PATH = '/tools/flashcards';
const SCHEDULE_DAYS = 60;
const ICS_FILENAME = 'review-schedule.ics';
const ICS_MIME = 'text/calendar';
const ICS_STAMP = '20000101T000000Z';

export default function SpacedRepetition() {
  const t = messages(useLocale());

  const [stored, setStored, status] = useLocalStorage<DecksData>(
    STORAGE_KEY,
    EMPTY_DECKS,
  );

  const data = migrate(stored);
  const nowSeconds = useNowSeconds();
  const today =
    nowSeconds === NO_TIME ? '' : toDayKey(nowSeconds * MILLISECONDS_PER_SECOND);

  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  function send(action: DeckAction) {
    setStored((previous) => reduce(migrate(previous), action));
  }

  const gradeLabels: Record<Grade, string> = {
    forgot: t.gradeForgot,
    hard: t.gradeHard,
    good: t.gradeGood,
    easy: t.gradeEasy,
  };

  const gradeTones: Record<Grade, 'danger' | 'secondary' | 'primary'> = {
    forgot: 'danger',
    hard: 'secondary',
    good: 'primary',
    easy: 'secondary',
  };

  const activeDeck = data.decks.find((deck) => deck.id === activeDeckId) ?? null;
  const queue = activeDeck && today !== '' ? dueCards(activeDeck, today) : [];
  const current = queue[0] ?? null;

  const schedule = today === '' ? {} : upcomingSchedule(data, today, SCHEDULE_DAYS);
  const scheduleDays = Object.keys(schedule).sort();

  function grade(value: Grade) {
    if (!activeDeck || !current || today === '') return;

    send({
      type: 'review',
      deckId: activeDeck.id,
      cardId: current.id,
      grade: value,
      today,
    });
    setRevealed(false);
  }

  if (nowSeconds === NO_TIME) {
    return <p className="text-sm text-muted">{t.waiting}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <FieldHint>{t.sharedNote}</FieldHint>

      {data.decks.length === 0 ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-muted">{t.noDecks}</p>
          <Link href={DECKS_PATH} className={buttonClasses({ variant: 'secondary' })}>
            {t.goToDecks}
          </Link>
        </div>
      ) : null}

      {activeDeck && current ? (
        <section className="flex flex-col items-center gap-4">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Badge tone="accent">
              {format(t.reviewing, { name: activeDeck.name })}
            </Badge>
            <Badge tone="muted">{format(t.remaining, { count: queue.length })}</Badge>
          </div>

          <div className="flex min-h-40 w-full max-w-md flex-col items-center justify-center gap-4 rounded-card border border-border bg-surface px-6 py-8 text-center">
            <p className="text-title">{current.front}</p>
            {revealed ? (
              <p className="border-t border-border pt-4 text-title text-muted">
                {current.back}
              </p>
            ) : null}
          </div>

          {revealed ? (
            <div className="flex flex-col items-center gap-2">
              <div className="flex flex-wrap justify-center gap-2">
                {GRADES.map((value) => (
                  <Button
                    key={value}
                    variant={gradeTones[value]}
                    onClick={() => grade(value)}
                  >
                    {gradeLabels[value]}
                    <span className="text-xs opacity-70">
                      {format(t.nextIn, {
                        days: reviewCard(current, value, today).interval,
                      })}
                    </span>
                  </Button>
                ))}
              </div>
              <FieldHint>{t.gradeHint}</FieldHint>
            </div>
          ) : (
            <Button onClick={() => setRevealed(true)}>{t.showAnswer}</Button>
          )}

          <Button variant="ghost" size="sm" onClick={() => setActiveDeckId(null)}>
            {t.stop}
          </Button>
        </section>
      ) : null}

      {activeDeck && !current ? (
        <section className="flex flex-col items-center gap-2">
          <Badge tone="success">{t.finished}</Badge>
          <FieldHint>{t.finishedHint}</FieldHint>
          <Button variant="secondary" size="sm" onClick={() => setActiveDeckId(null)}>
            {t.stop}
          </Button>
        </section>
      ) : null}

      {activeDeck === null && data.decks.length > 0 ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.dueToday}</h2>
            <Badge tone={totalDue(data, today) > 0 ? 'accent' : 'muted'}>
              {format(t.dueCount, { count: totalDue(data, today) })}
            </Badge>
          </div>

          {totalDue(data, today) === 0 ? (
            <p className="text-sm text-muted">{t.nothingDue}</p>
          ) : null}

          <ul className="flex flex-col gap-2">
            {data.decks.map((deck) => {
              const due = dueCards(deck, today).length;

              return (
                <li
                  key={deck.id}
                  className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-3"
                >
                  <span className="font-medium">{deck.name}</span>
                  <Badge tone={due > 0 ? 'accent' : 'muted'}>
                    {format(t.dueCount, { count: due })}
                  </Badge>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="ml-auto"
                    disabled={due === 0}
                    onClick={() => {
                      setActiveDeckId(deck.id);
                      setRevealed(false);
                    }}
                  >
                    {format(t.startDeck, { name: deck.name })}
                  </Button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.schedule}</h2>

        {scheduleDays.length === 0 ? (
          <p className="text-sm text-muted">{t.scheduleEmpty}</p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2">
              {scheduleDays.map((day) => (
                <li key={day}>
                  <Badge tone={day === today ? 'accent' : 'neutral'}>
                    {format(t.scheduleDay, { date: day, count: schedule[day] ?? 0 })}
                  </Badge>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-2">
              <Button
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() =>
                  downloadText(
                    buildIcs({
                      schedule,
                      calendarName: t.calendarName,
                      title: (_day, count) => format(t.icsTitle, { count }),
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
            </div>
          </>
        )}
      </section>

      <section className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">{t.algorithm}</h2>
        <FieldHint>{t.algorithmNote}</FieldHint>
      </section>

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}
    </div>
  );
}
