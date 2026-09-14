'use client';

import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { buttonClasses } from '@/components/ui/button';
import { Badge } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { format } from '@/config/i18n';
import {
  CATEGORY_META,
  CATEGORY_ORDER,
  TOOLS_BY_CATEGORY,
  getTool,
  searchTools,
  type Tool,
} from '@/config/tools';
import { usePreferences } from '@/hooks/use-preferences';
import { useLocale, useT } from '@/hooks/use-t';
import { cn } from '@/lib/utils';

const ICON_SIZE = 16;
const TOOL_ICON_SIZE = 18;

interface PaletteGroup {
  id: string;
  label: string;
  tools: Tool[];
}

function Highlight({ text, query }: { text: string; query: string }) {
  const index = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1;
  if (index === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, index)}
      <mark className="bg-accent-subtle text-accent">
        {text.slice(index, index + query.length)}
      </mark>
      {text.slice(index + query.length)}
    </>
  );
}

function isTypingTarget(node: EventTarget | null): boolean {
  if (!(node instanceof HTMLElement)) return false;
  return (
    node.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(node.tagName)
  );
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const { recent } = usePreferences();

  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const baseId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const groups = useMemo<PaletteGroup[]>(() => {
    const trimmed = query.trim();

    if (trimmed.length === 0) {
      const recentTools = recent
        .map(getTool)
        .filter((tool): tool is Tool => tool !== undefined);

      return [
        ...(recentTools.length > 0
          ? [{ id: 'recent', label: t.home.recent, tools: recentTools }]
          : []),
        ...CATEGORY_ORDER.map((category) => ({
          id: category,
          label: CATEGORY_META[category][locale],
          tools: TOOLS_BY_CATEGORY[category],
        })),
      ];
    }

    // Planned tools stay visible but never outrank one that actually works.
    const found = searchTools(trimmed);
    const ready = found.filter((tool) => tool.status === 'ready');
    const planned = found.filter((tool) => tool.status !== 'ready');

    return [{ id: 'results', label: t.home.allTools, tools: [...ready, ...planned] }];
  }, [locale, query, recent, t.home.allTools, t.home.recent]);

  const flat = useMemo(() => groups.flatMap((group) => group.tools), [groups]);
  const activeSafeIndex = Math.min(activeIndex, Math.max(flat.length - 1, 0));
  const optionId = (index: number) => `${baseId}-option-${index}`;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();

    const { body, documentElement } = document;
    const scrollbarWidth = window.innerWidth - documentElement.clientWidth;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingRight;

    body.style.overflow = 'hidden';
    body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingRight = previousPadding;
      previouslyFocused?.focus();
    };
  }, []);

  useEffect(() => {
    document
      .getElementById(`${baseId}-option-${activeSafeIndex}`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [activeSafeIndex, baseId, groups]);

  const goTo = (tool: Tool | undefined) => {
    if (!tool) return;
    router.push(`/tools/${tool.slug}`);
    onClose();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === 'Tab') {
      event.preventDefault();
      const target = document.activeElement === inputRef.current ? closeRef : inputRef;
      target.current?.focus();
      return;
    }

    if (flat.length === 0) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % flat.length);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => (current - 1 + flat.length) % flat.length);
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActiveIndex(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActiveIndex(flat.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      goTo(flat[activeSafeIndex]);
    }
  };

  let renderIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-overlay sm:items-center sm:p-6 sm:pt-[12vh]"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.search.trigger}
        onKeyDown={onKeyDown}
        className="flex h-full w-full flex-col overflow-hidden bg-surface sm:h-auto sm:max-h-[70vh] sm:max-w-xl sm:rounded-panel sm:border sm:border-border sm:shadow-2xl"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4">
          <Search size={ICON_SIZE} className="shrink-0 text-muted" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={`${baseId}-list`}
            aria-activedescendant={
              flat.length > 0 ? optionId(activeSafeIndex) : undefined
            }
            aria-autocomplete="list"
            aria-label={t.search.placeholder}
            placeholder={t.search.placeholder}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            className="h-14 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted"
          />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.search.close}
            className={buttonClasses({ variant: 'ghost', size: 'icon', className: 'shrink-0' })}
          >
            <X size={ICON_SIZE} aria-hidden />
          </button>
        </div>

        <p role="status" aria-live="polite" className="sr-only">
          {format(t.search.results, { count: flat.length })}
        </p>

        <div
          id={`${baseId}-list`}
          role="listbox"
          aria-label={t.search.trigger}
          className="flex-1 overflow-y-auto overscroll-contain p-2"
        >
          {flat.length === 0 ? (
            <div className="flex flex-col items-center gap-1 px-4 py-12 text-center">
              <p className="font-medium">{t.search.empty}</p>
              <p className="text-sm text-muted">{t.search.emptyHint}</p>
            </div>
          ) : (
            groups.map((group) => (
              <div key={group.id} role="group" aria-label={group.label}>
                <p className="px-2 pb-1 pt-3 text-xs font-medium text-muted">
                  {group.label}
                </p>
                {group.tools.map((tool) => {
                  renderIndex += 1;
                  const index = renderIndex;
                  const active = index === activeSafeIndex;

                  return (
                    <div
                      key={`${group.id}:${tool.slug}`}
                      id={optionId(index)}
                      role="option"
                      aria-selected={active}
                      onPointerMove={() => setActiveIndex(index)}
                      onClick={() => goTo(tool)}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 rounded-control px-2 py-2',
                        active && 'bg-surface-subtle',
                      )}
                    >
                      <span
                        style={{ color: CATEGORY_META[tool.category].color }}
                        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-surface-subtle"
                      >
                        <Icon name={tool.icon} size={TOOL_ICON_SIZE} aria-hidden />
                      </span>

                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          <Highlight text={tool.name[locale]} query={query.trim()} />
                        </span>
                        <span className="truncate text-xs text-muted">
                          {tool.description[locale]}
                        </span>
                      </span>

                      {tool.status === 'planned' ? (
                        <Badge tone="muted" className="ml-auto shrink-0">
                          {t.tool.comingSoon}
                        </Badge>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="hidden shrink-0 items-center gap-4 border-t border-border px-4 py-2 text-xs text-muted sm:flex">
          <span>
            <kbd className="font-mono">↑↓</kbd> {t.search.hintNavigate}
          </span>
          <span>
            <kbd className="font-mono">↵</kbd> {t.search.hintSelect}
          </span>
          <span>
            <kbd className="font-mono">esc</kbd> {t.search.hintClose}
          </span>
        </div>
      </div>
    </div>
  );
}

export { isTypingTarget };
