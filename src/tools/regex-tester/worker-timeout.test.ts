import { Worker } from 'node:worker_threads';
import { describe, expect, it } from 'vitest';

import { WORKER_TIMEOUT_MS } from '@/tools/regex-tester/logic';

// /^(a+)+$/ has to try every way of splitting the run of a's before it can say
// the trailing ! does not match, so the work doubles with every extra a. At 40
// it would outlast the machine.
const CATASTROPHIC_PATTERN = '^(a+)+$';
const CATASTROPHIC_TEXT = `${'a'.repeat(40)}!`;

const TICK_MS = 20;
const MIN_TICKS = 5;

// node:worker_threads rather than the browser Worker so this runs in the test
// environment; what is under test is the escape route, which is the same one:
// a backtracking match ignores everything until it finishes, so the only way
// out is to destroy the thread running it.
const WORKER_SOURCE = `
  const { parentPort } = require('node:worker_threads');
  parentPort.on('message', ({ pattern, text }) => {
    parentPort.postMessage(new RegExp(pattern).test(text));
  });
  parentPort.postMessage('ready');
`;

describe('a pattern that backtracks catastrophically', () => {
  it('never answers, and the deadline gets the main thread back', async () => {
    const worker = new Worker(WORKER_SOURCE, { eval: true });

    let answer: unknown = null;
    let ticks = 0;

    await new Promise<void>((resolve) => {
      worker.once('message', () => resolve());
    });

    const ticker = setInterval(() => {
      ticks += 1;
    }, TICK_MS);

    worker.on('message', (message) => {
      answer = message;
    });
    worker.postMessage({ pattern: CATASTROPHIC_PATTERN, text: CATASTROPHIC_TEXT });

    await new Promise<void>((resolve) => setTimeout(resolve, WORKER_TIMEOUT_MS));
    clearInterval(ticker);
    await worker.terminate();

    expect(answer).toBeNull();
    expect(ticks).toBeGreaterThanOrEqual(MIN_TICKS);
  });

  it('answers at once when the same pattern is given text it can match', async () => {
    const worker = new Worker(WORKER_SOURCE, { eval: true });

    await new Promise<void>((resolve) => {
      worker.once('message', () => resolve());
    });

    const answer = await new Promise<unknown>((resolve) => {
      worker.once('message', resolve);
      worker.postMessage({ pattern: CATASTROPHIC_PATTERN, text: 'a'.repeat(40) });
    });

    await worker.terminate();
    expect(answer).toBe(true);
  });
});
