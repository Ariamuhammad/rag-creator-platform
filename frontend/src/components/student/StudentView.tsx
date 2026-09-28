import React from 'react';
import {
  Sparkles,
  CreditCard,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { SubscriptionTier, PaymentOrder } from '../../types';

interface StudentViewProps {
  creatorProfile: any;
  tiers: SubscriptionTier[];
  remainingCredits: number;
  hasActiveSubscription: boolean;
  onSubscribeClick: (tier: SubscriptionTier) => void;
  orders: PaymentOrder[];
  onEnterClassroom?: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({
  creatorProfile,
  tiers,
  remainingCredits,
  hasActiveSubscription,
  onSubscribeClick,
  orders,
  onEnterClassroom,
}) => {
  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-200">
      {/* 1. Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CreditCard className="w-3.5 h-3.5" />
              Katalog Paket &amp; Akses Kelas
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Paket Kursus &amp; Langganan Belajar
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Pilih paket langganan untuk membuka akses materi lengkap dari {creatorProfile?.displayName || 'Edukator'} dan kuota token AI Workspace interaktif.
          </p>
        </div>

        {/* Subscription Status Pill */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Status Akun:</span>
          {hasActiveSubscription ? (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Langganan Aktif ({remainingCredits.toLocaleString()} Token)
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
              Belum Berlangganan
            </span>
          )}
        </div>
      </div>

      {/* 2. Active Subscription Quick-Banner (if already subscribed) */}
      {hasActiveSubscription && (
        <div className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                Akses Pembelajaran AI Aktif
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Anda memiliki sisa kuota {remainingCredits.toLocaleString()} Token AI. Langsung buka Classroom Workspace untuk membaca kurikulum dan berkonsultasi dengan AI Copilot.
              </p>
            </div>
          </div>

          {onEnterClassroom && (
            <button
              type="button"
              onClick={onEnterClassroom}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
            >
              <span>Masuk ke Classroom Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* 3. Pricing Cards Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Pilihan Tingkat Langganan</h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Dikelola aman menggunakan Xendit Payment Gateway dengan pembagian royalti transparan kepada kreator.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="relative flex flex-col justify-between p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-6"
            >
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Paket Edukator
                  </span>
                  <h3 className="text-lg font-bold text-zinc-100 mt-2">{tier.name}</h3>
                  <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                    {tier.description || 'Akses penuh seluruh modul kurikulum, dokumen referensi privat, dan asisten AI terintegrasi.'}
                  </p>
                </div>

                <div className="pt-2">
                  <span className="text-3xl font-extrabold text-zinc-100">
                    Rp {Number(tier.price).toLocaleString('id-ID')}
                  </span>
                  <span className="text-xs text-zinc-400"> / bulan</span>
                </div>

                {/* 80/20 Transparency Pill */}
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 space-y-1.5">
                  <div className="font-semibold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    <span>Transparansi Royalti Platform:</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>&bull; 80% Hak Edukator:</span>
                    <span className="font-bold text-emerald-400">
                      Rp {(Number(tier.price) * 0.8).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex justify-between text-zinc-500">
                    <span>&bull; 20% Fee Platform &amp; Server:</span>
                    <span>Rp {(Number(tier.price) * 0.2).toLocaleString('id-ID')}</span>
                  </div>
                </div>

                {/* Feature Checklist */}
                <ul className="space-y-2 text-xs text-zinc-300 pt-2 border-t border-zinc-800/80">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{tier.monthlyCreditQuota.toLocaleString()} Kuota Token Per Bulan</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Pencarian Semantic Vector (pgvector)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>NotebookLM Citations &amp; Grounding</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Akses Forum Diskusi Terbuka</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => onSubscribeClick(tier)}
                  className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition shadow-sm flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Langganan via Xendit</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Student Orders & Payment History Table */}
      <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4">
        <div>
          <h3 className="font-bold text-zinc-100 text-sm">Riwayat Pembayaran &amp; Invoice Saya</h3>
          <p className="text-xs text-zinc-400 mt-0.5">
            Daftar transaksi pembayaran langganan melalui gateway resmi Xendit.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-500">
            Belum ada riwayat transaksi pembayaran.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5">ID Order</th>
                  <th className="py-2.5">Paket</th>
                  <th className="py-2.5">Nominal</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-800/30 transition">
                    <td className="py-2.5 font-semibold text-zinc-200">{order.externalId}</td>
                    <td className="py-2.5 font-sans">{order.tier?.name || 'Langganan AI'}</td>
                    <td className="py-2.5 font-bold text-zinc-100">
                      Rp {order.amount.toLocaleString('id-ID')}
                    </td>
                    <td className="py-2.5 font-sans">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          order.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-zinc-400 font-sans">
                      {new Date(order.createdAt).toLocaleDateString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
