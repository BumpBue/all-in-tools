'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { Label, Textarea } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import {
  DEFAULT_RULES,
  RULE_IDS,
  cleanText,
  isRuleId,
  resolveExclusive,
  type RuleId,
} from '@/tools/text-cleaner/logic';
import { messages } from '@/tools/text-cleaner/i18n';
import type { ToolComponentProps } from '@/tools/types';

const URL_RULES_KEY = 'r';
const URL_DEBOUNCE_MS = 400;
const RULE_SEPARATOR = ',';

const GROUPS: ReadonlyArray<{ label: 'basic' | 'thai' | 'optional'; rules: RuleId[] }> =
  [
    {
      label: 'basic',
      rules: [
        'normalize-newlines',
        'normalize-unicode',
        'zero-width',
        'trim-lines',
        'collapse-spaces',
        'collapse-blank-lines',
        'trim-document',
      ],
    },
    {
      label: 'thai',
      rules: ['thai-mark-spacing', 'thai-repeated-marks'],
    },
    {
      label: 'optional',
      rules: ['smart-punctuation', 'digits-to-arabic', 'digits-to-thai'],
    },
  ];

function readRules(raw: string | undefined): RuleId[] {
  if (raw === undefined) return [...DEFAULT_RULES];
  return raw.split(RULE_SEPARATOR).filter(isRuleId);
}

export default function TextCleaner({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // Only which rules are on travels in the link. The text being cleaned is the
  // reader's and has no business in a URL.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_RULES_KEY]: readRules(searchParams[URL_RULES_KEY]).join(RULE_SEPARATOR),
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const enabled = useMemo(
    () => readRules(urlState[URL_RULES_KEY]),
    [urlState],
  );

  const [text, setText] = useState('');
  const inputId = useId();
  const outputId = useId();

  const result = useMemo(() => cleanText(text, enabled), [enabled, text]);
  const countById = new Map(result.changes.map((change) => [change.id, change.count]));

  const labels: Record<RuleId, string> = {
    'normalize-newlines': t.ruleNormalizeNewlines,
    'normalize-unicode': t.ruleNormalizeUnicode,
    'zero-width': t.ruleZeroWidth,
    'thai-mark-spacing': t.ruleThaiMarkSpacing,
    'thai-repeated-marks': t.ruleThaiRepeatedMarks,
    'trim-lines': t.ruleTrimLines,
    'collapse-spaces': t.ruleCollapseSpaces,
    'collapse-blank-lines': t.ruleCollapseBlankLines,
    'trim-document': t.ruleTrimDocument,
    'smart-punctuation': t.ruleSmartPunctuation,
    'digits-to-arabic': t.ruleDigitsToArabic,
    'digits-to-thai': t.ruleDigitsToThai,
  };

  const groupLabels = { basic: t.basic, thai: t.thai, optional: t.optional };

  function setRules(next: RuleId[]) {
    setUrlState({ [URL_RULES_KEY]: next.join(RULE_SEPARATOR) });
  }

  function toggle(id: RuleId, on: boolean) {
    if (!on) {
      setRules(enabled.filter((rule) => rule !== id));
      return;
    }
    setRules([...resolveExclusive(enabled, id), id]);
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{t.rules}</h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm" onClick={() => setRules([...RULE_IDS])}>
              {t.selectAll}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setRules([])}>
              {t.selectNone}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRules([...DEFAULT_RULES])}
            >
              {t.reset}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {GROUPS.map((group) => (
            <fieldset
              key={group.label}
              className="flex flex-col gap-2 rounded-card border border-border bg-surface p-4"
            >
              <legend className="px-1 text-sm font-medium">
                {groupLabels[group.label]}
              </legend>

              {group.rules.map((id) => {
                const count = countById.get(id) ?? 0;
                return (
                  <label
                    key={id}
                    className="flex cursor-pointer items-start gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={enabled.includes(id)}
                      onChange={(event) => toggle(id, event.target.checked)}
                      className="mt-1"
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span>{labels[id]}</span>
                      {count > 0 ? (
                        <Badge tone="accent" className="w-fit">
                          {format(t.changed, { count })}
                        </Badge>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>

        <p className="text-sm text-muted">{t.thaiSpaceNote}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{t.input}</Label>
          <Textarea
            id={inputId}
            value={text}
            onChange={(event) => setText(event.target.value)}
            spellCheck={false}
            autoComplete="off"
            className="min-h-64"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={outputId}>{t.output}</Label>
            <CopyButton value={result.text} variant="secondary" size="icon" />
          </div>
          <Textarea
            id={outputId}
            value={result.text}
            readOnly
            spellCheck={false}
            className="min-h-64 bg-surface-subtle"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p role="status" className="text-sm text-muted">
          {format(t.stats, {
            beforeChars: result.before.characters,
            beforeLines: result.before.lines,
            afterChars: result.after.characters,
            afterLines: result.after.lines,
          })}
        </p>
        <Badge tone={result.totalChanges > 0 ? 'accent' : 'muted'}>
          {result.totalChanges > 0
            ? format(t.totalChanges, { count: result.totalChanges })
            : t.unchanged}
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          className="ml-auto"
          onClick={() => setText('')}
        >
          {t.clear}
        </Button>
      </div>
    </div>
  );
}
