import React, { useState } from 'react';
import { X, QrCode, Building2, Smartphone, ShieldCheck, CheckCircle2, ArrowRight } from 'lucide-react';

interface XenditCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderData: {
    orderId: string;
    externalId: string;
    amount: number;
    platformFee: number;
    creatorEarnings: number;
    tierName: string;
    creatorName: string;
  } | null;
  onPaymentSuccess: () => void;
}

export const XenditCheckoutModal: React.FC<XenditCheckoutModalProps> = ({
  isOpen,
  onClose,
  orderData,
  onPaymentSuccess,
}) => {
  const [selectedMethod, setSelectedMethod] = useState<'QRIS' | 'VA' | 'EWALLET'>('QRIS');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaid, setIsPaid] = useState(false);

  if (!isOpen || !orderData) return null;

  const handleSimulatePayment = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/v1/billing/xendit-webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-callback-token': 'rag_xendit_webhook_token_secret',
        },
        body: JSON.stringify({
          id: `inv_xnd_${Date.now()}`,
          external_id: orderData.externalId,
          status: 'PAID',
          payment_method: selectedMethod,
          amount: orderData.amount,
        }),
      });

      if (!res.ok) {
        throw new Error('Gagal memproses webhook simulasi Xendit');
      }

      setIsPaid(true);
      setTimeout(() => {
        onPaymentSuccess();
        onClose();
        setIsPaid(false);
      }, 1800);
    } catch (err: any) {
      alert(`Gagal: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-zinc-900 border border-zinc-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with Xendit branding */}
        <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-blue-600 flex items-center justify-center text-white font-bold text-xs">
              X
            </div>
            <div>
              <span className="font-bold text-zinc-100 text-sm">Xendit Invoice Checkout</span>
              <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                Sandbox Mode
              </span>
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

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Order Summary & Revenue Split Breakdown */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Paket Langganan:</span>
              <span className="font-semibold text-zinc-100">{orderData.tierName}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-400">Kreator Kelas:</span>
              <span className="font-medium text-zinc-200">{orderData.creatorName}</span>
            </div>
            <div className="pt-2 border-t border-zinc-800/80 flex justify-between items-center">
              <span className="text-sm font-semibold text-zinc-100">Total Tagihan:</span>
              <span className="text-xl font-bold text-emerald-400">
                Rp {orderData.amount.toLocaleString('id-ID')}
              </span>
            </div>

            {/* Approach 2 Transparency Banner */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5">
              <div className="font-semibold flex items-center gap-1.5 text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Transparansi Bagi Hasil (Pendekatan 2)</span>
              </div>
              <div className="flex justify-between text-zinc-300">
                <span>&bull; Hak Kreator (80% Masuk Dompet):</span>
                <span className="font-semibold text-emerald-400">Rp {orderData.creatorEarnings.toLocaleString('id-ID')}</span>
              </div>
              <div className="flex justify-between text-zinc-400">
                <span>&bull; Komisi Platform RAG (20%):</span>
                <span className="font-medium text-zinc-400">Rp {orderData.platformFee.toLocaleString('id-ID')}</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase text-zinc-400 mb-2 tracking-wider">
              Pilih Metode Pembayaran
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedMethod('QRIS')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  selectedMethod === 'QRIS'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-sm'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <QrCode className="w-5 h-5 mb-1.5 text-indigo-400" />
                <span>QRIS Instan</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('VA')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  selectedMethod === 'VA'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-sm'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Building2 className="w-5 h-5 mb-1.5 text-indigo-400" />
                <span>Virtual Account</span>
              </button>
              <button
                type="button"
                onClick={() => setSelectedMethod('EWALLET')}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-medium transition ${
                  selectedMethod === 'EWALLET'
                    ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300 shadow-sm'
                    : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                }`}
              >
                <Smartphone className="w-5 h-5 mb-1.5 text-indigo-400" />
                <span>E-Wallet</span>
              </button>
            </div>
          </div>

          {/* Interactive Method Preview */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col items-center text-center">
            {selectedMethod === 'QRIS' && (
              <div className="space-y-3">
                <div className="w-40 h-40 bg-white p-2.5 rounded-xl shadow-md flex items-center justify-center mx-auto">
                  {/* Stylized QR Code Preview */}
                  <div className="w-full h-full border-4 border-zinc-900 rounded flex flex-col items-center justify-center text-zinc-900">
                    <QrCode className="w-24 h-24 text-zinc-900" />
                    <span className="text-[9px] font-bold tracking-widest mt-1">XENDIT QRIS</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400">
                  Scan dengan GoPay, OVO, Dana, ShopeePay, BCA Mobile, atau aplikasi m-Banking apapun.
                </p>
              </div>
            )}

            {selectedMethod === 'VA' && (
              <div className="w-full space-y-2 text-left">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-zinc-400 block">Bank BCA Virtual Account</span>
                    <span className="font-mono font-bold text-zinc-100 text-sm">8801 2345 8890 1234</span>
                  </div>
                  <span className="text-[10px] px-2 py-1 bg-zinc-800 text-zinc-300 rounded font-semibold">Salin</span>
                </div>
                <p className="text-xs text-zinc-400 text-center">Pembayaran akan otomatis diverifikasi dalam 5 detik.</p>
              </div>
            )}

            {selectedMethod === 'EWALLET' && (
              <div className="w-full space-y-2 text-left">
                <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex justify-between items-center">
                  <span className="text-sm font-semibold text-zinc-100">ShopeePay / OVO</span>
                  <span className="text-xs text-emerald-400 font-medium">Terhubung Langsung</span>
                </div>
                <p className="text-xs text-zinc-400 text-center">Notifikasi pembayaran akan dikirimkan ke aplikasi Anda.</p>
              </div>
            )}
          </div>

          {/* Action Simulation Button */}
          {isPaid ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center gap-2 text-emerald-400 font-semibold text-sm animate-in zoom-in-95">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <span>Pembayaran Sukses Terverifikasi via Xendit!</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSimulatePayment}
              disabled={isProcessing}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>Simulasi Bayar Sekarang (Trigger Webhook PAID)</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
