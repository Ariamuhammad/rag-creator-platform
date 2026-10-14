import type { AiMessage } from '../../../src/common/browser-ai';

type Profile = 'auto' | 'cpu' | 'lite';
type WorkerReply = {
  id?: number;
  status?: string;
  phase?: string;
  result?: unknown;
  error?: string;
  kind?: 'download' | 'device';
};
let worker: Worker | undefined;
let nextId = 0;
let profile: Profile = 'auto';
let generationUnavailable = false;
let embeddingUnavailable = false;
let pendingCount = 0;
let queue = Promise.resolve();
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let status =
  'AI memakai komputasi perangkat Anda. Model utama diunduh otomatis saat dibutuhkan (sekitar 483–617 MB).';
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
function setStatus(value: string) {
  status = value;
  emit();
}
function release() {
  worker?.terminate();
  worker = undefined;
  clearTimeout(idleTimer);
}
const aborted = () => new DOMException('Proses dibatalkan.', 'AbortError');

function attempt<T>(
  type: 'embed' | 'generate',
  data: object,
  signal?: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(aborted());
    worker ??= new Worker(new URL('./browser-ai.worker.ts', import.meta.url), {
      type: 'module',
    });
    const activeWorker = worker;
    const id = ++nextId;
    let timer: ReturnType<typeof setTimeout>;
    let phase = 'load';
    const finish = (error?: Error, result?: unknown) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      activeWorker.onmessage = null;
      activeWorker.onerror = null;
      if (error) {
        release();
        reject(error);
      } else resolve(result as T);
    };
    const cancel = () => finish(aborted());
    const watch = () => {
      clearTimeout(timer);
      // Slow devices keep running while download/token progress arrives; silence indicates a stalled attempt.
      timer = setTimeout(
        () =>
          finish(
            Object.assign(
              new Error(
                'Percobaan AI tidak memberi kemajuan selama empat menit.',
              ),
              { kind: phase === 'download' ? 'download' : 'device' },
            ),
          ),
        240_000,
      );
    };
    activeWorker.onmessage = ({ data: reply }: MessageEvent<WorkerReply>) => {
      if (reply.id !== undefined && reply.id !== id) return;
      if (reply.phase) phase = reply.phase;
      if (reply.status) setStatus(reply.status);
      watch();
      if (reply.error)
        finish(Object.assign(new Error(reply.error), { kind: reply.kind }));
      else if ('result' in reply) finish(undefined, reply.result);
    };
    activeWorker.onerror = () =>
      finish(
        Object.assign(new Error('Worker AI gagal menjalankan percobaan.'), {
          kind: 'device',
        }),
      );
    signal?.addEventListener('abort', cancel, { once: true });
    watch();
    try {
      activeWorker.postMessage({ id, type, profile, ...data });
    } catch (error) {
      finish(error as Error);
    }
  });
}

function run<T>(
  type: 'embed' | 'generate',
  data: object,
  signal?: AbortSignal,
): Promise<T> {
  signal?.throwIfAborted();
  clearTimeout(idleTimer);
  pendingCount++;
  emit();
  const job = queue.then(async () => {
    signal?.throwIfAborted();
    if (type === 'generate' && generationUnavailable)
      throw new Error(
        'Model perangkat telah gagal dicoba; model server akan digunakan.',
      );
    if (type === 'embed' && embeddingUnavailable)
      throw new Error(
        'Embedding perangkat telah gagal dicoba; pencarian kata kunci tersedia.',
      );
    const profiles: Profile[] =
      type === 'generate'
        ? profile === 'auto'
          ? ['auto', 'cpu', 'lite']
          : profile === 'cpu'
            ? ['cpu', 'lite']
            : ['lite']
        : [profile, profile];
    const initialProfile = profile;
    for (const selected of profiles) {
      signal?.throwIfAborted();
      profile = selected;
      try {
        return await attempt<T>(type, data, signal);
      } catch (error) {
        if ((error as Error).name === 'AbortError') {
          profile = initialProfile;
          throw error;
        }
        if ((error as { kind?: string }).kind === 'download') {
          profile = initialProfile;
          setStatus(
            'Unduhan model belum tersedia. Model server digunakan untuk permintaan ini.',
          );
          throw error;
        }
        setStatus(
          'Percobaan perangkat gagal. Menyiapkan alternatif lokal secara otomatis...',
        );
      }
    }
    if (type === 'generate') generationUnavailable = true;
    else embeddingUnavailable = true;
    setStatus(
      'Percobaan AI perangkat belum berhasil. Model server akan dicoba otomatis.',
    );
    throw new Error('Percobaan AI pada perangkat gagal.');
  });
  queue = job.then(
    () => {},
    () => {},
  );
  // A queued action can be cancelled immediately without cancelling another action's worker.
  return new Promise<T>((resolve, reject) => {
    const cancel = () => reject(aborted());
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
    job.then(resolve, reject).finally(() => {
      signal?.removeEventListener('abort', cancel);
      pendingCount--;
      emit();
      if (!pendingCount) idleTimer = setTimeout(release, 180_000);
    });
  });
}

export const browserAi = {
  setExecution(execution: 'browser' | 'server') {
    if (execution === 'server')
      setStatus('AI diproses oleh server sesuai konfigurasi administrator.');
  },
  useSources: () =>
    setStatus(
      'Menampilkan kutipan materi. Anda tetap bisa melanjutkan belajar.',
    ),
  useServer: (ready = false) =>
    setStatus(
      ready
        ? 'Jawaban selesai menggunakan model AI server. AI perangkat dapat dicoba kembali.'
        : 'Percobaan AI perangkat belum berhasil. Menyusun jawaban melalui model AI server secara otomatis...',
    ),
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  getStatus: () => status,
  isBusy: () => pendingCount > 0,
  async retry() {
    await queue;
    release();
    profile = 'auto';
    generationUnavailable = false;
    embeddingUnavailable = false;
    setStatus('AI perangkat akan dicoba kembali pada permintaan berikutnya.');
  },
  async clearCache() {
    await queue;
    if (pendingCount)
      throw new Error('Tunggu proses AI selesai sebelum menghapus cache.');
    release();
    if (typeof caches !== 'undefined')
      await caches.delete('transformers-cache');
    await this.retry();
    setStatus(
      'Cache model AI dihapus. Model diunduh ulang otomatis saat dibutuhkan.',
    );
  },
  embed: (text: string, signal?: AbortSignal) =>
    run<number[]>('embed', { text }, signal),
  generate: (messages: AiMessage[], draft = false, signal?: AbortSignal) =>
    run<string>('generate', { messages, draft }, signal),
};
