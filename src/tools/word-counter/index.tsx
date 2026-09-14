'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { segmenterSupport } from '@/lib/text';
import { messages } from '@/tools/word-counter/i18n';
import {
  LATIN_READING_WPM,
  LATIN_SPEAKING_WPM,
  MAX_WPM,
  MIN_WPM,
  THAI_READING_WPM,
  THAI_SPEAKING_WPM,
  clampWpm,
  countText,
  estimateTime,
  targetDifference,
  wordFrequency,
} from '@/tools/word-counter/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_TARGET_KEY = 'goal';
const URL_STOP_WORDS_KEY = 'stop';
const URL_READING_KEY = 'r';
const URL_SPEAKING_KEY = 's';
const URL_DEBOUNCE_MS = 400;

const ON = '1';
const OFF = '0';
const SECONDS_PER_MINUTE = 60;

function readFlag(raw: string | undefined, fallback: boolean): boolean {
  if (raw === ON) return true;
  if (raw === OFF) return false;
  return fallback;
}

function splitTime(seconds: number): { minutes: number; seconds: number } {
  return {
    minutes: Math.floor(seconds / SECONDS_PER_MINUTE),
    seconds: seconds % SECONDS_PER_MINUTE,
  };
}

export default function WordCounter({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // The text never leaves the page: it is the reader's, often a draft, and a
  // link carrying it would outlive the tab.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_TARGET_KEY]: searchParams[URL_TARGET_KEY] ?? '',
      [URL_STOP_WORDS_KEY]: readFlag(searchParams[URL_STOP_WORDS_KEY], true)
        ? ON
        : OFF,
      [URL_READING_KEY]: searchParams[URL_READING_KEY] ?? '',
      [URL_SPEAKING_KEY]: searchParams[URL_SPEAKING_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const [text, setText] = useState('');

  const removeStopWords = urlState[URL_STOP_WORDS_KEY] === ON;
  const target = Number(urlState[URL_TARGET_KEY]);
  const hasTarget = Number.isFinite(target) && target > 0;

  const inputId = useId();
  const targetId = useId();
  const readingId = useId();
  const speakingId = useId();

  const counts = useMemo(() => countText(text), [text]);
  const frequency = useMemo(
    () => wordFrequency(text, removeStopWords),
    [removeStopWords, text],
  );

  const mostlyThai = counts.thaiWords > counts.latinWords;
  const defaultReading = mostlyThai ? THAI_READING_WPM : LATIN_READING_WPM;
  const defaultSpeaking = mostlyThai ? THAI_SPEAKING_WPM : LATIN_SPEAKING_WPM;

  const readingWpm = urlState[URL_READING_KEY]
    ? clampWpm(Number(urlState[URL_READING_KEY]))
    : defaultReading;
  const speakingWpm = urlState[URL_SPEAKING_KEY]
    ? clampWpm(Number(urlState[URL_SPEAKING_KEY]))
    : defaultSpeaking;

  const time = estimateTime(counts.words, readingWpm, speakingWpm);
  const difference = hasTarget ? targetDifference(counts.words, target) : 0;
  const support = segmenterSupport();

  const rows: Array<[string, number]> = [
    [t.characters, counts.characters],
    [t.charactersNoSpaces, counts.charactersNoSpaces],
    [t.words, counts.words],
    [t.thaiWords, counts.thaiWords],
    [t.latinWords, counts.latinWords],
    [t.numbers, counts.numbers],
    [t.sentences, counts.sentences],
    [t.paragraphs, counts.paragraphs],
    [t.lines, counts.lines],
  ];

  const writeTime = (seconds: number) => format(t.minutes, splitTime(seconds));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{t.input}</Label>
        <Textarea
          id={inputId}
          value={text}
          placeholder={t.placeholder}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          className="min-h-56"
        />
        <p className="text-sm text-muted">{t.privacy}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.counts}</h2>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-4 py-3"
            >
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="font-mono text-title">{value.toLocaleString()}</dd>
            </div>
          ))}
        </dl>
        <p className="text-sm text-muted">
          {support === 'intl' ? t.segmenterIntl : t.segmenterFallback}
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">{t.time}</h2>
        <div className="flex flex-wrap gap-2">
          <Badge tone="neutral">
            {t.reading}: {writeTime(time.readingSeconds)}
          </Badge>
          <Badge tone="neutral">
            {t.speaking}: {writeTime(time.speakingSeconds)}
          </Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={readingId}>{t.readingSpeed}</Label>
            <Input
              id={readingId}
              type="number"
              inputMode="numeric"
              min={MIN_WPM}
              max={MAX_WPM}
              value={readingWpm}
              onChange={(event) =>
                setUrlState({ [URL_READING_KEY]: event.target.value })
              }
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={speakingId}>{t.speakingSpeed}</Label>
            <Input
              id={speakingId}
              type="number"
              inputMode="numeric"
              min={MIN_WPM}
              max={MAX_WPM}
              value={speakingWpm}
              onChange={(event) =>
                setUrlState({ [URL_SPEAKING_KEY]: event.target.value })
              }
            />
          </div>
        </div>
        <p className="text-sm text-muted">{t.speedNote}</p>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5 sm:max-w-xs">
          <Label htmlFor={targetId}>{t.target}</Label>
          <Input
            id={targetId}
            type="number"
            inputMode="numeric"
            min={0}
            value={urlState[URL_TARGET_KEY]}
            onChange={(event) => setUrlState({ [URL_TARGET_KEY]: event.target.value })}
          />
        </div>

        {hasTarget ? (
          <Badge
            tone={difference === 0 ? 'success' : difference > 0 ? 'accent' : 'muted'}
            className="w-fit"
          >
            {difference === 0
              ? t.onTarget
              : difference > 0
                ? format(t.over, { count: difference })
                : format(t.under, { count: Math.abs(difference) })}
          </Badge>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.frequency}</h2>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={removeStopWords}
              onChange={(event) =>
                setUrlState({ [URL_STOP_WORDS_KEY]: event.target.checked ? ON : OFF })
              }
            />
            {t.removeStopWords}
          </label>
        </div>

        {frequency.length === 0 ? (
          <p className="text-sm text-muted">{t.frequencyEmpty}</p>
        ) : (
          <ol className="flex flex-col divide-y divide-border rounded-card border border-border bg-surface">
            {frequency.map((entry, index) => (
              <li
                key={entry.word}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="w-6 text-muted">{index + 1}</span>
                <span className="min-w-0 flex-1 break-all">{entry.word}</span>
                <span className="font-mono text-muted">{entry.count}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <div>
        <Button variant="secondary" size="sm" onClick={() => setText('')}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
