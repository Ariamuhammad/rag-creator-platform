import { afterEach, expect, test } from 'bun:test';
import { browserAi } from '../frontend/src/services/browser-ai';

const originalWorker = globalThis.Worker;
const originalCaches = globalThis.caches;
let calls: string[] = [];
let fail: string[] = [];
let hold = false;
let terminated = 0;
let failureKind = 'device';
class TestWorker {
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  terminate() {
    terminated++;
  }
  postMessage(data: any) {
    calls.push(data.profile);
    if (hold) return;
    queueMicrotask(() =>
      this.onmessage?.({
        data: fail.includes(data.profile)
          ? { id: data.id, error: 'attempt failed', kind: failureKind }
          : { id: data.id, result: 'answer' },
      }),
    );
  }
}
afterEach(async () => {
  hold = false;
  await browserAi.retry();
  globalThis.Worker = originalWorker;
  globalThis.caches = originalCaches;
  calls = [];
  fail = [];
  terminated = 0;
  failureKind = 'device';
});
function setup() {
  globalThis.Worker = TestWorker as unknown as typeof Worker;
}

test('real attempts precede downgrade and a working lite profile stays local', async () => {
  setup();
  fail = ['auto', 'cpu'];
  expect(await browserAi.generate([{ role: 'user', content: 'test' }])).toBe(
    'answer',
  );
  expect(calls).toEqual(['auto', 'cpu', 'lite']);
  expect(terminated).toBe(2);
  await browserAi.generate([{ role: 'user', content: 'again' }]);
  expect(calls.at(-1)).toBe('lite');
});
test('exhausted device attempts are remembered until retry', async () => {
  setup();
  fail = ['auto', 'cpu', 'lite'];
  await expect(browserAi.generate([])).rejects.toThrow('perangkat gagal');
  await expect(browserAi.generate([])).rejects.toThrow('telah gagal');
  expect(calls).toHaveLength(3);
  await browserAi.retry();
  fail = [];
  expect(await browserAi.generate([])).toBe('answer');
  expect(calls.at(-1)).toBe('auto');
});
test('cancelled active work releases model; queued cancellation never starts another worker', async () => {
  setup();
  hold = true;
  const active = new AbortController(),
    queued = new AbortController();
  const first = browserAi.generate([], false, active.signal);
  const second = browserAi.generate([], false, queued.signal);
  await Promise.resolve();
  queued.abort();
  await expect(second).rejects.toHaveProperty('name', 'AbortError');
  active.abort();
  await expect(first).rejects.toHaveProperty('name', 'AbortError');
  await browserAi.retry();
  expect(calls).toHaveLength(1);
  expect(terminated).toBe(1);
});

test('download failures do not mark hardware unsupported or permanently downgrade its profile', async () => {
  setup();
  fail = ['auto'];
  failureKind = 'download';
  await expect(browserAi.generate([])).rejects.toThrow('attempt failed');
  expect(calls).toEqual(['auto']);
  fail = [];
  expect(await browserAi.generate([])).toBe('answer');
  expect(calls).toEqual(['auto', 'auto']);
});

test('cache removal only deletes AI weights and resets the remembered profile', async () => {
  setup();
  fail = ['auto', 'cpu'];
  await browserAi.generate([]);
  const removed: string[] = [];
  globalThis.caches = {
    delete: async (name) => {
      removed.push(name);
      return true;
    },
  } as CacheStorage;
  await browserAi.clearCache();
  expect(removed).toEqual(['transformers-cache']);
  fail = [];
  await browserAi.generate([]);
  expect(calls.at(-1)).toBe('auto');
});
