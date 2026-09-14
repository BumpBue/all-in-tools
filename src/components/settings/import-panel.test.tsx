// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataSettings } from '@/components/settings/data-settings';
import { buildToolStorageKey } from '@/config/storage-keys';
import { PreferencesProvider } from '@/hooks/use-preferences';
import { invalidateStoredData } from '@/hooks/use-stored-data';
import type { Preferences } from '@/lib/cookies';
import { getItem, setItem } from '@/lib/storage';
import {
  chooseFile,
  click,
  dropFile,
  jsonFile,
  render,
  settle,
} from '@/test/react';

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

const BACKUP = JSON.stringify({
  app: 'tools',
  schemaVersion: 1,
  tools: {
    pomodoro: { version: 1, data: [{ from: 'file' }], updatedAt: 10 },
  },
});

function mount() {
  return render(
    <PreferencesProvider initial={BASE_PREFERENCES}>
      <DataSettings />
    </PreferencesProvider>,
  );
}

function fileInput(): HTMLInputElement {
  return document.querySelector('input[type="file"]') as HTMLInputElement;
}

function dropZone(): HTMLElement {
  return [...document.querySelectorAll('button')].find((node) =>
    node.textContent?.includes('ลากไฟล์'),
  ) as HTMLElement;
}

function buttonByText(text: string): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((node) =>
    node.textContent?.includes(text),
  );
}

function modeRadio(value: string): HTMLInputElement {
  return document.querySelector(
    `input[type="radio"][value="${value}"]`,
  ) as HTMLInputElement;
}

function bodyText(): string {
  return document.body.textContent ?? '';
}

function seedExisting() {
  setItem(POMODORO_KEY, [{ from: 'existing' }, { from: 'existing' }]);
  setItem(HABIT_KEY, { reading: [1] });
  invalidateStoredData();
}

beforeEach(() => {
  window.localStorage.clear();
  invalidateStoredData();
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('choosing a file', () => {
  it('shows a review before writing anything', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();

    expect(bodyText()).toContain('ตรวจสอบก่อนนำเข้า');
    expect(bodyText()).toContain('ไฟล์นี้จะเขียนข้อมูลของ 1 เครื่องมือ');
    view.unmount();
  });

  it('names the tools the file would write', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();

    expect(bodyText()).toContain('Focus & Pomodoro Timer');
    view.unmount();
  });

  it('writes nothing until the review is confirmed', async () => {
    seedExisting();
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();

    expect(getItem(POMODORO_KEY, null)).toEqual([
      { from: 'existing' },
      { from: 'existing' },
    ]);
    view.unmount();
  });
});

describe('dropping a file', () => {
  it('opens the same review as the picker', async () => {
    const view = mount();
    dropFile(dropZone(), jsonFile('backup.json', BACKUP));
    await settle();

    expect(bodyText()).toContain('ตรวจสอบก่อนนำเข้า');
    view.unmount();
  });

  it('imports on confirmation just like the picker', async () => {
    const view = mount();
    dropFile(dropZone(), jsonFile('backup.json', BACKUP));
    await settle();
    click(buttonByText('นำเข้าเลย'));

    expect(getItem(POMODORO_KEY, null)).toEqual([{ from: 'file' }]);
    view.unmount();
  });
});

describe('rejecting a bad file', () => {
  it('says the file is not readable JSON', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('notes.txt', 'hello there', 'text/plain'));
    await settle();

    expect(bodyText()).toContain('นำเข้าไม่ได้');
    expect(bodyText()).toContain('ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้');
    view.unmount();
  });

  it('says when valid JSON is the wrong kind of file', async () => {
    const view = mount();
    chooseFile(
      fileInput(),
      jsonFile('other.json', JSON.stringify({ app: 'something-else', tools: {} })),
    );
    await settle();

    expect(bodyText()).toContain('ไฟล์นี้ไม่ใช่ไฟล์สำรองข้อมูลของเว็บนี้');
    view.unmount();
  });

  it('names the tool whose entry is malformed', async () => {
    const view = mount();
    chooseFile(
      fileInput(),
      jsonFile(
        'broken.json',
        JSON.stringify({
          app: 'tools',
          schemaVersion: 1,
          tools: { pomodoro: { data: 'no envelope' } },
        }),
      ),
    );
    await settle();

    expect(bodyText()).toContain('ข้อมูลของ pomodoro ไม่ครบถ้วน');
    view.unmount();
  });

  it('offers no confirm button for a rejected file', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('notes.txt', 'nope', 'text/plain'));
    await settle();

    expect(buttonByText('นำเข้าเลย')).toBeUndefined();
    view.unmount();
  });
});

describe('cancelling', () => {
  it('writes nothing and closes the review', async () => {
    seedExisting();
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();
    click(buttonByText('ยกเลิก'));

    expect(bodyText()).not.toContain('ตรวจสอบก่อนนำเข้า');
    expect(getItem(POMODORO_KEY, null)).toEqual([
      { from: 'existing' },
      { from: 'existing' },
    ]);
    view.unmount();
  });
});

describe('merge versus replace', () => {
  it('defaults to merge', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();

    expect(modeRadio('merge').checked).toBe(true);
    expect(modeRadio('replace').checked).toBe(false);
    view.unmount();
  });

  it('merge overwrites the matching tool and keeps the rest', async () => {
    seedExisting();
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();
    click(buttonByText('นำเข้าเลย'));

    expect(getItem(POMODORO_KEY, null)).toEqual([{ from: 'file' }]);
    expect(getItem(HABIT_KEY, null)).toEqual({ reading: [1] });
    view.unmount();
  });

  it('replace drops tools that are not in the file', async () => {
    seedExisting();
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();
    click(modeRadio('replace'));
    click(buttonByText('นำเข้าเลย'));

    expect(getItem(POMODORO_KEY, null)).toEqual([{ from: 'file' }]);
    expect(getItem(HABIT_KEY, null)).toBeNull();
    view.unmount();
  });

  it('reports how many tools were imported', async () => {
    const view = mount();
    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();
    click(buttonByText('นำเข้าเลย'));

    expect(bodyText()).toContain('นำเข้าข้อมูลของ 1 เครื่องมือแล้ว');
    view.unmount();
  });

  it('refreshes the stored list after importing', async () => {
    const view = mount();
    expect(bodyText()).toContain('ยังไม่มีเครื่องมือไหนเก็บข้อมูลไว้');

    chooseFile(fileInput(), jsonFile('backup.json', BACKUP));
    await settle();
    click(buttonByText('นำเข้าเลย'));

    expect(bodyText()).not.toContain('ยังไม่มีเครื่องมือไหนเก็บข้อมูลไว้');
    expect(bodyText()).toContain('Focus & Pomodoro Timer');
    view.unmount();
  });
});
