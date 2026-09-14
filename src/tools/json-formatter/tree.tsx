'use client';

import { ChevronDown, ChevronRight } from 'lucide-react';

import { CopyButton } from '@/components/ui/copy-button';
import { format } from '@/config/i18n';
import { minifyJson, type TreeNode } from '@/tools/json-formatter/logic';

const ICON_SIZE = 14;
const PREVIEW_LIMIT = 60;
const INDENT_REM = 1.1;

const KIND_COLORS: Record<string, string> = {
  string: 'text-success',
  number: 'text-accent',
  boolean: 'text-accent',
  null: 'text-muted',
  array: 'text-muted',
  object: 'text-muted',
};

function preview(node: TreeNode): string {
  const text = minifyJson(node.value);
  return text.length > PREVIEW_LIMIT ? `${text.slice(0, PREVIEW_LIMIT)}…` : text;
}

export function JsonTree({
  node,
  depth,
  open,
  onToggle,
  copyLabel,
  itemsLabel,
}: {
  node: TreeNode;
  depth: number;
  open: ReadonlySet<string>;
  onToggle: (path: string) => void;
  copyLabel: string;
  itemsLabel: string;
}) {
  const branch = node.children.length > 0;
  const expanded = open.has(node.path);

  return (
    <li>
      <div
        style={{ paddingInlineStart: `${depth * INDENT_REM}rem` }}
        className="flex flex-wrap items-center gap-1.5 py-0.5"
      >
        {branch ? (
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => onToggle(node.path)}
            className="inline-flex size-5 items-center justify-center rounded text-muted hover:text-foreground"
          >
            {expanded ? (
              <ChevronDown size={ICON_SIZE} aria-hidden />
            ) : (
              <ChevronRight size={ICON_SIZE} aria-hidden />
            )}
          </button>
        ) : (
          <span className="inline-block size-5" aria-hidden />
        )}

        <span className="font-mono text-sm">{node.label}</span>

        {branch ? (
          <span className="text-xs text-muted">
            {format(itemsLabel, { count: node.children.length })}
          </span>
        ) : (
          <span className={`font-mono text-sm ${KIND_COLORS[node.kind] ?? ''}`}>
            {preview(node)}
          </span>
        )}

        <CopyButton
          value={node.path}
          label={format(copyLabel, { path: node.path })}
          variant="ghost"
          size="icon"
        />
      </div>

      {branch && expanded ? (
        <ul>
          {node.children.map((child) => (
            <JsonTree
              key={child.path}
              node={child}
              depth={depth + 1}
              open={open}
              onToggle={onToggle}
              copyLabel={copyLabel}
              itemsLabel={itemsLabel}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
