import React, { useState } from 'react';
import { X, Building2, CheckCircle2 } from 'lucide-react';

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBank: {
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolderName?: string;
  };
  onSuccess: () => void;
}

export const BankAccountModal: React.FC<BankAccountModalProps> = ({
  isOpen,
  onClose,
  currentBank,
  onSuccess,
}) => {
  const [bankName, setBankName] = useState(currentBank.bankName || 'BCA');
  const [bankAccountNumber, setBankAccountNumber] = useState(currentBank.bankAccountNumber || '');
  const [bankAccountHolderName, setBankAccountHolderName] = useState(currentBank.bankAccountHolderName || '');
  const [isLoading, setIsLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/billing/creator/bank-account', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rag_token')}`,
        },
        body: JSON.stringify({
          bankName,
          bankAccountNumber,
          bankAccountHolderName,
        }),
      });

      if (!res.ok) {
        throw new Error('Gagal menyimpan info rekening');
      }

      setSaved(true);
      setTimeout(() => {
        onSuccess();
        onClose();
        setSaved(false);
      }, 1200);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-zinc-100 text-sm">Pengaturan Rekening Penarikan</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-100 p-1 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nama Bank / E-Wallet</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500 font-sans cursor-pointer"
            >
              <option value="BCA">Bank BCA</option>
              <option value="MANDIRI">Bank Mandiri</option>
              <option value="BRI">Bank BRI</option>
              <option value="BNI">Bank BNI</option>
              <option value="CIMB">Bank CIMB Niaga</option>
              <option value="OVO">OVO</option>
              <option value="GOPAY">GoPay</option>
              <option value="DANA">DANA</option>
              <option value="SHOPEEPAY">ShopeePay</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nomor Rekening / No. HP E-Wallet</label>
            <input
              type="text"
              value={bankAccountNumber}
              onChange={(e) => setBankAccountNumber(e.target.value)}
              placeholder="Contoh: 8830123456"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500 font-mono"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-1">Nama Pemilik Rekening</label>
            <input
              type="text"
              value={bankAccountHolderName}
              onChange={(e) => setBankAccountHolderName(e.target.value)}
              placeholder="Contoh: Budi Santoso"
              className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
              required
            />
          </div>

          {saved ? (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold text-xs flex items-center justify-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Rekening Berhasil Disimpan!</span>
            </div>
          ) : (
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm"
            >
              {isLoading ? 'Menyimpan...' : 'Simpan Rekening'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};
