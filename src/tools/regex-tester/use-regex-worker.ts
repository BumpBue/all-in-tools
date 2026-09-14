'use client';

import { useEffect, useRef, useState } from 'react';

import {
  WORKER_TIMEOUT_MS,
  type RegexAnswer,
  type RegexRequest,
  type RegexResponse,
} from '@/tools/regex-tester/logic';

const FIRST_JOB_ID = 1;

export type RegexRunStatus = 'idle' | 'running' | 'settled';

export interface UseRegexWorkerOptions {
  /** Replaced in tests, where happy-dom has no Worker. */
  createWorker?: () => Worker;
  timeoutMs?: number;
}

function createDefaultWorker(): Worker {
  return new Worker(new URL('./worker.ts', import.meta.url));
}

// Serialized rather than joined: any separator could itself appear in a
// pattern or in the text, and two different requests would look like one.
function requestKey(request: RegexRequest): string {
  return JSON.stringify([
    request.pattern,
    request.flags,
    request.replacement,
    request.text,
  ]);
}

/**
 * Runs one regex request off the main thread and gives up after a deadline.
 *
 * A backtracking engine ignores everything until it is done, so a catastrophic
 * pattern can only be stopped by terminating the thread running it. The worker
 * is kept between requests and thrown away whenever it misses the deadline.
 */
export function useRegexWorker(
  request: RegexRequest,
  options: UseRegexWorkerOptions = {},
): { status: RegexRunStatus; response: RegexResponse | null } {
  const { createWorker = createDefaultWorker, timeoutMs = WORKER_TIMEOUT_MS } = options;
  const { pattern, flags, text, replacement } = request;

  const workerRef = useRef<Worker | null>(null);
  const jobRef = useRef(FIRST_JOB_ID);
  const [settled, setSettled] = useState<{ key: string; response: RegexResponse } | null>(
    null,
  );

  const key = requestKey(request);

  useEffect(() => {
    if (pattern.length === 0) return;

    const job = { pattern, flags, text, replacement };
    const current = requestKey(job);
    const id = jobRef.current;
    jobRef.current += 1;

    let timer: number | null = null;

    // Reported through a microtask rather than straight from the effect body,
    // which would be a second synchronous render of the same commit.
    const fail = (response: RegexResponse) => {
      queueMicrotask(() => setSettled({ key: current, response }));
    };

    let worker: Worker;
    try {
      worker = workerRef.current ?? createWorker();
      workerRef.current = worker;
    } catch (error) {
      fail({
        ok: false,
        code: 'worker-failed',
        detail: error instanceof Error ? error.message : String(error),
        at: null,
      });
      return;
    }

    const handle = (event: MessageEvent<RegexAnswer>) => {
      if (event.data.id !== id) return;
      if (timer !== null) window.clearTimeout(timer);
      setSettled({ key: current, response: event.data.response });
    };

    worker.addEventListener('message', handle);

    timer = window.setTimeout(() => {
      worker.terminate();
      workerRef.current = null;
      setSettled({
        key: current,
        response: { ok: false, code: 'timeout', detail: '', at: null },
      });
    }, timeoutMs);

    worker.postMessage({ id, request: job });

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      worker.removeEventListener('message', handle);
    };
  }, [createWorker, flags, pattern, replacement, text, timeoutMs]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  if (pattern.length === 0) return { status: 'idle', response: null };

  // The previous answer stays on screen while the next one runs, so a page of
  // results does not blink away on every keystroke.
  return {
    status: settled?.key === key ? 'settled' : 'running',
    response: settled?.response ?? null,
  };
}
