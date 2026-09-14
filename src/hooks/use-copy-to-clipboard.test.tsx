// @vitest-environment happy-dom
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { COPY_FEEDBACK_MS } from '@/config/site';
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard';
import { renderHook } from '@/test/react';

const TEXT = 'ฐานสิบหก';

function stubClipboard(writeText: ((text: string) => Promise<void>) | null) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  stubClipboard(null);
});

describe('useCopyToClipboard', () => {
  it('starts idle', () => {
    const hook = renderHook(useCopyToClipboard);
    expect(hook.current()[0]).toBe('idle');
    hook.unmount();
  });

  it('uses the clipboard API when it is available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));

    expect(writeText).toHaveBeenCalledWith(TEXT);
    expect(hook.current()[0]).toBe('copied');
    hook.unmount();
  });

  it('returns to idle after the feedback window', async () => {
    stubClipboard(vi.fn().mockResolvedValue(undefined));

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));
    act(() => vi.advanceTimersByTime(COPY_FEEDBACK_MS));

    expect(hook.current()[0]).toBe('idle');
    hook.unmount();
  });

  it('falls back to a selection copy outside a secure context', async () => {
    stubClipboard(null);
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(hook.current()[0]).toBe('copied');
    hook.unmount();
  });

  it('falls back when the clipboard API rejects', async () => {
    stubClipboard(vi.fn().mockRejectedValue(new Error('denied')));
    const execCommand = vi.fn().mockReturnValue(true);
    document.execCommand = execCommand;

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));

    expect(execCommand).toHaveBeenCalled();
    expect(hook.current()[0]).toBe('copied');
    hook.unmount();
  });

  it('reports failure when both paths fail', async () => {
    stubClipboard(null);
    document.execCommand = vi.fn().mockReturnValue(false);

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));

    expect(hook.current()[0]).toBe('failed');
    hook.unmount();
  });

  it('leaves no stray textarea behind', async () => {
    stubClipboard(null);
    document.execCommand = vi.fn().mockReturnValue(true);

    const hook = renderHook(useCopyToClipboard);
    await act(async () => hook.current()[1](TEXT));

    expect(document.querySelectorAll('textarea')).toHaveLength(0);
    hook.unmount();
  });
});
