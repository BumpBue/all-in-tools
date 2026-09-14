// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CommandPaletteProvider } from '@/components/command-palette/provider';
import { TOOL_COUNT } from '@/config/tools';
import { PreferencesProvider } from '@/hooks/use-preferences';
import type { Preferences } from '@/lib/cookies';
import { pressKey, render, typeInto } from '@/test/react';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

const BASE_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'th',
  favorites: [],
  recent: [],
};

function open(preferences: Partial<Preferences> = {}) {
  const view = render(
    <PreferencesProvider initial={{ ...BASE_PREFERENCES, ...preferences }}>
      <CommandPaletteProvider>
        <input data-testid="outside" />
      </CommandPaletteProvider>
    </PreferencesProvider>,
  );

  openWithCtrl();
  return view;
}

function dialog(): HTMLElement | null {
  return document.querySelector('[role="dialog"]');
}

function input(): HTMLInputElement {
  return document.querySelector('[role="combobox"]') as HTMLInputElement;
}

function optionLabels(): string[] {
  return [...document.querySelectorAll('[role="option"]')].map(
    (node) => node.querySelector('.font-medium')?.textContent ?? '',
  );
}

function openWithCtrl() {
  pressKey(document, 'k', { ctrlKey: true });
}

beforeEach(() => {
  push.mockClear();
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.style.overflow = '';
});

describe('opening and closing', () => {
  it('stays closed until a shortcut fires', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    expect(dialog()).toBeNull();
    view.unmount();
  });

  it('opens on Ctrl+K', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    openWithCtrl();
    expect(dialog()).not.toBeNull();
    view.unmount();
  });

  it('opens on a bare slash', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    pressKey(document.body, '/');
    expect(dialog()).not.toBeNull();
    view.unmount();
  });

  it('ignores a slash typed into a text field', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>
          <input data-testid="outside" />
        </CommandPaletteProvider>
      </PreferencesProvider>,
    );

    const field = document.querySelector('[data-testid="outside"]') as HTMLElement;
    field.focus();
    pressKey(field, '/');

    expect(dialog()).toBeNull();
    view.unmount();
  });

  it('marks itself as a modal dialog', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    openWithCtrl();
    expect(dialog()?.getAttribute('aria-modal')).toBe('true');
    view.unmount();
  });

  it('locks body scroll while open and releases it on close', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    openWithCtrl();
    expect(document.body.style.overflow).toBe('hidden');

    pressKey(input(), 'Escape');
    expect(dialog()).toBeNull();
    expect(document.body.style.overflow).not.toBe('hidden');
    view.unmount();
  });
});

describe('the empty state lists everything', () => {
  it('shows all 36 tools grouped by category', () => {
    const view = render(
      <PreferencesProvider initial={BASE_PREFERENCES}>
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    openWithCtrl();
    expect(optionLabels()).toHaveLength(TOOL_COUNT);
    view.unmount();
  });

  it('puts recently used tools first', () => {
    const view = render(
      <PreferencesProvider
        initial={{ ...BASE_PREFERENCES, recent: ['base64', 'qr-generator'] }}
      >
        <CommandPaletteProvider>{null}</CommandPaletteProvider>
      </PreferencesProvider>,
    );

    openWithCtrl();
    const labels = optionLabels();

    expect(labels[0]).toContain('Base64');
    expect(labels[1]).toContain('QR Code');
    view.unmount();
  });
});

describe('searching', () => {
  it('finds a tool by a Thai keyword', () => {
    const view = open();
    typeInto(input(), 'ไบนารี');

    expect(optionLabels()[0]).toContain('แปลงเลขฐาน');
    view.unmount();
  });

  it('finds a tool by an English keyword', () => {
    const view = open();
    typeInto(input(), 'hexadecimal');

    expect(optionLabels()[0]).toContain('แปลงเลขฐาน');
    view.unmount();
  });

  it('highlights the matching part of the name', () => {
    const view = open();
    typeInto(input(), 'เลขฐาน');

    expect(document.querySelector('mark')?.textContent).toBe('เลขฐาน');
    view.unmount();
  });

  it('sorts ready tools ahead of planned ones', () => {
    const view = open();
    typeInto(input(), 'แปลง');

    const statuses = [...document.querySelectorAll('[role="option"]')].map((node) =>
      node.textContent?.includes('เร็วๆ นี้') ? 'planned' : 'ready',
    );
    const firstPlanned = statuses.indexOf('planned');
    const lastReady = statuses.lastIndexOf('ready');

    expect(firstPlanned).toBeGreaterThan(-1);
    expect(lastReady).toBeLessThan(firstPlanned);
    view.unmount();
  });

  it('shows an empty state when nothing matches', () => {
    const view = open();
    typeInto(input(), 'zzzqqqxyw');

    expect(optionLabels()).toHaveLength(0);
    expect(document.body.textContent).toContain('ไม่พบเครื่องมือ');
    view.unmount();
  });
});

describe('keyboard navigation', () => {
  it('selects the first option on open', () => {
    const view = open();
    const options = document.querySelectorAll('[role="option"]');

    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    view.unmount();
  });

  it('points aria-activedescendant at the selected option', () => {
    const view = open();
    const selected = document.querySelector('[aria-selected="true"]');

    expect(input().getAttribute('aria-activedescendant')).toBe(selected?.id);
    view.unmount();
  });

  it('moves down with ArrowDown', () => {
    const view = open();
    pressKey(input(), 'ArrowDown');

    const options = document.querySelectorAll('[role="option"]');
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    view.unmount();
  });

  it('wraps from the first option to the last with ArrowUp', () => {
    const view = open();
    pressKey(input(), 'ArrowUp');

    const options = document.querySelectorAll('[role="option"]');
    expect(options[options.length - 1]?.getAttribute('aria-selected')).toBe('true');
    view.unmount();
  });

  it('opens the selected tool on Enter', () => {
    const view = open();
    typeInto(input(), 'ไบนารี');
    pressKey(input(), 'Enter');

    expect(push).toHaveBeenCalledWith('/tools/base-converter');
    view.unmount();
  });

  it('closes after navigating', () => {
    const view = open();
    typeInto(input(), 'ไบนารี');
    pressKey(input(), 'Enter');

    expect(dialog()).toBeNull();
    view.unmount();
  });

  it('resets the selection when the query changes', () => {
    const view = open();
    pressKey(input(), 'ArrowDown');
    pressKey(input(), 'ArrowDown');
    typeInto(input(), 'json');

    const options = document.querySelectorAll('[role="option"]');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    view.unmount();
  });

  it('does nothing on Enter when there are no results', () => {
    const view = open();
    typeInto(input(), 'zzzqqqxyw');
    pressKey(input(), 'Enter');

    expect(push).not.toHaveBeenCalled();
    view.unmount();
  });
});
