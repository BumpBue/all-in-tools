// @vitest-environment happy-dom
import { act, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderHook, settle } from '@/test/react';
import type {
  RegexAnswer,
  RegexJob,
  RegexRequest,
  RegexResponse,
} from '@/tools/regex-tester/logic';
import { useRegexWorker } from '@/tools/regex-tester/use-regex-worker';

const TIMEOUT_MS = 1000;

const ANSWER: RegexResponse = { ok: true, matches: [], truncated: false, replaced: null };

class StubWorker {
  static created: StubWorker[] = [];

  jobs: RegexJob[] = [];
  terminated = false;

  private handlers = new Set<(event: MessageEvent<RegexAnswer>) => void>();

  constructor() {
    StubWorker.created.push(this);
  }

  addEventListener(_type: string, handler: (event: MessageEvent<RegexAnswer>) => void) {
    this.handlers.add(handler);
  }

  removeEventListener(
    _type: string,
    handler: (event: MessageEvent<RegexAnswer>) => void,
  ) {
    this.handlers.delete(handler);
  }

  postMessage(job: RegexJob) {
    this.jobs.push(job);
  }

  terminate() {
    this.terminated = true;
  }

  /** Answers a job by its place in the queue: 0 is the first one sent. */
  reply(response: RegexResponse, jobIndex = this.jobs.length - 1) {
    const job = this.jobs[jobIndex];
    if (!job) throw new Error(`no job at ${jobIndex}`);

    act(() => {
      for (const handler of [...this.handlers]) {
        handler({ data: { id: job.id, response } } as MessageEvent<RegexAnswer>);
      }
    });
  }
}

const createWorker = () => new StubWorker() as unknown as Worker;

const failingCreateWorker = () => {
  throw new Error('Worker is not defined');
};

function useHarness(initial: RegexRequest, create: () => Worker = createWorker) {
  const [request, setRequest] = useState(initial);
  const result = useRegexWorker(request, {
    createWorker: create,
    timeoutMs: TIMEOUT_MS,
  });

  return { ...result, setRequest };
}

function request(overrides: Partial<RegexRequest> = {}): RegexRequest {
  return { pattern: 'a', flags: 'g', text: 'aaa', replacement: null, ...overrides };
}

function lastWorker(): StubWorker {
  const worker = StubWorker.created[StubWorker.created.length - 1];
  if (!worker) throw new Error('no worker was created');
  return worker;
}

beforeEach(() => {
  StubWorker.created = [];
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useRegexWorker', () => {
  it('starts no thread at all for an empty pattern', () => {
    const hook = renderHook(() => useHarness(request({ pattern: '' })));

    expect(hook.current().status).toBe('idle');
    expect(StubWorker.created).toHaveLength(0);
    hook.unmount();
  });

  it('sends the request and reports the answer', () => {
    const hook = renderHook(() => useHarness(request()));

    expect(hook.current().status).toBe('running');
    expect(lastWorker().jobs.map((job) => job.request)).toEqual([request()]);

    lastWorker().reply(ANSWER);

    expect(hook.current().status).toBe('settled');
    expect(hook.current().response).toEqual(ANSWER);
    hook.unmount();
  });

  it('gives up on a pattern that never answers, and kills the thread', () => {
    const hook = renderHook(() => useHarness(request({ pattern: '^(a+)+$' })));

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS);
    });

    expect(hook.current().response).toMatchObject({ ok: false, code: 'timeout' });
    expect(lastWorker().terminated).toBe(true);
    hook.unmount();
  });

  it('waits the whole deadline before giving up', () => {
    const hook = renderHook(() => useHarness(request({ pattern: '^(a+)+$' })));

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS - 1);
    });

    expect(hook.current().status).toBe('running');
    expect(lastWorker().terminated).toBe(false);
    hook.unmount();
  });

  it('starts a fresh thread after one was killed', () => {
    const hook = renderHook(() => useHarness(request({ pattern: '^(a+)+$' })));
    const killed = lastWorker();

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS);
    });
    act(() => {
      hook.current().setRequest(request({ pattern: 'b' }));
    });

    expect(StubWorker.created).toHaveLength(2);
    expect(lastWorker()).not.toBe(killed);
    expect(lastWorker().jobs.map((job) => job.request)).toEqual([
      request({ pattern: 'b' }),
    ]);
    hook.unmount();
  });

  it('keeps one thread for as long as it keeps answering', () => {
    const hook = renderHook(() => useHarness(request()));
    lastWorker().reply(ANSWER);

    act(() => {
      hook.current().setRequest(request({ pattern: 'b' }));
    });

    expect(StubWorker.created).toHaveLength(1);
    expect(lastWorker().jobs).toHaveLength(2);
    hook.unmount();
  });

  it('does not read an answer to an older request as the answer to this one', () => {
    const hook = renderHook(() => useHarness(request()));
    const worker = lastWorker();

    act(() => {
      hook.current().setRequest(request({ text: 'bbb' }));
    });
    worker.reply(ANSWER, 0);

    expect(hook.current().status).toBe('running');

    act(() => {
      vi.advanceTimersByTime(TIMEOUT_MS);
    });

    expect(hook.current().response).toMatchObject({ code: 'timeout' });
    hook.unmount();
  });

  it('shows the previous answer while the next one is being worked out', () => {
    const hook = renderHook(() => useHarness(request()));
    lastWorker().reply(ANSWER);

    act(() => {
      hook.current().setRequest(request({ text: 'bbb' }));
    });

    expect(hook.current().status).toBe('running');
    expect(hook.current().response).toEqual(ANSWER);
    hook.unmount();
  });

  it('reports a thread that could not be started', async () => {
    const hook = renderHook(() => useHarness(request(), failingCreateWorker));

    await act(async () => {
      await Promise.resolve();
    });

    expect(hook.current().response).toMatchObject({ ok: false, code: 'worker-failed' });
    hook.unmount();
  });

  it('kills the thread when the page leaves', async () => {
    const hook = renderHook(() => useHarness(request()));
    const worker = lastWorker();

    hook.unmount();
    await settle();

    expect(worker.terminated).toBe(true);
  });
});
