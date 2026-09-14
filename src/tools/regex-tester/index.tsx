'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Input, Label, Textarea } from '@/components/ui/field';
import { Toggle } from '@/components/ui/toggle';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { CHEATSHEET, cheatsheetLabel, entryLabel } from '@/tools/regex-tester/cheatsheet';
import { messages } from '@/tools/regex-tester/i18n';
import {
  DEFAULT_FLAGS,
  MATCH_LIMIT,
  REGEX_FLAGS,
  buildSegments,
  normalizeFlags,
  type RegexFlag,
} from '@/tools/regex-tester/logic';
import { useRegexWorker } from '@/tools/regex-tester/use-regex-worker';
import type { ToolComponentProps } from '@/tools/types';

const URL_PATTERN_KEY = 'p';
const URL_FLAGS_KEY = 'f';
const URL_MODE_KEY = 'm';
const URL_REPLACEMENT_KEY = 'rep';
const URL_DEBOUNCE_MS = 400;
const URL_MAX_VALUE_LENGTH = 400;

type Mode = 'match' | 'replace';

const ALTERNATING_TONES = ['bg-accent-subtle text-accent', 'bg-success/20 text-success'];

function readMode(raw: string | undefined): Mode {
  return raw === 'replace' ? 'replace' : 'match';
}

export default function RegexTester({ searchParams }: ToolComponentProps) {
  const locale = useLocale();
  const t = messages(locale);

  // Only the expression travels in the link. The text being tested is the
  // reader's own and stays on the page.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_PATTERN_KEY]: searchParams[URL_PATTERN_KEY] ?? '',
      [URL_FLAGS_KEY]: normalizeFlags(searchParams[URL_FLAGS_KEY] ?? DEFAULT_FLAGS),
      [URL_MODE_KEY]: readMode(searchParams[URL_MODE_KEY]) as string,
      [URL_REPLACEMENT_KEY]: searchParams[URL_REPLACEMENT_KEY] ?? '',
    },
    { debounceMs: URL_DEBOUNCE_MS, maxValueLength: URL_MAX_VALUE_LENGTH },
  );

  const pattern = urlState[URL_PATTERN_KEY];
  const flags = urlState[URL_FLAGS_KEY];
  const mode = readMode(urlState[URL_MODE_KEY]);
  const replacement = urlState[URL_REPLACEMENT_KEY];

  const [text, setText] = useState('');

  const patternId = useId();
  const textId = useId();
  const replacementId = useId();

  const { status, response } = useRegexWorker({
    pattern,
    flags,
    text,
    replacement: mode === 'replace' ? replacement : null,
  });

  const matches = response?.ok ? response.matches : [];
  const segments = useMemo(
    () => (response?.ok ? buildSegments(text, response.matches) : []),
    [response, text],
  );

  const flagLabels: Record<RegexFlag, string> = {
    g: t.flagG,
    i: t.flagI,
    m: t.flagM,
    s: t.flagS,
    u: t.flagU,
    y: t.flagY,
  };

  function toggleFlag(flag: RegexFlag, on: boolean) {
    const next = on
      ? normalizeFlags(flags + flag)
      : [...flags].filter((each) => each !== flag).join('');
    setUrlState({ [URL_FLAGS_KEY]: next });
  }

  function clearAll() {
    setUrlState({ [URL_PATTERN_KEY]: '', [URL_REPLACEMENT_KEY]: '' });
    setText('');
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={patternId}>{t.pattern}</Label>
          <div className="flex items-center gap-2">
            <span aria-hidden className="font-mono text-muted">
              /
            </span>
            <Input
              id={patternId}
              value={pattern}
              placeholder={t.patternPlaceholder}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              aria-invalid={response && !response.ok ? true : undefined}
              onChange={(event) => setUrlState({ [URL_PATTERN_KEY]: event.target.value })}
              className="font-mono"
            />
            <span aria-hidden className="font-mono text-muted">
              /{flags}
            </span>
          </div>
        </div>

        <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
          <legend className="mb-1 text-sm font-medium">{t.flags}</legend>
          {REGEX_FLAGS.map((flag) => (
            <label key={flag} className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={flags.includes(flag)}
                onChange={(event) => toggleFlag(flag, event.target.checked)}
              />
              <span className="font-mono">{flag}</span>
              <span className="text-muted">{flagLabels[flag]}</span>
            </label>
          ))}
        </fieldset>
      </section>

      {response && !response.ok && response.code !== 'timeout' ? (
        <div className="flex flex-col gap-2">
          <FieldError>
            {response.code === 'invalid-flag'
              ? format(t.errorFlag, { flags: response.detail })
              : response.code === 'worker-failed'
                ? t.errorWorker
                : t.errorInvalid}
          </FieldError>

          {response.code === 'invalid-pattern' && response.detail.length > 0 ? (
            <p className="text-sm text-muted">{response.detail}</p>
          ) : null}

          {response.at !== null ? (
            <pre className="overflow-x-auto rounded-control border border-danger/40 bg-surface px-3 py-2 font-mono text-sm">
              {pattern}
              {'\n'}
              {' '.repeat(response.at)}
              <span className="text-danger">^</span>
              {'\n'}
              {format(t.errorAt, { at: response.at + 1 })}
            </pre>
          ) : null}
        </div>
      ) : null}

      {response && !response.ok && response.code === 'timeout' ? (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-card border border-danger/40 bg-surface-subtle p-4"
        >
          <p className="text-sm font-medium text-danger">{t.timeoutTitle}</p>
          <p className="text-sm text-muted">{t.timeoutBody}</p>
          <p className="text-sm text-muted">{t.timeoutSafe}</p>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Label htmlFor={textId}>{t.text}</Label>
          <Toggle
            label={t.mode}
            value={mode}
            onChange={(next) => setUrlState({ [URL_MODE_KEY]: next })}
            options={[
              { value: 'match', label: t.modeMatch },
              { value: 'replace', label: t.modeReplace },
            ]}
          />
        </div>
        <Textarea
          id={textId}
          value={text}
          placeholder={t.textPlaceholder}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setText(event.target.value)}
          className="min-h-40 font-mono text-sm"
        />
        <FieldHint>{t.privacy}</FieldHint>
      </section>

      {mode === 'replace' ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={replacementId}>{t.replacement}</Label>
            <Input
              id={replacementId}
              value={replacement}
              spellCheck={false}
              autoComplete="off"
              onChange={(event) =>
                setUrlState({ [URL_REPLACEMENT_KEY]: event.target.value })
              }
              className="font-mono"
            />
            <FieldHint>{t.replacementHint}</FieldHint>
            {flags.includes('g') ? null : <FieldHint>{t.replaceNoGlobal}</FieldHint>}
          </div>

          {response?.ok && response.replaced !== null ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label>{t.replaceResult}</Label>
                <CopyButton value={response.replaced} variant="secondary" size="icon" />
              </div>
              <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm whitespace-pre-wrap">
                {response.replaced}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}

      {response?.ok && text.length > 0 ? (
        <section className="flex flex-col gap-3" aria-busy={status === 'running'}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold">{t.results}</h2>
            <Badge tone={matches.length > 0 ? 'accent' : 'muted'}>
              <span role="status">
                {matches.length > 0
                  ? format(t.matchCount, { count: matches.length })
                  : t.matchNone}
              </span>
            </Badge>
            {response.truncated ? (
              <Badge tone="neutral">{format(t.truncated, { count: MATCH_LIMIT })}</Badge>
            ) : null}
          </div>

          {matches.length > 0 ? (
            <>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-medium">{t.highlight}</h3>
                <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm whitespace-pre-wrap">
                  {segments.map((segment, index) =>
                    segment.match === null ? (
                      <span key={index}>{segment.text}</span>
                    ) : (
                      <mark
                        key={index}
                        className={`rounded-sm ${ALTERNATING_TONES[segment.match % ALTERNATING_TONES.length]}`}
                      >
                        {segment.text}
                      </mark>
                    ),
                  )}
                </pre>
              </div>

              <div className="overflow-x-auto rounded-card border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-subtle">
                    <tr>
                      <th className="px-3 py-2 font-medium">{t.columnIndex}</th>
                      <th className="px-3 py-2 font-medium">{t.columnPosition}</th>
                      <th className="px-3 py-2 font-medium">{t.columnValue}</th>
                      <th className="px-3 py-2 font-medium">{t.columnGroups}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((match, index) => (
                      <tr
                        key={`${match.index}-${index}`}
                        className="border-t border-border"
                      >
                        <td className="px-3 py-2 font-mono text-muted">{index + 1}</td>
                        <td className="px-3 py-2 font-mono text-muted">
                          {match.index}-{match.end}
                        </td>
                        <td className="px-3 py-2 font-mono break-all">
                          {match.value.length > 0 ? match.value : t.emptyMatch}
                        </td>
                        <td className="px-3 py-2">
                          {match.groups.length === 0 ? (
                            <span className="text-muted">{t.noGroups}</span>
                          ) : (
                            <ul className="flex flex-col gap-0.5">
                              {match.groups.map((group) => (
                                <li key={group.index} className="font-mono break-all">
                                  <span className="text-muted">
                                    {group.name ?? group.index}:{' '}
                                  </span>
                                  {group.value ?? (
                                    <span className="text-muted">{t.groupUnmatched}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      <details className="rounded-card border border-border bg-surface p-4">
        <summary className="cursor-pointer text-sm font-medium">{t.cheatsheet}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {CHEATSHEET.map((group) => (
            <div key={group.en} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">{cheatsheetLabel(group, locale)}</h3>
              <dl className="flex flex-col gap-1 text-sm">
                {group.entries.map((entry) => (
                  <div key={entry.token} className="flex gap-2">
                    <dt className="w-24 shrink-0 font-mono text-accent">{entry.token}</dt>
                    <dd className="text-muted">{entryLabel(entry, locale)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </details>

      <div className="flex">
        <Button variant="secondary" size="sm" onClick={clearAll}>
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
