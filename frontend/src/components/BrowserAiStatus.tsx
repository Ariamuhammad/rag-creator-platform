import { useEffect, useState, useSyncExternalStore } from 'react';
import { browserAi } from '../services/browser-ai';
import { api } from '../services/api';

export function BrowserAiStatus() {
  const status = useSyncExternalStore(browserAi.subscribe, browserAi.getStatus);
  const busy = useSyncExternalStore(browserAi.subscribe, browserAi.isBusy);
  const [storage, setStorage] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    void api.getAiConfig().catch(() => {});
    let active = true;
    void navigator.storage
      ?.estimate()
      .then((estimate) => {
        if (active)
          setStorage(
            `Penyimpanan situs: sekitar ${Math.round((estimate.usage || 0) / 1024 / 1024)} MB`,
          );
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return (
    <div>
      <p
        role="status"
        aria-live="polite"
        className="text-xs text-zinc-400 leading-relaxed"
      >
        {status}
      </p>
      <details className="mt-1 text-xs text-zinc-400">
        <summary className="cursor-pointer">
          Model dan penyimpanan perangkat
        </summary>
        <p className="mt-2">
          Model diunduh otomatis saat dibutuhkan. Model utama sekitar 483–617
          MB; alternatif ringkas sekitar 145 MB. Pemakaian RAM lebih besar dan
          CPU dapat memerlukan beberapa menit. Draf serta jawaban tetap perlu
          diperiksa dengan sumber. Jika percobaan perangkat gagal, model server
          digunakan otomatis.
        </p>
        {storage && <p className="mt-1">{storage}</p>}
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            disabled={busy}
            className="underline disabled:opacity-50"
            onClick={() => {
              void browserAi.retry();
            }}
          >
            Coba AI perangkat kembali
          </button>
          <button
            type="button"
            disabled={busy}
            className="underline disabled:opacity-50"
            onClick={async () => {
              try {
                await browserAi.clearCache();
                setStorage('Cache model AI dihapus.');
                setError('');
              } catch (failure) {
                setError(
                  failure instanceof Error
                    ? failure.message
                    : 'Cache belum dapat dihapus.',
                );
              }
            }}
          >
            Hapus cache model
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-amber-300">
            {error}
          </p>
        )}
      </details>
    </div>
  );
}
