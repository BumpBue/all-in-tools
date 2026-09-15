/**
 * Drives a real Chrome to confirm the service worker does what the unit tests
 * say it does: registers, precaches, and still serves a visited page once the
 * network is cut. The sandbox tests check the routing rules; this checks that
 * the browser actually accepts and runs the file.
 *
 * Needs a production server running. `node scripts/check-offline.mjs`
 */
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.AUDIT_BASE ?? 'http://127.0.0.1:3000';
const CHROME = process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const DEBUG_PORT = 9222;
const READY_ATTEMPTS = 40;
const READY_DELAY_MS = 250;
const SW_ATTEMPTS = 40;

const profile = mkdtempSync(join(tmpdir(), 'sw-check-'));

const child = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${DEBUG_PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--disable-gpu',
  BASE,
]);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function endpoint() {
  for (let attempt = 0; attempt < READY_ATTEMPTS; attempt += 1) {
    try {
      const version = await (await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`)).json();
      return version.webSocketDebuggerUrl;
    } catch {
      await wait(READY_DELAY_MS);
    }
  }
  throw new Error('chrome never opened its debugging port');
}

let nextId = 1;

function connect(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();

    function send(method, params = {}, sessionId) {
      const id = nextId++;
      return new Promise((settle) => {
        pending.set(id, settle);
        socket.send(JSON.stringify({ id, method, params, sessionId }));
      });
    }

    socket.addEventListener('open', () => resolve({ send, close: () => socket.close() }));
    socket.addEventListener('error', reject);
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const settle = pending.get(message.id);
      if (settle) {
        pending.delete(message.id);
        settle(message);
      }
    });
  });
}

function fail(message) {
  console.error(`FAIL  ${message}`);
  process.exitCode = 1;
}

try {
  const browser = await connect(await endpoint());

  const { result: targets } = await browser.send('Target.getTargets');
  const page = targets.targetInfos.find((target) => target.type === 'page');

  const { result: attached } = await browser.send('Target.attachToTarget', {
    targetId: page.targetId,
    flatten: true,
  });
  const session = attached.sessionId;

  const evaluate = async (expression) => {
    const { result } = await browser.send(
      'Runtime.evaluate',
      { expression, awaitPromise: true, returnByValue: true },
      session,
    );
    return result?.result?.value;
  };

  await browser.send('Page.enable', {}, session);
  await browser.send('Network.enable', {}, session);

  // Give the worker time to register and finish installing.
  let controller = null;
  for (let attempt = 0; attempt < SW_ATTEMPTS; attempt += 1) {
    controller = await evaluate(
      `navigator.serviceWorker.getRegistration().then(r => r ? (r.active ? 'active' : 'installing') : 'none')`,
    );
    if (controller === 'active') break;
    await wait(READY_DELAY_MS);
  }

  if (controller === 'active') {
    console.log('PASS  the service worker registered and activated');
  } else {
    fail(`the service worker never activated (last state: ${controller})`);
  }

  const cached = await evaluate(
    `caches.keys().then(keys => Promise.all(keys.map(k => caches.open(k).then(c => c.keys()))).then(all => all.flat().map(r => new URL(r.url).pathname)))`,
  );

  if (Array.isArray(cached) && cached.includes('/offline')) {
    console.log(`PASS  the offline page was precached (${cached.length} entries cached)`);
  } else {
    fail(`the offline page was not precached; cached: ${JSON.stringify(cached)}`);
  }

  // Visit a tool page so it lands in the page cache, then cut the network.
  await browser.send('Page.navigate', { url: `${BASE}/tools/base64` }, session);
  await wait(2000);

  /*
   * The service worker runs in a target of its own, and emulating offline on
   * the page alone leaves the worker online — every fetch still succeeds and
   * the whole check passes without testing anything. Both targets have to be
   * cut, which is the one thing about this test that is easy to get wrong.
   */
  const offline = { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 };

  const { result: all } = await browser.send('Target.getTargets');
  const workers = all.targetInfos.filter((target) => target.type === 'service_worker');

  if (workers.length === 0) fail('no service worker target to take offline');

  for (const worker of workers) {
    const { result: workerAttached } = await browser.send('Target.attachToTarget', {
      targetId: worker.targetId,
      flatten: true,
    });

    await browser.send('Network.enable', {}, workerAttached.sessionId);
    await browser.send('Network.emulateNetworkConditions', offline, workerAttached.sessionId);
  }

  await browser.send('Network.emulateNetworkConditions', offline, session);

  await browser.send('Page.navigate', { url: `${BASE}/tools/base64` }, session);
  await wait(2000);

  const reachable = await evaluate(
    `fetch('${BASE}/manifest.webmanifest', { cache: 'no-store' }).then(() => true).catch(() => false)`,
  );

  if (reachable === false) {
    console.log('PASS  the network really is down');
  } else {
    fail('the network was still reachable, so the offline results below mean nothing');
  }

  const bodyOffline = await evaluate('document.body.innerText.slice(0, 400)');

  if (typeof bodyOffline === 'string' && bodyOffline.includes('Base64')) {
    console.log('PASS  a visited page still renders with the network cut');
  } else {
    fail(`the visited page did not render offline; saw: ${JSON.stringify(bodyOffline)}`);
  }

  await browser.send('Page.navigate', { url: `${BASE}/tools/never-visited-page` }, session);
  await wait(2000);

  const fallback = await evaluate('document.body.innerText.slice(0, 400)');

  if (typeof fallback === 'string' && /offline|ออฟไลน์|ยังไม่ได้เชื่อมต่อ/i.test(fallback)) {
    console.log('PASS  an unvisited page falls back to the offline page');
  } else {
    fail(`no offline fallback; saw: ${JSON.stringify(fallback)}`);
  }

  browser.close();
} finally {
  child.kill();
  try {
    rmSync(profile, { recursive: true, force: true });
  } catch {
    // Chrome sometimes still holds the profile on Windows; it is a temp dir.
  }
}
