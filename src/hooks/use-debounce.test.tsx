// @vitest-environment happy-dom
import { useState } from 'react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebounce } from '@/hooks/use-debounce';
import { renderHook } from '@/test/react';

const DELAY_MS = 200;

function useDebouncedInput(initial: string) {
  const [value, setValue] = useState(initial);
  return { value: useDebounce(value, DELAY_MS), setValue };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useDebounce', () => {
  it('returns the initial value immediately', () => {
    const hook = renderHook(() => useDebouncedInput('a'));
    expect(hook.current().value).toBe('a');
    hook.unmount();
  });

  it('holds the old value until the delay passes', () => {
    const hook = renderHook(() => useDebouncedInput('a'));

    act(() => hook.current().setValue('b'));
    expect(hook.current().value).toBe('a');

    act(() => vi.advanceTimersByTime(DELAY_MS));
    expect(hook.current().value).toBe('b');
    hook.unmount();
  });

  it('reports only the last value of a burst', () => {
    const hook = renderHook(() => useDebouncedInput('a'));

    act(() => hook.current().setValue('b'));
    act(() => vi.advanceTimersByTime(DELAY_MS / 2));
    act(() => hook.current().setValue('c'));
    act(() => vi.advanceTimersByTime(DELAY_MS));

    expect(hook.current().value).toBe('c');
    hook.unmount();
  });

  it('drops a pending update after unmount', () => {
    const hook = renderHook(() => useDebouncedInput('a'));

    act(() => hook.current().setValue('b'));
    hook.unmount();

    expect(() => vi.advanceTimersByTime(DELAY_MS)).not.toThrow();
  });
});
