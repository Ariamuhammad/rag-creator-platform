import React, { useState, useEffect } from 'react';
import {
  Wallet,
  ArrowUpRight,
  Building2,
  FileUp,
  FileText,
  Plus,
  CheckCircle2,
  Layers,
  BookOpen,
  Film,
  Sparkles,
  Edit3,
  Check,
  X,
  Link2,
} from 'lucide-react';
import { api } from '../../services/api';
import { UnifiedCurriculumBuilder } from './UnifiedCurriculumBuilder';
import { PdfToSyllabusModal } from './PdfToSyllabusModal';
import type { SubscriptionTier, DocumentItem, PayoutRequest } from '../../types';

interface CreatorStudioProps {
  creatorProfile: any;
  walletBalance: number;
  bankAccount: {
    bankName?: string;
    bankAccountNumber?: string;
    bankAccountHolderName?: string;
    isConfigured: boolean;
  };
  tiers: SubscriptionTier[];
  documents: DocumentItem[];
  payouts: PayoutRequest[];
  onOpenPayoutModal: () => void;
  onOpenBankModal: () => void;
  onRefreshData: () => void;
}

export const CreatorStudio: React.FC<CreatorStudioProps> = ({
  creatorProfile,
  walletBalance,
  bankAccount,
  tiers,
  documents,
  payouts,
  onOpenPayoutModal,
  onOpenBankModal,
  onRefreshData,
}) => {
  const [activeTab, setActiveTab] = useState<'WALLET' | 'CURRICULUM' | 'KNOWLEDGE' | 'TIERS'>('CURRICULUM');

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // New Tier Form State
  const [showTierForm, setShowTierForm] = useState(false);
  const [tierName, setTierName] = useState('');
  const [tierPrice, setTierPrice] = useState(150000);
  const [tierQuota, setTierQuota] = useState(200000);
  const [tierDesc, setTierDesc] = useState('');
  const [isCreatingTier, setIsCreatingTier] = useState(false);

  // Curriculum & Course States
  const [courses, setCourses] = useState<any[]>([]);

  // Unified Curriculum Studio States
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [selectedCourseForEdit, setSelectedCourseForEdit] = useState<any>(null);
  const [uploadCourseId, setUploadCourseId] = useState<string>('');

  // AI PDF to Syllabus Generator Modal State
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);

  // Quick Document-Course Assignment Modal State
  const [quickAssignCourse, setQuickAssignCourse] = useState<any | null>(null);
  const [quickSelectedDocIds, setQuickSelectedDocIds] = useState<string[]>([]);
  const [isSavingQuickAssign, setIsSavingQuickAssign] = useState(false);

  useEffect(() => {
    fetchMyCourses();
  }, []);

  const fetchMyCourses = async () => {
    try {
      const data = await api.getMyCourses().catch(() => null);
      if (data && Array.isArray(data)) {
        setCourses(data);
      }
    } catch (e) {
      console.warn('Could not fetch creator courses:', e);
    }
  };

  const handleApplyPdfDraftToStudio = (draft: any) => {
    setSelectedCourseForEdit({
      title: draft.title,
      slug: draft.slug,
      description: draft.description,
      level: draft.level,
      modules: draft.modules,
    });
    setIsBuilderOpen(true);
  };

  const handleOpenQuickAssign = (course: any) => {
    setQuickAssignCourse(course);
    const assigned = documents.filter((d) => d.courseId === course.id).map((d) => d.id);
    setQuickSelectedDocIds(assigned);
  };

  const handleToggleQuickDoc = (docId: string) => {
    setQuickSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleSaveQuickAssign = async () => {
    if (!quickAssignCourse) return;
    setIsSavingQuickAssign(true);
    try {
      await api.batchAssignDocumentsToCourse(quickAssignCourse.id, quickSelectedDocIds);
      await fetchMyCourses();
      onRefreshData();
      setQuickAssignCourse(null);
    } catch (err: any) {
      alert(`Gagal menugaskan dokumen: ${err.message}`);
    } finally {
      setIsSavingQuickAssign(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', file.name);
    if (uploadCourseId) {
      formData.append('courseId', uploadCourseId);
    }

    try {
      const res = await fetch('/api/v1/knowledge-base/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('rag_token')}`,
        },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal mengunggah dokumen');
      }

      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        onRefreshData();
        fetchMyCourses();
      }, 1500);
    } catch (err: any) {
      alert(`Error upload: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAssignDocument = async (documentId: string, courseId: string) => {
    try {
      await api.assignDocumentToCourse(documentId, courseId || null);
      onRefreshData();
      await fetchMyCourses();
    } catch (err: any) {
      alert(`Gagal menugaskan dokumen: ${err.message}`);
    }
  };

  const handleCreateTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingTier(true);
    try {
      const res = await fetch('/api/v1/creators/tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rag_token')}`,
        },
        body: JSON.stringify({
          name: tierName,
          price: tierPrice,
          monthlyCreditQuota: tierQuota,
          description: tierDesc,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Gagal membuat tier');
      }

      setShowTierForm(false);
      setTierName('');
      setTierDesc('');
      onRefreshData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsCreatingTier(false);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-200">
      {/* Studio Header & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Building2 className="w-3.5 h-3.5" />
              Creator Studio Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Pusat Pengelolaan Edukator
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Kelola kurikulum kursus, dokumen knowledge base AI RAG, pantau pendapatan royalti 80%, dan atur tier langganan murid.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-400">Profil Edukator:</span>
          <span className="font-semibold text-zinc-200 px-3 py-1.5 rounded-xl bg-zinc-900 border border-zinc-800">
            {creatorProfile?.displayName || 'Bob (Educator)'}
          </span>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('CURRICULUM')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'CURRICULUM'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
          <span>Modul &amp; Silabus Kursus ({courses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('WALLET')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'WALLET'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Wallet className="w-3.5 h-3.5 text-amber-400" />
          <span>Dompet &amp; Payout (80% Net)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('KNOWLEDGE')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'KNOWLEDGE'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5 text-sky-400" />
          <span>Knowledge Base ({documents.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('TIERS')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'TIERS'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span>Tier Langganan ({tiers.length})</span>
        </button>
      </div>

      {/* TAB 0: CURRICULUM & MODULE CREATION */}
      {activeTab === 'CURRICULUM' && (
        isBuilderOpen ? (
          <UnifiedCurriculumBuilder
            initialCourse={selectedCourseForEdit}
            availableDocuments={documents}
            onBack={() => {
              setIsBuilderOpen(false);
              setSelectedCourseForEdit(null);
            }}
            onSuccess={() => {
              setIsBuilderOpen(false);
              setSelectedCourseForEdit(null);
              onRefreshData();
            }}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80">
              <div>
                <h4 className="text-base font-bold text-zinc-100">Struktur Modul &amp; Silabus Pembelajaran</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Susun kurikulum berjenjang atau gunakan AI untuk mengubah PDF materi menjadi silabus &amp; markdown secara instan.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsPdfModalOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-amber-600/20 hover:from-amber-500/30 hover:to-amber-600/30 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-sm transition cursor-pointer"
                  title="Ekstrak PDF buku/materi menjadi silabus & materi markdown lengkap dengan AI"
                >
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Generate Silabus dari PDF (AI)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseForEdit(null);
                    setIsBuilderOpen(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buka Studio Kurikulum</span>
                </button>
              </div>
            </div>

            {/* Courses Cards */}
            <div className="space-y-4">
              {courses.map((course) => {
                const assignedDocs = documents.filter((d) => d.courseId === course.id);
                const totalLessonsCount = (course.modules || []).reduce(
                  (acc: number, m: any) => acc + (m.lessons || []).length,
                  0
                );

                return (
                  <div
                    key={course.id}
                    className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-sm hover:border-zinc-700/80 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800/80 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-zinc-100 text-base">{course.title}</h4>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {course.level}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            PUBLISHED
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-1 max-w-3xl">{course.description}</p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenQuickAssign(course)}
                          className="px-3.5 py-2 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 text-xs font-semibold flex items-center gap-1.5 transition"
                          title="Tautkan atau ubah dokumen RAG yang boleh diakses kursus ini"
                        >
                          <Link2 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Tautkan Dokumen RAG</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCourseForEdit(course);
                            setIsBuilderOpen(true);
                          }}
                          className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Edit Kurikulum &amp; Dokumen RAG</span>
                        </button>
                      </div>
                    </div>

                    {/* Assigned RAG Documents Badge Section */}
                    <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                        <span className="font-semibold text-zinc-300">Dokumen RAG Terisolasi:</span>
                        <span className="text-zinc-400">
                          {assignedDocs.length > 0
                            ? `${assignedDocs.length} dokumen eksklusif terhubung`
                            : 'Belum ada dokumen yang ditugaskan khusus (akses global)'}
                        </span>
                      </div>

                      {assignedDocs.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {assignedDocs.map((doc) => (
                            <span
                              key={doc.id}
                              className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700/80 text-zinc-300"
                            >
                              {doc.title}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Modules & Lessons Preview */}
                    <div className="space-y-3 pt-1">
                      <div className="text-xs font-semibold text-zinc-400 flex items-center gap-2">
                        <Layers className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          Daftar Bab &amp; Materi ({(course.modules || []).length} Bab • {totalLessonsCount} Materi)
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(course.modules || []).map((mod: any, mIdx: number) => (
                          <div
                            key={mod.id || mIdx}
                            className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2"
                          >
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-200">
                              <span>{mod.title}</span>
                              <span className="text-zinc-500 text-[10px] font-mono">
                                {(mod.lessons || []).length} Materi
                              </span>
                            </div>

                            <div className="space-y-1 pl-2 border-l border-zinc-800 text-xs text-zinc-400">
                              {(mod.lessons || []).map((les: any, lIdx: number) => (
                                <div key={les.id || lIdx} className="flex items-center justify-between py-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {les.type === 'video' ? (
                                      <Film className="w-3 h-3 text-sky-400 shrink-0" />
                                    ) : (
                                      <BookOpen className="w-3 h-3 text-indigo-400 shrink-0" />
                                    )}
                                    <span className="truncate">{les.title}</span>
                                  </div>
                                  <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                                    {les.duration || '15 min'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      {/* TAB 1: WALLET & PAYOUTS (APPROACH 2) */}
      {activeTab === 'WALLET' && (
        <div className="space-y-6">
          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Wallet Balance Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-amber-500/30 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-amber-400 tracking-wider">
                  Saldo Dompet Kreator (80% Net)
                </span>
                <span className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-zinc-100">
                Rp {walletBalance.toLocaleString('id-ID')}
              </div>
              <p className="text-[11px] text-zinc-400">
                Otomatis dialokasikan 80% dari setiap pembayaran langganan murid via Xendit.
              </p>
              <button
                type="button"
                onClick={onOpenPayoutModal}
                disabled={walletBalance < 50000}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-amber-950 font-bold text-xs transition flex items-center justify-center gap-1.5 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <span>Tarik Dana / Request Payout</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </div>

            {/* Platform Revenue Share Breakdown Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-sm">
              <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
                Skema Bagi Hasil Transparan
              </span>
              <div className="space-y-2.5 pt-1">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex justify-between items-center text-xs">
                  <span className="text-emerald-300 font-medium">&bull; Hak Kreator:</span>
                  <span className="font-bold text-emerald-400 font-mono">80% Langsung ke Dompet</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 flex justify-between items-center text-xs">
                  <span className="text-zinc-400">&bull; Biaya Platform RAG:</span>
                  <span className="font-bold text-zinc-200 font-mono">20% Komisi</span>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400">
                Platform mengelola infrastruktur AI, chunking embedding pgvector, dan integrasi Xendit.
              </p>
            </div>

            {/* Destination Bank Account Card */}
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-zinc-400 tracking-wider">
                  Rekening Tujuan Penarikan
                </span>
                <Building2 className="w-4 h-4 text-indigo-400" />
              </div>
              {bankAccount.isConfigured ? (
                <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                  <div className="font-bold text-zinc-100 text-sm">
                    {bankAccount.bankName} - {bankAccount.bankAccountNumber}
                  </div>
                  <div className="text-xs text-zinc-400">{bankAccount.bankAccountHolderName}</div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                  Belum ada rekening penarikan terdaftar.
                </div>
              )}
              <button
                type="button"
                onClick={onOpenBankModal}
                className="w-full py-2.5 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-semibold text-xs border border-zinc-700 transition cursor-pointer"
              >
                {bankAccount.isConfigured ? 'Ubah Info Rekening' : '+ Atur Rekening Bank'}
              </button>
            </div>
          </div>

          {/* Payout Requests History Table */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-sm">
            <h4 className="font-bold text-zinc-100 text-sm">Riwayat Permohonan Pencairan Dana (Payouts)</h4>
            {payouts.length === 0 ? (
              <p className="text-xs text-zinc-500">Belum ada riwayat permohonan penarikan dana.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5">ID Payout</th>
                      <th className="py-2.5">Nominal Penarikan</th>
                      <th className="py-2.5">Bank Tujuan</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5">Catatan</th>
                      <th className="py-2.5">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-mono text-[11px]">
                    {payouts.map((payout) => (
                      <tr key={payout.id} className="hover:bg-zinc-800/30 transition">
                        <td className="py-2.5 font-semibold text-zinc-200">{payout.id.slice(0, 8)}...</td>
                        <td className="py-2.5 font-bold text-amber-400">Rp {payout.amount.toLocaleString('id-ID')}</td>
                        <td className="py-2.5 font-sans">
                          {payout.bankName} ({payout.bankAccountNumber})
                        </td>
                        <td className="py-2.5 font-sans">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              payout.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {payout.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-zinc-400 font-sans">{payout.notes || '-'}</td>
                        <td className="py-2.5 text-zinc-400 font-sans">
                          {new Date(payout.createdAt).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: KNOWLEDGE BASE DOCUMENTS */}
      {activeTab === 'KNOWLEDGE' && (
        <div className="space-y-6">
          {/* Upload Dropzone */}
          <div className="p-8 rounded-2xl bg-zinc-900/50 border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 flex flex-col items-center justify-center text-center space-y-3 transition">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
              <FileUp className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-bold text-zinc-100 text-sm">Unggah Dokumen Materi Pembelajaran</h4>
              <p className="text-xs text-zinc-400 mt-0.5">
                Mendukung file PDF dan CSV. Sistem akan otomatis mengekstrak teks, memecah chunks, dan menghasilkan pgvector embeddings.
              </p>
            </div>
            {/* Target Course Selector for Upload */}
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 text-xs">
              <span className="text-zinc-400 font-medium">Tautkan Langsung ke Kursus:</span>
              <select
                value={uploadCourseId}
                onChange={(e) => setUploadCourseId(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-zinc-950 border border-zinc-700 text-zinc-200 text-xs outline-none focus:border-indigo-500 font-sans"
              >
                <option value="">🌐 Global (Dapat Diakses Semua Kursus)</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    🔒 {c.title}
                  </option>
                ))}
              </select>
            </div>

            <label className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition cursor-pointer shadow-sm">
              <span>{isUploading ? 'Sedang Memproses...' : 'Pilih File Dokumen (PDF/CSV)'}</span>
              <input
                type="file"
                accept=".pdf,.csv,.txt"
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
              />
            </label>

            {uploadSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold animate-in fade-in">
                <CheckCircle2 className="w-4 h-4" />
                <span>Dokumen berhasil diunggah dan ditautkan ke kursus!</span>
              </div>
            )}
          </div>

          {/* Document Table */}
          <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="font-bold text-zinc-100 text-sm">Dokumen Terdaftar di Knowledge Base</h4>
                <p className="text-xs text-zinc-400">
                  Ubah hak akses kursus secara langsung pada kolom Target Kursus untuk menjaga isolasi data.
                </p>
              </div>
              <span className="text-xs font-mono text-zinc-500">
                Total: {documents.length} Dokumen
              </span>
            </div>

            {documents.length === 0 ? (
              <p className="text-xs text-zinc-500">Belum ada dokumen yang diunggah.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5">Judul Dokumen</th>
                      <th className="py-2.5">Ukuran</th>
                      <th className="py-2.5">Status Ingestion</th>
                      <th className="py-2.5">Target Kursus (Isolasi RAG)</th>
                      <th className="py-2.5">Vector Chunks</th>
                      <th className="py-2.5">Waktu Unggah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-sans text-xs">
                    {documents.map((doc) => (
                      <tr key={doc.id} className="hover:bg-zinc-800/30 transition">
                        <td className="py-2.5 font-semibold text-zinc-100 flex items-center gap-2">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <span className="truncate max-w-[200px]" title={doc.title}>{doc.title}</span>
                        </td>
                        <td className="py-2.5 font-mono text-zinc-400">
                          {(doc.fileSize / 1024).toFixed(1)} KB
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                              doc.status === 'COMPLETED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : doc.status === 'PROCESSING'
                                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 animate-pulse'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {doc.status}
                          </span>
                        </td>
                        <td className="py-2.5">
                          <select
                            value={doc.courseId || ''}
                            onChange={(e) => handleAssignDocument(doc.id, e.target.value)}
                            className="px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-700 hover:border-indigo-500 text-[11px] text-zinc-200 outline-none focus:border-indigo-500 font-sans cursor-pointer transition max-w-[220px] truncate"
                            title="Pilih kursus yang berhak mengakses dokumen ini"
                          >
                            <option value="">🌐 Global (Semua Kursus)</option>
                            {courses.map((c) => (
                              <option key={c.id} value={c.id}>
                                🔒 {c.title}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 font-mono font-bold text-zinc-200">
                          {doc.chunkCount} Chunks
                        </td>
                        <td className="py-2.5 text-zinc-400">
                          {new Date(doc.createdAt).toLocaleDateString('id-ID')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SUBSCRIPTION TIERS MANAGEMENT */}
      {activeTab === 'TIERS' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h4 className="font-bold text-zinc-100 text-base">Tier Langganan Kursus</h4>
              <p className="text-xs text-zinc-400">Atur harga tier bulanan dan kuota token kredit AI untuk murid.</p>
            </div>
            <button
              type="button"
              onClick={() => setShowTierForm(!showTierForm)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Tier Baru</span>
            </button>
          </div>

          {/* New Tier Form */}
          {showTierForm && (
            <form onSubmit={handleCreateTier} className="p-6 rounded-2xl bg-zinc-900/60 border border-zinc-700/80 space-y-4 animate-in fade-in">
              <h5 className="font-bold text-zinc-100 text-sm">Formulir Tambah Tier Baru</h5>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Nama Tier</label>
                  <input
                    type="text"
                    value={tierName}
                    onChange={(e) => setTierName(e.target.value)}
                    placeholder="Misal: AI Mastery Tier"
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Harga Bulanan (Rp)</label>
                  <input
                    type="number"
                    min="10000"
                    step="5000"
                    value={tierPrice}
                    onChange={(e) => setTierPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Kuota Token AI Per Bulan</label>
                  <input
                    type="number"
                    min="10000"
                    step="10000"
                    value={tierQuota}
                    onChange={(e) => setTierQuota(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500 font-mono"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Deskripsi Singkat</label>
                <input
                  type="text"
                  value={tierDesc}
                  onChange={(e) => setTierDesc(e.target.value)}
                  placeholder="Akses penuh AI Copilot dan materi kuliah"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTierForm(false)}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 text-xs text-zinc-300 hover:bg-zinc-700 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreatingTier}
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-sm transition"
                >
                  {isCreatingTier ? 'Menyimpan...' : 'Simpan Tier'}
                </button>
              </div>
            </form>
          )}

          {/* Active Tiers Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {tiers.map((tier) => (
              <div key={tier.id} className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 space-y-3 shadow-sm hover:border-zinc-700/80 transition">
                <div className="flex justify-between items-start">
                  <h5 className="font-bold text-zinc-100 text-sm">{tier.name}</h5>
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Aktif
                  </span>
                </div>
                <div className="text-xl font-extrabold text-zinc-100">
                  Rp {Number(tier.price).toLocaleString('id-ID')}
                </div>
                <div className="text-xs text-zinc-400 space-y-1">
                  <div>&bull; Kuota: {tier.monthlyCreditQuota.toLocaleString()} token</div>
                  <div>&bull; Hak Kreator: Rp {(Number(tier.price) * 0.8).toLocaleString('id-ID')} (80%)</div>
                  <div>&bull; Fee Platform: Rp {(Number(tier.price) * 0.2).toLocaleString('id-ID')} (20%)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Assign RAG Documents Modal */}
      {quickAssignCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center">
                  <Link2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-100">
                    Tautkan Dokumen RAG Eksklusif
                  </h3>
                  <p className="text-xs text-zinc-400 truncate max-w-sm">
                    {quickAssignCourse.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setQuickAssignCourse(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Pilih dokumen materi yang boleh diakses AI Mentor untuk kursus ini.
                Dokumen yang dicentang akan otomatis terisolasi secara aman ke silabus kursus ini.
              </p>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {documents.length === 0 ? (
                  <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 text-center text-xs text-zinc-500">
                    Belum ada dokumen di Knowledge Base. Silakan unggah dokumen terlebih dahulu.
                  </div>
                ) : (
                  documents.map((doc) => {
                    const isSelected = quickSelectedDocIds.includes(doc.id);
                    return (
                      <div
                        key={doc.id}
                        onClick={() => handleToggleQuickDoc(doc.id)}
                        className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                            : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                              isSelected
                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                : 'border-zinc-700 bg-zinc-900'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="truncate">
                            <div className="text-xs font-semibold truncate text-zinc-200">
                              {doc.title}
                            </div>
                            <div className="text-[10px] text-zinc-500 font-mono">
                              {doc.fileType} • {(doc.fileSize / 1024).toFixed(0)} KB • {doc.chunkCount} Chunks
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                          {isSelected ? 'Terpilih' : 'Tidak Ditautkan'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="p-4 bg-zinc-950/60 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-xs text-zinc-400 font-mono">
                {quickSelectedDocIds.length} Dokumen Dipilih
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuickAssignCourse(null)}
                  className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={isSavingQuickAssign}
                  onClick={handleSaveQuickAssign}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 transition disabled:opacity-50"
                >
                  {isSavingQuickAssign ? 'Menyimpan...' : 'Simpan Tautan RAG'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI PDF to Course Syllabus Generator Modal */}
      <PdfToSyllabusModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        onApplyToCurriculumStudio={handleApplyPdfDraftToStudio}
        onCourseCreated={() => {
          fetchMyCourses();
          onRefreshData();
        }}
      />
    </div>
  );
};
