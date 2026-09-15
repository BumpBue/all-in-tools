// @vitest-environment node
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SW_PATH = 'public/sw.js';
const ORIGIN = 'https://toolbox.test';

/**
 * The service worker cannot be imported: it is a plain script that reads `self`
 * and registers listeners as a side effect. Running it in a sandbox with a
 * stand-in `self` and `caches` is the only way to exercise its real routing
 * rules rather than a copy of them written for the test.
 */

type Handler = (event: FakeEvent) => void;

interface FakeEvent {
  request?: Request;
  waitUntil: (promise: Promise<unknown>) => void;
  respondWith: (response: Promise<Response> | Response) => void;
}

class FakeCache {
  readonly entries = new Map<string, Response>();

  async match(request: Request | string) {
    return this.entries.get(keyOf(request));
  }

  async put(request: Request | string, response: Response) {
    this.entries.set(keyOf(request), response);
  }

  async add(url: string) {
    const response = await fetch(`${ORIGIN}${url}`);
    if (!response.ok) throw new Error(`failed to precache ${url}`);
    this.entries.set(`${ORIGIN}${url}`, response);
  }

  async keys() {
    return [...this.entries.keys()].map((url) => new Request(url));
  }

  async delete(request: Request | string) {
    return this.entries.delete(keyOf(request));
  }
}

function keyOf(request: Request | string): string {
  return typeof request === 'string' ? new URL(request, ORIGIN).href : request.url;
}

class FakeCacheStorage {
  readonly caches = new Map<string, FakeCache>();

  async open(name: string) {
    const existing = this.caches.get(name);
    if (existing) return existing;

    const created = new FakeCache();
    this.caches.set(name, created);
    return created;
  }

  async keys() {
    return [...this.caches.keys()];
  }

  async delete(name: string) {
    return this.caches.delete(name);
  }

  async match(request: Request | string) {
    for (const cache of this.caches.values()) {
      const hit = await cache.match(request);
      if (hit) return hit;
    }
    return undefined;
  }
}

interface Harness {
  handlers: Map<string, Handler>;
  cacheStorage: FakeCacheStorage;
  fetchMock: ReturnType<typeof vi.fn>;
  run: (type: string, event: Partial<FakeEvent>) => Promise<Response | undefined>;
}

function load(fetchMock: ReturnType<typeof vi.fn>): Harness {
  const handlers = new Map<string, Handler>();
  const cacheStorage = new FakeCacheStorage();

  const self = {
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: async () => {},
    clients: { claim: async () => {} },
    location: { origin: ORIGIN },
    registration: {},
  };

  const sandbox = {
    self,
    caches: cacheStorage,
    fetch: fetchMock,
    URL,
    Request,
    Response,
    Promise,
    console,
  };

  runInNewContext(readFileSync(SW_PATH, 'utf8'), sandbox);

  async function run(type: string, event: Partial<FakeEvent>) {
    const handler = handlers.get(type);
    if (!handler) throw new Error(`no ${type} handler registered`);

    const waited: Promise<unknown>[] = [];
    let responded: Promise<Response> | Response | undefined;

    handler({
      ...event,
      waitUntil: (promise) => waited.push(promise),
      respondWith: (response) => {
        responded = response;
      },
    } as FakeEvent);

    await Promise.all(waited);
    return responded ? await responded : undefined;
  }

  return { handlers, cacheStorage, fetchMock, run };
}

function ok(body: string) {
  return new Response(body, { status: 200 });
}

/** Names the URL in the body so a fallback cannot be confused for a fresh hit. */
function bodyFor(input: RequestInfo | URL): Response {
  const url = typeof input === 'string' ? input : String((input as Request).url ?? input);
  return ok(`served ${new URL(url, ORIGIN).pathname}`);
}

let harness: Harness;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => bodyFor(input));
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  harness = load(fetchMock);
});

describe('install', () => {
  it('precaches the offline page and the icons', async () => {
    await harness.run('install', {});

    const shell = await harness.cacheStorage.open('toolbox-shell-v1');
    const cached = [...shell.entries.keys()];

    expect(cached).toContain(`${ORIGIN}/offline`);
    expect(cached.some((url) => url.endsWith('/icon-192.png'))).toBe(true);
  });

  it('still installs when one precached file cannot be fetched', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL) =>
      String(input).includes('icon-512')
        ? new Response('missing', { status: 404 })
        : bodyFor(input),
    );

    await expect(harness.run('install', {})).resolves.toBeUndefined();

    const shell = await harness.cacheStorage.open('toolbox-shell-v1');
    expect([...shell.entries.keys()]).toContain(`${ORIGIN}/offline`);
  });
});

describe('activate', () => {
  it('deletes its own caches from an older version and keeps this one', async () => {
    await harness.cacheStorage.open('toolbox-shell-v0');
    await harness.cacheStorage.open('toolbox-shell-v1');
    await harness.cacheStorage.open('something-else');

    await harness.run('activate', {});

    const remaining = await harness.cacheStorage.keys();
    expect(remaining).not.toContain('toolbox-shell-v0');
    expect(remaining).toContain('toolbox-shell-v1');
    // Another app on the same origin is not this worker's to clear.
    expect(remaining).toContain('something-else');
  });
});

describe('fetch routing', () => {
  it('serves a hashed build asset from the cache the second time', async () => {
    const request = new Request(`${ORIGIN}/_next/static/chunks/abc123.js`);

    await harness.run('fetch', { request });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const second = await harness.run('fetch', { request });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await second?.text()).toBe('served /_next/static/chunks/abc123.js');
  });

  it('does not cache a failed asset response', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 500 }));
    const request = new Request(`${ORIGIN}/_next/static/chunks/broken.js`);

    await harness.run('fetch', { request });
    await harness.run('fetch', { request });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('goes to the network for a page even when a copy is cached', async () => {
    const request = new Request(`${ORIGIN}/tools/base64`);
    const event = { request };
    Object.defineProperty(request, 'mode', { value: 'navigate' });

    await harness.run('fetch', event);
    fetchMock.mockResolvedValue(ok('fresher'));

    const second = await harness.run('fetch', event);
    expect(await second?.text()).toBe('fresher');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to the cached page when the network is gone', async () => {
    const request = new Request(`${ORIGIN}/tools/base64`);
    Object.defineProperty(request, 'mode', { value: 'navigate' });

    await harness.run('fetch', { request });

    fetchMock.mockRejectedValue(new Error('offline'));
    const offline = await harness.run('fetch', { request });

    expect(await offline?.text()).toBe('served /tools/base64');
  });

  it('falls back to the offline page for somewhere never visited', async () => {
    await harness.run('install', {});

    fetchMock.mockRejectedValue(new Error('offline'));

    const request = new Request(`${ORIGIN}/tools/never-opened`);
    Object.defineProperty(request, 'mode', { value: 'navigate' });

    const response = await harness.run('fetch', { request });
    // The offline page, not the page that was asked for and never cached.
    expect(await response?.text()).toBe('served /offline');
  });

  it('leaves a POST alone so a form is never answered from a cache', async () => {
    const request = new Request(`${ORIGIN}/tools/base64`, { method: 'POST' });
    Object.defineProperty(request, 'mode', { value: 'navigate' });

    expect(await harness.run('fetch', { request })).toBeUndefined();
  });

  it('leaves another origin alone', async () => {
    const request = new Request('https://example.com/thing.js');
    expect(await harness.run('fetch', { request })).toBeUndefined();
  });

  it('leaves a same-origin non-navigation request alone', async () => {
    // An image or a fetch from a tool should reach the network untouched.
    const request = new Request(`${ORIGIN}/some-image.png`);
    expect(await harness.run('fetch', { request })).toBeUndefined();
  });
});
