// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PreferencesProvider } from '@/hooks/use-preferences';
import type { Preferences } from '@/lib/cookies';
import { render, settleTasks as settle, settleUntil, typeInto } from '@/test/react';
import JwtDecoder from '@/tools/jwt-decoder';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const PREFERENCES: Preferences = {
  theme: 'system',
  locale: 'th',
  favorites: [],
  recent: [],
};

const HS256 =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

const SECRET = 'your-256-bit-secret';

function open() {
  return render(
    <PreferencesProvider initial={PREFERENCES}>
      <JwtDecoder />
    </PreferencesProvider>,
  );
}

function tokenBox(): HTMLTextAreaElement {
  const box = document.querySelector('textarea');
  if (!box) throw new Error('no token box');
  return box;
}

function secretBox(): HTMLInputElement {
  const box = document.querySelector('input[type="password"]');
  if (!box) throw new Error('no secret box');
  return box as HTMLInputElement;
}

function pasteToken(token: string): void {
  const box = tokenBox();
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  )?.set;

  act(() => {
    setter?.call(box, token);
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  window.history.replaceState(null, '', '/tools/jwt-decoder');
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('JwtDecoder', () => {
  it('shows the header and payload of a pasted token', async () => {
    const view = open();
    pasteToken(HS256);
    await settle();

    expect(document.body.textContent).toContain('HS256');
    expect(document.body.textContent).toContain('John Doe');
    view.unmount();
  });

  it('names the broken part of a malformed token', async () => {
    const view = open();
    pasteToken('a.b');
    await settle();

    expect(document.querySelector('[role="alert"]')?.textContent).toContain('3');
    view.unmount();
  });

  it('accepts the right secret and refuses a wrong one', async () => {
    const view = open();
    pasteToken(HS256);
    await settle();

    typeInto(secretBox(), SECRET);
    await settleUntil(
      () => document.body.textContent?.includes('ลายเซ็นถูกต้อง') === true,
      'the signature to be accepted',
    );

    typeInto(secretBox(), 'wrong');
    await settleUntil(
      () => document.body.textContent?.includes('ลายเซ็นถูกต้อง') === false,
      'the wrong secret to be refused',
    );

    view.unmount();
  });

  // The point of the tool: neither the token nor the secret may end up anywhere
  // that outlives the tab or travels in a link.
  it('puts nothing in the URL', async () => {
    const view = open();
    pasteToken(HS256);
    typeInto(secretBox(), SECRET);
    await settle();

    expect(window.location.search).toBe('');
    expect(window.location.href).not.toContain('eyJ');
    view.unmount();
  });

  it('writes nothing to storage', async () => {
    const view = open();
    pasteToken(HS256);
    typeInto(secretBox(), SECRET);
    await settle();

    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    view.unmount();
  });

  it('forgets both the token and the secret when cleared', async () => {
    const view = open();
    pasteToken(HS256);
    typeInto(secretBox(), SECRET);
    await settle();

    const clear = [...document.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('ล้างทั้งหมด'),
    );
    clear?.click();
    await settle();

    expect(tokenBox().value).toBe('');
    expect(document.querySelector('input[type="password"]')).toBeNull();
    expect(document.body.textContent).not.toContain('John Doe');
    view.unmount();
  });
});
