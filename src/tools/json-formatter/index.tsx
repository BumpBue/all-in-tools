'use client';

import { useId, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/ui/copy-button';
import { Badge } from '@/components/ui/card';
import { FieldError, Input, Label, Select, Textarea } from '@/components/ui/field';
import { format } from '@/config/i18n';
import { useLocale } from '@/hooks/use-t';
import { useUrlState } from '@/hooks/use-url-state';
import { formatBytes } from '@/lib/utils';
import { messages } from '@/tools/json-formatter/i18n';
import { JsonTree } from '@/tools/json-formatter/tree';
import {
  LARGE_INPUT_BYTES,
  buildTree,
  byteLength,
  formatJson,
  jsonStats,
  minifyJson,
  parseJson,
  sortKeys,
  toTypeScript,
  type IndentStyle,
  type TreeNode,
} from '@/tools/json-formatter/logic';
import type { ToolComponentProps } from '@/tools/types';

const URL_INDENT_KEY = 'i';
const URL_TYPE_NAME_KEY = 'type';
const URL_DEBOUNCE_MS = 400;

const DEFAULT_TYPE_NAME = 'Root';
const PERCENT = 100;
const AUTO_EXPAND_DEPTH = 2;

function readIndent(raw: string | undefined): IndentStyle {
  return raw === '4' || raw === 'tab' ? raw : '2';
}

function pathsToDepth(node: TreeNode, depth: number, into: Set<string>): void {
  if (depth <= 0 || node.children.length === 0) return;
  into.add(node.path);
  for (const child of node.children) pathsToDepth(child, depth - 1, into);
}

export default function JsonFormatter({ searchParams }: ToolComponentProps) {
  const t = messages(useLocale());

  // The JSON itself never travels: it is often a payload from somewhere real.
  const [urlState, setUrlState] = useUrlState(
    {
      [URL_INDENT_KEY]: readIndent(searchParams[URL_INDENT_KEY]) as string,
      [URL_TYPE_NAME_KEY]: searchParams[URL_TYPE_NAME_KEY] ?? DEFAULT_TYPE_NAME,
    },
    { debounceMs: URL_DEBOUNCE_MS },
  );

  const indent = readIndent(urlState[URL_INDENT_KEY]);
  const typeName = urlState[URL_TYPE_NAME_KEY];

  const [text, setText] = useState('');
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const [processedLarge, setProcessedLarge] = useState(false);

  const inputId = useId();
  const indentId = useId();
  const typeNameId = useId();

  const size = byteLength(text);
  const isLarge = size > LARGE_INPUT_BYTES;
  const shouldParse = text.trim().length > 0 && (!isLarge || processedLarge);

  const parsed = useMemo(
    () => (shouldParse ? parseJson(text) : null),
    [shouldParse, text],
  );

  const value = parsed?.ok ? parsed.value : null;

  const tree = useMemo(() => (value === null ? null : buildTree(value)), [value]);
  const stats = useMemo(() => (value === null ? null : jsonStats(value)), [value]);

  const minified = value === null ? '' : minifyJson(value);
  const minifiedSize = byteLength(minified);
  const saved =
    size > 0 && minifiedSize > 0
      ? Math.max(0, Math.round((1 - minifiedSize / size) * PERCENT))
      : 0;

  function replace(next: string) {
    setText(next);
    setProcessedLarge(false);
    setOpen(new Set());
  }

  function expandTo(depth: number) {
    if (!tree) return;
    const paths = new Set<string>();
    pathsToDepth(tree, depth, paths);
    setOpen(paths);
  }

  function toggle(path: string) {
    setOpen((previous) => {
      const next = new Set(previous);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  const failingLine =
    parsed && !parsed.ok && parsed.line !== null
      ? text.split('\n')[parsed.line - 1]
      : null;

  const statRows: Array<[string, number]> = stats
    ? [
        [t.statKeys, stats.keys],
        [t.statNodes, stats.nodes],
        [t.statDepth, stats.maxDepth],
        [t.statObjects, stats.objects],
        [t.statArrays, stats.arrays],
      ]
    : [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={inputId}>{t.input}</Label>
        <Textarea
          id={inputId}
          value={text}
          placeholder={t.placeholder}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={parsed && !parsed.ok ? true : undefined}
          onChange={(event) => replace(event.target.value)}
          className="min-h-56 font-mono text-sm"
        />
        <p className="text-sm text-muted">{t.privacy}</p>
      </div>

      {isLarge && !processedLarge ? (
        <div className="flex flex-col gap-2 rounded-card border border-border bg-surface-subtle p-4">
          <p className="text-sm font-medium">
            {format(t.large, { size: formatBytes(size) })}
          </p>
          <p className="text-sm text-muted">{t.largeHint}</p>
          <div>
            <Button size="sm" onClick={() => setProcessedLarge(true)}>
              {t.largeAction}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={indentId}>{t.indent}</Label>
          <Select
            id={indentId}
            value={indent}
            onChange={(event) => setUrlState({ [URL_INDENT_KEY]: event.target.value })}
          >
            <option value="2">{t.indent2}</option>
            <option value="4">{t.indent4}</option>
            <option value="tab">{t.indentTab}</option>
          </Select>
        </div>

        <Button
          size="sm"
          disabled={value === null}
          onClick={() => value !== null && setText(formatJson(value, indent))}
        >
          {t.formatAction}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={value === null}
          onClick={() => value !== null && setText(minifyJson(value))}
        >
          {t.minifyAction}
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={value === null}
          onClick={() => value !== null && setText(formatJson(sortKeys(value), indent))}
        >
          {t.sortAction}
        </Button>
        <Button variant="secondary" size="sm" onClick={() => replace('')}>
          {t.clear}
        </Button>
      </div>

      {parsed && !parsed.ok ? (
        <div className="flex flex-col gap-2">
          <FieldError>
            {parsed.message === 'empty'
              ? t.errorEmpty
              : parsed.line !== null && parsed.column !== null
                ? format(t.errorAt, { line: parsed.line, column: parsed.column })
                : t.errorNoLocation}
          </FieldError>
          <p className="text-sm text-muted">{parsed.message}</p>

          {failingLine !== null ? (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">{t.errorLine}</p>
              <pre className="overflow-x-auto rounded-control border border-danger/40 bg-surface px-3 py-2 font-mono text-sm">
                {failingLine}
                {parsed.column !== null ? (
                  <>
                    {'\n'}
                    {' '.repeat(Math.max(parsed.column - 1, 0))}
                    <span className="text-danger">^</span>
                  </>
                ) : null}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}

      {value !== null && stats ? (
        <>
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">{t.stats}</h2>
              <Badge tone="success">{t.valid}</Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {statRows.map(([label, count]) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 rounded-card border border-border bg-surface px-3 py-2"
                >
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-mono text-title">{count}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Badge tone="neutral">
                {t.sizeBefore}: {formatBytes(size)}
              </Badge>
              <Badge tone="neutral">
                {t.sizeMinified}: {formatBytes(minifiedSize)}
              </Badge>
              {saved > 0 ? (
                <Badge tone="accent">{format(t.sizeSaved, { percent: saved })}</Badge>
              ) : null}
            </div>
          </section>

          {tree ? (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold">{t.tree}</h2>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => expandTo(Number.MAX_SAFE_INTEGER)}
                  >
                    {t.treeExpandAll}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setOpen(new Set())}>
                    {t.treeCollapseAll}
                  </Button>
                </div>
              </div>

              <ul className="overflow-x-auto rounded-card border border-border bg-surface p-3">
                <JsonTree
                  node={tree}
                  depth={0}
                  open={open.size === 0 ? defaultOpen(tree) : open}
                  onToggle={toggle}
                  copyLabel={t.copyPath}
                  itemsLabel={t.items}
                />
              </ul>
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={typeNameId}>{t.typeName}</Label>
                <Input
                  id={typeNameId}
                  value={typeName}
                  spellCheck={false}
                  onChange={(event) =>
                    setUrlState({ [URL_TYPE_NAME_KEY]: event.target.value })
                  }
                  className="font-mono"
                />
              </div>
              <CopyButton
                value={toTypeScript(value, typeName || DEFAULT_TYPE_NAME)}
                variant="secondary"
                size="sm"
                showLabel
              />
            </div>

            <h2 className="text-base font-semibold">{t.typescript}</h2>
            <pre className="overflow-x-auto rounded-card border border-border bg-surface p-4 font-mono text-sm">
              {toTypeScript(value, typeName || DEFAULT_TYPE_NAME)}
            </pre>
          </section>
        </>
      ) : null}
    </div>
  );
}

/** Opened down a couple of levels, so a fresh document is readable at a glance. */
function defaultOpen(tree: TreeNode): Set<string> {
  const paths = new Set<string>();
  pathsToDepth(tree, AUTO_EXPAND_DEPTH, paths);
  return paths;
}
