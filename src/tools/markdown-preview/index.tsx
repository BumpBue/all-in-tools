'use client';

import { useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { CopyButton } from '@/components/ui/copy-button';
import { FieldError, FieldHint, Label } from '@/components/ui/field';
import { buildToolStorageKey } from '@/config/storage-keys';
import { format } from '@/config/i18n';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { useLocale } from '@/hooks/use-t';
import { downloadText } from '@/lib/download';
import { countWords } from '@/lib/text';
import { LANGUAGES } from '@/tools/markdown-preview/highlight';
import { messages } from '@/tools/markdown-preview/i18n';
import {
  AUTOSAVE_DEBOUNCE_MS,
  MAX_INPUT_CHARS,
  countLines,
  countTasks,
  isTooLong,
  toDocument,
  toHtml,
} from '@/tools/markdown-preview/logic';
import { sanitize } from '@/tools/markdown-preview/sanitize';

const STORAGE_KEY = buildToolStorageKey('markdown-preview');
const HTML_MIME = 'text/html';
const EXPORT_FILENAME = 'markdown.html';

interface Insertion {
  before: string;
  after?: string;
  atLineStart?: boolean;
}

const TOOLBAR: ReadonlyArray<{ id: string; insertion: Insertion }> = [
  { id: 'toolbarBold', insertion: { before: '**', after: '**' } },
  { id: 'toolbarItalic', insertion: { before: '*', after: '*' } },
  { id: 'toolbarHeading', insertion: { before: '## ', atLineStart: true } },
  { id: 'toolbarLink', insertion: { before: '[', after: '](https://)' } },
  { id: 'toolbarCode', insertion: { before: '`', after: '`' } },
  { id: 'toolbarList', insertion: { before: '- ', atLineStart: true } },
  { id: 'toolbarTask', insertion: { before: '- [ ] ', atLineStart: true } },
  { id: 'toolbarQuote', insertion: { before: '> ', atLineStart: true } },
  {
    id: 'toolbarTable',
    insertion: { before: '\n| a | b |\n| --- | --- |\n| 1 | 2 |\n', atLineStart: true },
  },
];

export default function MarkdownPreview() {
  const locale = useLocale();
  const t = messages(locale);

  const [draft, setDraft, status] = useLocalStorage(STORAGE_KEY, '', {
    debounceMs: AUTOSAVE_DEBOUNCE_MS,
  });

  const [syncScroll, setSyncScroll] = useState(true);

  const editorId = useId();
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const tooLong = isTooLong(draft);
  const html = tooLong ? '' : sanitize(toHtml(draft));
  const tasks = countTasks(draft);

  const toolbarLabels: Record<string, string> = {
    toolbarBold: t.toolbarBold,
    toolbarItalic: t.toolbarItalic,
    toolbarHeading: t.toolbarHeading,
    toolbarLink: t.toolbarLink,
    toolbarCode: t.toolbarCode,
    toolbarList: t.toolbarList,
    toolbarTask: t.toolbarTask,
    toolbarQuote: t.toolbarQuote,
    toolbarTable: t.toolbarTable,
  };

  function write(next: string) {
    setDraft(next);
  }

  function insert({ before, after = '', atLineStart = false }: Insertion) {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = draft.slice(start, end) || (after === '' ? '' : t.linkText);

    const anchor = atLineStart ? draft.lastIndexOf('\n', start - 1) + 1 : start;
    const head = draft.slice(0, anchor);
    const middle = atLineStart ? `${before}${draft.slice(anchor, end)}` : `${before}${selected}${after}`;
    const tail = draft.slice(end);

    write(`${head}${middle}${tail}`);

    // Put the cursor where the reader would expect to keep typing.
    const caret = head.length + middle.length;
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(caret, caret);
    });
  }

  // Proportional rather than line-for-line: the two panes have different
  // heights, and matching their scroll fractions is what keeps them together.
  function syncFrom(source: HTMLElement, target: HTMLElement | null) {
    if (!syncScroll || !target) return;

    const range = source.scrollHeight - source.clientHeight;
    if (range <= 0) return;

    const fraction = source.scrollTop / range;
    target.scrollTop = fraction * (target.scrollHeight - target.clientHeight);
  }

  // No clock: reading one while rendering is impure, and what the reader needs
  // to know is whether the draft is being kept, not the second it happened.
  const savedLabel = !status.isLoaded
    ? t.saving
    : status.error !== null
      ? t.unsaved
      : t.saved;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {TOOLBAR.map((item) => (
          <Button
            key={item.id}
            variant="secondary"
            size="sm"
            onClick={() => insert(item.insertion)}
          >
            {toolbarLabels[item.id]}
          </Button>
        ))}

        <label className="ml-auto flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={syncScroll}
            onChange={(event) => setSyncScroll(event.target.checked)}
          />
          <span>{t.syncScroll}</span>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={editorId}>{t.editor}</Label>
          <textarea
            id={editorId}
            ref={editorRef}
            value={draft}
            placeholder={t.placeholder}
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => write(event.target.value)}
            onScroll={(event) => syncFrom(event.currentTarget, previewRef.current)}
            className="h-[28rem] w-full resize-none overflow-auto rounded-control border border-border bg-surface px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label>{t.preview}</Label>
            <CopyButton
              value={html}
              label={t.copyHtml}
              variant="ghost"
              size="icon"
            />
          </div>

          <div
            ref={previewRef}
            onScroll={(event) => syncFrom(event.currentTarget, editorRef.current)}
            className="markdown h-[28rem] overflow-auto rounded-control border border-border bg-surface px-4 py-3"
            // Sanitized immediately above, which is the whole point of the tool.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      </div>

      {tooLong ? (
        <FieldError>{format(t.tooLong, { max: MAX_INPUT_CHARS })}</FieldError>
      ) : null}

      {status.error !== null ? (
        <FieldError>
          {format(t.storageError, { message: status.error.message })}
        </FieldError>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
        <p role="status" className="text-sm text-muted">
          {format(t.stats, {
            words: countWords(draft),
            characters: draft.length,
            lines: countLines(draft),
          })}
        </p>

        {tasks.total > 0 ? (
          <Badge tone="accent">
            {format(t.tasks, { done: tasks.done, total: tasks.total })}
          </Badge>
        ) : null}

        <Badge tone="muted">{savedLabel}</Badge>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => downloadText(toDocument(html, t.draftTitle), EXPORT_FILENAME, HTML_MIME)}
          >
            {t.exportHtml}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => write('')}>
            {t.clear}
          </Button>
        </div>
      </div>

      <FieldHint>{t.sanitizeNote}</FieldHint>
      <FieldHint>{format(t.highlightNote, { count: LANGUAGES.length })}</FieldHint>
    </div>
  );
}
