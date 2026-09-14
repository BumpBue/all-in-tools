// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildToolStorageKey } from '@/config/storage-keys';
import { useLocalStorage } from '@/hooks/use-local-storage';
import { setItem } from '@/lib/storage';
import { renderHook } from '@/test/render-hook';

const KEY = buildToolStorageKey('pomodoro');
const OTHER_KEY = buildToolStorageKey('flashcards');
const DEBOUNCE_MS = 100;

interface Session {
  minutes: number;
}

const INITIAL: Session = { minutes: 25 };
const STORED: Session = { minutes: 50 };

function storedValue<T>(key: string): T | undefined {
  const raw = window.localStorage.getItem(key);
  return raw === undefined || raw === null
    ? undefined
    : (JSON.parse(raw).data as T);
}

function emitStorageEvent(key: string) {
  window.dispatchEvent(new StorageEvent('storage', { key }));
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('first render and loading', () => {
  it('returns the initial value before reading storage', () => {
    setItem(KEY, STORED);
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    expect(hook.renders[0]?.[0]).toEqual(INITIAL);
    hook.unmount();
  });

  it('settles on the stored value after mount', () => {
    setItem(KEY, STORED);
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    expect(hook.current()[0]).toEqual(STORED);
    hook.unmount();
  });

  it('keeps the initial value when nothing is stored', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    expect(hook.current()[0]).toEqual(INITIAL);
    hook.unmount();
  });

  it('reports isLoaded false on the first render and true afterwards', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    expect(hook.renders[0]?.[2].isLoaded).toBe(false);
    expect(hook.current()[2].isLoaded).toBe(true);
    hook.unmount();
  });

  it('starts with no error', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));
    expect(hook.current()[2].error).toBeNull();
    hook.unmount();
  });
});

describe('writing', () => {
  it('persists a plain value', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    act(() => hook.current()[1]({ minutes: 15 }));

    expect(hook.current()[0]).toEqual({ minutes: 15 });
    expect(storedValue<Session>(KEY)).toEqual({ minutes: 15 });
    hook.unmount();
  });

  it('persists a value produced by an updater', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    act(() =>
      hook.current()[1]((previous) => ({ minutes: previous.minutes + 5 })),
    );

    expect(storedValue<Session>(KEY)).toEqual({ minutes: 30 });
    hook.unmount();
  });

  it('gives the updater the latest value across consecutive calls', () => {
    const hook = renderHook(() => useLocalStorage<number>(KEY, 0));

    act(() => {
      const [, set] = hook.current();
      set((n) => n + 1);
      set((n) => n + 1);
      set((n) => n + 1);
    });

    expect(hook.current()[0]).toBe(3);
    hook.unmount();
  });
});

describe('null as a real value', () => {
  it('stores null instead of treating it as absent', () => {
    const hook = renderHook(() =>
      useLocalStorage<Session | null>(KEY, INITIAL),
    );

    act(() => hook.current()[1](null));

    expect(hook.current()[0]).toBeNull();
    expect(storedValue<Session | null>(KEY)).toBeNull();
    hook.unmount();
  });

  it('reads a stored null back as null, not as the initial value', () => {
    setItem(KEY, null);
    const hook = renderHook(() =>
      useLocalStorage<Session | null>(KEY, INITIAL),
    );

    expect(hook.current()[0]).toBeNull();
    hook.unmount();
  });

  it('flushes a debounced null on unmount', () => {
    vi.useFakeTimers();
    const hook = renderHook(() =>
      useLocalStorage<Session | null>(KEY, INITIAL, { debounceMs: DEBOUNCE_MS }),
    );

    act(() => hook.current()[1](null));
    hook.unmount();

    expect(storedValue<Session | null>(KEY)).toBeNull();
  });
});

describe('cross-tab sync', () => {
  it('picks up a change another tab made to the same key', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    setItem(KEY, STORED);
    act(() => emitStorageEvent(KEY));

    expect(hook.current()[0]).toEqual(STORED);
    hook.unmount();
  });

  it('ignores events for a different key', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));
    const rendersBefore = hook.renders.length;

    setItem(OTHER_KEY, STORED);
    act(() => emitStorageEvent(OTHER_KEY));

    expect(hook.current()[0]).toEqual(INITIAL);
    expect(hook.renders.length).toBe(rendersBefore);
    hook.unmount();
  });

  it('stops listening after unmount', () => {
    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));
    hook.unmount();

    setItem(KEY, STORED);
    expect(() => emitStorageEvent(KEY)).not.toThrow();
  });
});

describe('debounced writes', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('updates state immediately without waiting for the timer', () => {
    const hook = renderHook(() =>
      useLocalStorage<number>(KEY, 0, { debounceMs: DEBOUNCE_MS }),
    );

    act(() => hook.current()[1](7));

    expect(hook.current()[0]).toBe(7);
    expect(storedValue<number>(KEY)).toBeUndefined();
    hook.unmount();
  });

  it('writes once for a burst of updates, keeping the last value', () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem');
    const hook = renderHook(() =>
      useLocalStorage<number>(KEY, 0, { debounceMs: DEBOUNCE_MS }),
    );

    act(() => {
      const [, set] = hook.current();
      set(1);
      set(2);
      set(3);
    });
    act(() => vi.advanceTimersByTime(DEBOUNCE_MS));

    expect(setSpy).toHaveBeenCalledTimes(1);
    expect(storedValue<number>(KEY)).toBe(3);
    hook.unmount();
  });

  it('writes on every call when debouncing is off', () => {
    const setSpy = vi.spyOn(window.localStorage, 'setItem');
    const hook = renderHook(() => useLocalStorage<number>(KEY, 0));

    act(() => {
      const [, set] = hook.current();
      set(1);
      set(2);
    });

    expect(setSpy).toHaveBeenCalledTimes(2);
    hook.unmount();
  });

  it('does not lose a pending write when the component unmounts', () => {
    const hook = renderHook(() =>
      useLocalStorage<number>(KEY, 0, { debounceMs: DEBOUNCE_MS }),
    );

    act(() => hook.current()[1](42));
    hook.unmount();

    expect(storedValue<number>(KEY)).toBe(42);
  });

  it('does not lose a pending write when the tab goes away', () => {
    const hook = renderHook(() =>
      useLocalStorage<number>(KEY, 0, { debounceMs: DEBOUNCE_MS }),
    );

    act(() => hook.current()[1](99));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(storedValue<number>(KEY)).toBe(99);
    hook.unmount();
  });
});

describe('when localStorage fails', () => {
  it('surfaces a quota error through state instead of throwing', () => {
    const hook = renderHook(() => useLocalStorage<number>(KEY, 0));
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    act(() => hook.current()[1](1));

    expect(hook.current()[0]).toBe(1);
    expect(hook.current()[2].error?.reason).toBe('quota-exceeded');
    hook.unmount();
  });

  it('clears the error once a later write succeeds', () => {
    const hook = renderHook(() => useLocalStorage<number>(KEY, 0));
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError');
    });

    act(() => hook.current()[1](1));
    expect(hook.current()[2].error).not.toBeNull();

    spy.mockRestore();
    act(() => hook.current()[1](2));

    expect(hook.current()[2].error).toBeNull();
    hook.unmount();
  });

  it('falls back to the initial value when reading throws', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    const hook = renderHook(() => useLocalStorage<Session>(KEY, INITIAL));

    expect(hook.current()[0]).toEqual(INITIAL);
    expect(hook.current()[2].isLoaded).toBe(true);
    hook.unmount();
  });
});
