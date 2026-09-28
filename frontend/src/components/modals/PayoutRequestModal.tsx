import React, { useState } from 'react';
import { X, Wallet, Building2, AlertCircle, ArrowUpRight, CheckCircle2 } from 'lucide-react';

interface PayoutRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletBalance: number;
  bankAccount: {
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolderName?: string;
    isConfigured: boolean;
  };
  onPayoutSuccess: () => void;
  onOpenBankConfig: () => void;
}

export const PayoutRequestModal: React.FC<PayoutRequestModalProps> = ({
  isOpen,
  onClose,
  walletBalance,
  bankAccount,
  onPayoutSuccess,
  onOpenBankConfig,
}) => {
  const [amount, setAmount] = useState<number>(Math.min(100000, walletBalance));
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!bankAccount.isConfigured) {
      setError('Harap atur nomor rekening bank tujuan penarikan terlebih dahulu.');
      return;
    }

    if (amount < 50000) {
      setError('Nominal penarikan minimal Rp 50.000.');
      return;
    }

    if (amount > walletBalance) {
      setError(`Saldo dompet tidak mencukupi (Saldo: Rp ${walletBalance.toLocaleString('id-ID')}).`);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/billing/creator/payout-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rag_token')}`,
        },
        body: JSON.stringify({ amount, notes }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal mengajukan penarikan dana');
      }

      setSuccess(true);
      setTimeout(() => {
        onPayoutSuccess();
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-zinc-100 text-sm">Penarikan Dana Kreator</h3>
              <p className="text-[11px] text-zinc-400">Pencairan komisi bagi hasil 80% (Pendekatan 2)</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Available Balance */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-zinc-400 block">Saldo Dompet Tersedia</span>
              <span className="text-xl font-bold text-amber-400">
                Rp {walletBalance.toLocaleString('id-ID')}
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-mono">
              80% Net Share
            </span>
          </div>

          {/* Bank Destination Info */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400 font-medium">Rekening Tujuan:</span>
              <button
                type="button"
                onClick={onOpenBankConfig}
                className="text-indigo-400 hover:text-indigo-300 font-semibold transition"
              >
                {bankAccount.isConfigured ? 'Ubah Rekening' : '+ Atur Rekening'}
              </button>
            </div>

            {bankAccount.isConfigured ? (
              <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-zinc-850 border border-zinc-700/60 text-zinc-300">
                  <Building2 className="w-4 h-4 text-indigo-400" />
                </div>
                <div>
                  <div className="font-semibold text-zinc-100 text-xs">
                    {bankAccount.bankName} - {bankAccount.bankAccountNumber}
                  </div>
                  <div className="text-[11px] text-zinc-400">{bankAccount.bankAccountHolderName}</div>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                Rekening bank belum diatur. Klik &ldquo;Atur Rekening&rdquo; untuk memasukkan info rekening Anda.
              </div>
            )}
          </div>

          {/* Amount Input */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-300">Nominal Penarikan (Rp)</label>
            <input
              type="number"
              min="50000"
              max={walletBalance}
              step="10000"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-100 font-semibold text-sm outline-none transition font-mono"
              placeholder="Contoh: 100000"
              required
            />
            {/* Quick chips */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAmount(50000)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700 transition"
              >
                Rp 50.000
              </button>
              <button
                type="button"
                onClick={() => setAmount(100000)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700 transition"
              >
                Rp 100.000
              </button>
              <button
                type="button"
                onClick={() => setAmount(walletBalance)}
                className="px-2.5 py-1 rounded-lg bg-zinc-800 text-[11px] text-zinc-300 hover:bg-zinc-700 transition"
              >
                Tarik Semua
              </button>
            </div>
          </div>

          {/* Notes Input */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-zinc-300">Catatan Penarikan (Opsional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-zinc-950 border border-zinc-800 focus:border-indigo-500 text-zinc-100 text-xs outline-none transition"
              placeholder="Misal: Penarikan batch kursus AI"
            />
          </div>

          {/* Action Button */}
          {success ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengajuan Payout Berhasil Dikirim!</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isLoading || !bankAccount.isConfigured || walletBalance < 50000}
              className="w-full py-3 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs transition flex items-center justify-center gap-2 disabled:opacity-40 cursor-pointer shadow-sm"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-amber-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Kirim Permohonan Pencairan</span>
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
