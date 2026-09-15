// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataSettings } from '@/components/settings/data-settings';
import { buildToolStorageKey } from '@/config/storage-keys';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { invalidateStoredData } from '@/hooks/use-stored-data';
import type { Preferences } from '@/lib/cookies';
import { getItem, setItem } from '@/lib/storage';
import { click, pressKey, render, typeInto } from '@/test/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const BASE_PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'th',
  favorites: [],
  recent: [],
};

const POMODORO_KEY = buildToolStorageKey('pomodoro');
const HABIT_KEY = buildToolStorageKey('habit-tracker');
const CONFIRM_WORD = 'ลบทั้งหมด';

// Shaped the way each tool really stores its data, since both declare their
// own item counter: three days of pomodoro rounds, two tracked habits.
function seedFakeData() {
  setItem(POMODORO_KEY, {
    schema: 1,
    days: {
      '2026-09-13': { rounds: 2, focusSeconds: 3000 },
      '2026-09-14': { rounds: 4, focusSeconds: 6000 },
      '2026-09-15': { rounds: 1, focusSeconds: 1500 },
    },
  });
  setItem(HABIT_KEY, { reading: [1, 2], water: [3] });
  invalidateStoredData();
}

function mount() {
  return render(
    <PreferencesProvider initial={BASE_PREFERENCES}>
      <DataSettings />
    </PreferencesProvider>,
  );
}

function rows(): HTMLElement[] {
  return [...document.querySelectorAll('li')].filter((node) =>
    node.querySelector('button[title]'),
  ) as HTMLElement[];
}

// By name rather than by position: the list is ordered by save time, and two
// tools seeded in the same millisecond can come back either way round.
function rowFor(name: string): HTMLElement {
  const row = rows().find((node) => node.textContent?.includes(name));
  if (!row) throw new Error(`no row for ${name}`);
  return row;
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((node) =>
    node.textContent?.includes(text),
  );
}

function confirmInput(): HTMLInputElement {
  return document.querySelector('input[type="text"], input:not([type])') as HTMLInputElement;
}

beforeEach(() => {
  window.localStorage.clear();
  invalidateStoredData();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('with no stored data', () => {
  it('shows the empty state instead of a list', () => {
    const view = mount();

    expect(document.body.textContent).toContain('ยังไม่มีเครื่องมือไหนเก็บข้อมูลไว้');
    expect(rows()).toHaveLength(0);
    view.unmount();
  });

  it('disables the export button', () => {
    const view = mount();
    expect(buttonByText('ยังไม่มีข้อมูลให้สำรอง')?.disabled).toBe(true);
    view.unmount();
  });
});

describe('with fake data seeded', () => {
  beforeEach(seedFakeData);

  it('lists every tool holding data', () => {
    const view = mount();
    expect(rows()).toHaveLength(2);
    view.unmount();
  });

  it('names the tools in the reader language', () => {
    const view = mount();
    const text = document.body.textContent ?? '';

    expect(text).toContain('Focus & Pomodoro Timer');
    expect(text).toContain('Habit Tracker');
    view.unmount();
  });

  it('counts array entries and object keys as items', () => {
    const view = mount();
    const text = document.body.textContent ?? '';

    expect(text).toContain('3 รายการ');
    expect(text).toContain('2 รายการ');
    view.unmount();
  });

  it('reports the space in use', () => {
    const view = mount();
    expect(document.body.textContent).toMatch(/ใช้พื้นที่ไปประมาณ \d/);
    view.unmount();
  });

  it('enables export once there is something to save', () => {
    const view = mount();
    expect(buttonByText('ดาวน์โหลดไฟล์สำรอง')?.disabled).toBe(false);
    view.unmount();
  });

  it('deletes one tool without touching the other', () => {
    const view = mount();

    click(rowFor('Focus & Pomodoro Timer').querySelector('button'));

    expect(getItem(POMODORO_KEY, null)).toBeNull();
    expect(getItem(HABIT_KEY, null)).not.toBeNull();
    view.unmount();
  });

  it('drops the row for a deleted tool', () => {
    const view = mount();
    click(rowFor('Focus & Pomodoro Timer').querySelector('button'));

    expect(rows()).toHaveLength(1);
    view.unmount();
  });
});

describe('deleting everything', () => {
  beforeEach(seedFakeData);

  it('keeps the button disabled until the word is typed', () => {
    const view = mount();
    expect(buttonByText('ยืนยันการลบ')?.disabled).toBe(true);
    view.unmount();
  });

  it('stays disabled for a near miss', () => {
    const view = mount();
    typeInto(confirmInput(), 'ลบ');

    expect(buttonByText('ยืนยันการลบ')?.disabled).toBe(true);
    view.unmount();
  });

  it('enables only on the exact word', () => {
    const view = mount();
    typeInto(confirmInput(), CONFIRM_WORD);

    expect(buttonByText('ยืนยันการลบ')?.disabled).toBe(false);
    view.unmount();
  });

  it('clears every tool once confirmed', () => {
    const view = mount();
    typeInto(confirmInput(), CONFIRM_WORD);
    click(buttonByText('ยืนยันการลบ'));

    expect(getItem(POMODORO_KEY, null)).toBeNull();
    expect(getItem(HABIT_KEY, null)).toBeNull();
    expect(document.body.textContent).toContain('ล้างข้อมูลเรียบร้อยแล้ว');
    view.unmount();
  });

  it('does not fire on Enter alone', () => {
    const view = mount();
    pressKey(confirmInput(), 'Enter');

    expect(getItem(POMODORO_KEY, null)).not.toBeNull();
    view.unmount();
  });
});

describe('export', () => {
  beforeEach(seedFakeData);

  it('downloads a dated json file', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:fake');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });

    const clicks: HTMLAnchorElement[] = [];
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
      clicks.push(this);
    };

    const view = mount();
    click(buttonByText('ดาวน์โหลดไฟล์สำรอง'));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
    expect(clicks[0]?.download).toMatch(/^toolbox-backup-\d{4}-\d{2}-\d{2}\.json$/);

    HTMLAnchorElement.prototype.click = originalClick;
    view.unmount();
  });

  it('leaves no anchor behind in the document', () => {
    Object.assign(URL, {
      createObjectURL: vi.fn().mockReturnValue('blob:fake'),
      revokeObjectURL: vi.fn(),
    });
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = () => {};

    const view = mount();
    click(buttonByText('ดาวน์โหลดไฟล์สำรอง'));

    expect(document.querySelectorAll('a[download]')).toHaveLength(0);

    HTMLAnchorElement.prototype.click = originalClick;
    view.unmount();
  });
});
