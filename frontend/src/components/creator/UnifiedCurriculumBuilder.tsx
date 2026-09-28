import React, { useState } from 'react';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  BookOpen,
  Film,
  FileCheck2,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Layers,
  Check,
  AlertCircle,
  Clock,
  FileUp,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';
import type { DocumentItem } from '../../types';

interface LessonDraft {
  id?: string;
  title: string;
  type: 'reading' | 'video' | 'quiz';
  duration: string;
  contentMarkdown?: string;
  videoUrl?: string;
  orderIndex: number;
}

interface ModuleDraft {
  id?: string;
  title: string;
  description?: string;
  orderIndex: number;
  lessons: LessonDraft[];
}

interface UnifiedCurriculumBuilderProps {
  initialCourse?: any;
  availableDocuments: DocumentItem[];
  onBack: () => void;
  onSuccess: () => void;
}

export const UnifiedCurriculumBuilder: React.FC<UnifiedCurriculumBuilderProps> = ({
  initialCourse,
  availableDocuments,
  onBack,
  onSuccess,
}) => {
  // Course Metadata
  const [title, setTitle] = useState(initialCourse?.title || '');
  const [slug, setSlug] = useState(initialCourse?.slug || '');
  const [description, setDescription] = useState(initialCourse?.description || '');
  const [level, setLevel] = useState(initialCourse?.level || 'INTERMEDIATE');

  // Assigned RAG Documents (Exclusive to this course)
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(() => {
    if (initialCourse?.documents) {
      return initialCourse.documents.map((d: any) => d.id);
    }
    // Default: assign documents already tagged with this courseId
    return availableDocuments
      .filter((d) => d.courseId === initialCourse?.id)
      .map((d) => d.id);
  });

  // Modules & Nested Lessons
  const [modules, setModules] = useState<ModuleDraft[]>(() => {
    if (initialCourse?.modules && initialCourse.modules.length > 0) {
      return initialCourse.modules.map((m: any, mIdx: number) => ({
        id: m.id,
        title: m.title,
        description: m.description || '',
        orderIndex: m.orderIndex ?? mIdx + 1,
        lessons: (m.lessons || []).map((l: any, lIdx: number) => ({
          id: l.id,
          title: l.title,
          type: l.type || 'reading',
          duration: l.duration || '15 min',
          contentMarkdown: l.contentMarkdown || '',
          videoUrl: l.videoUrl || '',
          orderIndex: l.orderIndex ?? lIdx + 1,
        })),
      }));
    }
    // Default initial template with 1 module & 2 lessons
    return [
      {
        title: 'Bab 1: Fondasi & Arsitektur Utama',
        description: 'Pengantar konsep dasar dan arsitektur sistem.',
        orderIndex: 1,
        lessons: [
          {
            title: '1.1 Pengenalan Konsep & Arsitektur',
            type: 'reading',
            duration: '15 min',
            contentMarkdown: '# Pengenalan Konsep\nMateri ini membahas prinsip dasar arsitektur sistem...',
            orderIndex: 1,
          },
          {
            title: '1.2 Video Materi: Setup & Komponen Utama',
            type: 'video',
            duration: '20 min',
            videoUrl: '',
            orderIndex: 2,
          },
        ],
      },
    ];
  });

  // UI state
  const [expandedLessonKey, setExpandedLessonKey] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to extract only numbers for lesson duration
  const extractDurationNumber = (val: string) => {
    return (val || '').replace(/[^0-9]/g, '');
  };

  // Auto slug generation from title if empty
  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!initialCourse && (!slug || slug === slugify(title))) {
      setSlug(slugify(val));
    }
  };

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Local document list supporting direct on-the-fly uploads inside builder
  const [docList, setDocList] = useState<DocumentItem[]>(availableDocuments);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);

  const toggleDocumentAssignment = (docId: string) => {
    setSelectedDocIds((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  const handleInlineDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingDoc(true);
    setDocUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name);

      const res = await api.uploadDocument(formData);
      const newDoc: DocumentItem = {
        id: res.id || `doc_${Date.now()}`,
        creatorProfileId: res.creatorProfileId || '',
        title: res.title || file.name,
        fileType: res.fileType || 'PDF',
        fileSize: file.size,
        chunkCount: res.chunkCount || 0,
        status: res.status || 'PROCESSING',
        createdAt: new Date().toISOString(),
      };

      setDocList((prev) => [newDoc, ...prev]);
      setSelectedDocIds((prev) => [...prev, newDoc.id]);
    } catch (err: any) {
      setDocUploadError(err.message || 'Gagal mengunggah dokumen materi.');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Module Actions
  const handleAddModule = () => {
    const nextOrder = modules.length + 1;
    setModules((prev) => [
      ...prev,
      {
        title: `Bab ${nextOrder}: Topik Lanjutan Baru`,
        description: '',
        orderIndex: nextOrder,
        lessons: [
          {
            title: `${nextOrder}.1 Materi Pembelajaran Pertama`,
            type: 'reading',
            duration: '15 min',
            contentMarkdown: '# Materi Baru...',
            orderIndex: 1,
          },
        ],
      },
    ]);
  };

  const handleRemoveModule = (mIdx: number) => {
    if (modules.length === 1) {
      alert('Kursus harus memiliki minimal satu bab/modul.');
      return;
    }
    setModules((prev) => prev.filter((_, idx) => idx !== mIdx));
  };

  const handleModuleTitleChange = (mIdx: number, newTitle: string) => {
    setModules((prev) =>
      prev.map((mod, idx) => (idx === mIdx ? { ...mod, title: newTitle } : mod))
    );
  };

  // Lesson Actions
  const handleAddLesson = (mIdx: number, type: 'reading' | 'video' | 'quiz') => {
    setModules((prev) =>
      prev.map((mod, idx) => {
        if (idx !== mIdx) return mod;
        const nextOrder = mod.lessons.length + 1;
        const newLesson: LessonDraft = {
          title: `${mIdx + 1}.${nextOrder} Materi Baru (${type})`,
          type,
          duration: type === 'video' ? '20 min' : '15 min',
          contentMarkdown: type === 'reading' ? '# Isi Materi Pembelajaran...' : undefined,
          videoUrl: type === 'video' ? 'https://youtube.com/watch?v=...' : undefined,
          orderIndex: nextOrder,
        };
        return {
          ...mod,
          lessons: [...mod.lessons, newLesson],
        };
      })
    );
  };

  const handleRemoveLesson = (mIdx: number, lIdx: number) => {
    setModules((prev) =>
      prev.map((mod, idx) => {
        if (idx !== mIdx) return mod;
        return {
          ...mod,
          lessons: mod.lessons.filter((_, lIndex) => lIndex !== lIdx),
        };
      })
    );
  };

  const handleLessonChange = (mIdx: number, lIdx: number, updates: Partial<LessonDraft>) => {
    setModules((prev) =>
      prev.map((mod, idx) => {
        if (idx !== mIdx) return mod;
        return {
          ...mod,
          lessons: mod.lessons.map((les, lIndex) =>
            lIndex === lIdx ? { ...les, ...updates } : les
          ),
        };
      })
    );
  };

  // Save Full Course & Curriculum In One Shot
  const handleSaveFullCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !slug.trim()) {
      setErrorMessage('Judul dan slug kursus wajib diisi.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const payload = {
        title,
        slug: slug.toLowerCase().trim(),
        description,
        level,
        documentIds: selectedDocIds,
        modules: modules.map((m, mIdx) => ({
          id: m.id,
          title: m.title,
          description: m.description,
          orderIndex: mIdx + 1,
          lessons: m.lessons.map((l, lIdx) => {
            const rawDigits = (l.duration || '').replace(/[^0-9]/g, '');
            const normalizedDuration = rawDigits ? `${rawDigits} min` : '15 min';

            return {
              id: l.id,
              title: l.title,
              type: l.type,
              duration: normalizedDuration,
              contentMarkdown: l.contentMarkdown,
              videoUrl: l.videoUrl,
              orderIndex: lIdx + 1,
            };
          }),
        })),
      };

      await api.createFullCourse(payload);

      setSaveSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kurikulum.');
    } finally {
      setIsSaving(false);
    }
  };

  const totalLessons = modules.reduce((acc, m) => acc + m.lessons.length, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* 1. Studio Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900 border border-zinc-800">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition"
            title="Kembali ke Daftar Kursus"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Studio Kurikulum &amp; RAG Terpadu
              </span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                {modules.length} Bab • {totalLessons} Materi • {selectedDocIds.length} Dokumen RAG
              </span>
            </div>
            <h2 className="text-lg font-bold text-zinc-100 mt-0.5">
              {title || 'Kursus Baru (Tanpa Judul)'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleSaveFullCourse}
            disabled={isSaving}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/20 flex items-center gap-2 transition disabled:opacity-50"
          >
            {isSaving ? (
              <span>Menyimpan Kurikulum...</span>
            ) : saveSuccess ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Tersimpan!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Simpan Seluruh Kurikulum</span>
              </>
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 2. Grid Layout: Course Metadata & RAG Knowledge Assignment */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Course Metadata & RAG Document Assignment */}
        <div className="space-y-6">
          {/* Metadata Card */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-indigo-400" />
              <span>Detail Informasi Kursus</span>
            </h4>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Judul Kursus</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="Contoh: Arsitektur Multi-Tenant RAG"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Slug URL</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="arsitektur-multitenant-rag"
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Tingkat Kesulitan</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
                >
                  <option value="BEGINNER">BEGINNER (Pemula)</option>
                  <option value="INTERMEDIATE">INTERMEDIATE (Menengah)</option>
                  <option value="ADVANCED">ADVANCED (Lanjutan)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Deskripsi Singkat</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkasan target kompetensi kursus..."
                  className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* RAG Knowledge Base Assignment Card */}
          <div className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Dokumen RAG Eksklusif ({selectedDocIds.length})</span>
              </h4>
              <span className="text-[10px] text-zinc-500 font-mono">Course-Scoped</span>
            </div>

            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Pilih dokumen materi resmi yang boleh diakses AI Mentor untuk kursus ini. Dokumen yang tidak dicentang akan <strong>terisolasi</strong> dan tidak dapat dibocorkan ke pertanyaan kursus lain.
            </p>

            {/* Inline Fast Upload inside Builder */}
            <div className="space-y-1.5">
              <label className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-zinc-800 hover:bg-zinc-750 border border-zinc-700/80 hover:border-zinc-600 text-zinc-200 text-xs font-semibold cursor-pointer transition">
                {isUploadingDoc ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                    <span>Memproses Dokumen RAG...</span>
                  </>
                ) : (
                  <>
                    <FileUp className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Unggah Dokumen Baru Langsung</span>
                  </>
                )}
                <input
                  type="file"
                  accept=".pdf,.csv,.txt"
                  disabled={isUploadingDoc}
                  onChange={handleInlineDocUpload}
                  className="hidden"
                />
              </label>

              {docUploadError && (
                <div className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3 shrink-0" />
                  <span>{docUploadError}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {docList.length === 0 ? (
                <div className="p-4 rounded-xl bg-zinc-950/70 border border-zinc-800 text-center text-xs text-zinc-500">
                  Belum ada dokumen yang diunggah. Gunakan tombol di atas untuk mengunggah dokumen kursus secara langsung.
                </div>
              ) : (
                docList.map((doc) => {
                  const isChecked = selectedDocIds.includes(doc.id);
                  return (
                    <div
                      key={doc.id}
                      onClick={() => toggleDocumentAssignment(doc.id)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                        isChecked
                          ? 'bg-indigo-950/30 border-indigo-500/50 text-white'
                          : 'bg-zinc-950/60 border-zinc-800/80 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-zinc-700 bg-zinc-900'
                          }`}
                        >
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                        <div className="truncate">
                          <div className="text-xs font-semibold truncate text-zinc-200">
                            {doc.title}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {doc.fileType} • {(doc.fileSize / 1024).toFixed(0)} KB
                          </div>
                        </div>
                      </div>

                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                        {isChecked ? 'Eksklusif' : 'Unassigned'}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Hierarchical Curriculum Outline */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900 border border-zinc-800">
            <div>
              <h4 className="text-sm font-bold text-zinc-100">Silabus &amp; Rangkaian Materi Pembelajaran</h4>
              <p className="text-xs text-zinc-400">
                Susun bab dan materi dengan fleksibel. Seluruh hierarki tersimpan bersamaan saat klik simpan.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddModule}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Tambah Bab/Modul</span>
            </button>
          </div>

          {/* Module List Accordion / Outline */}
          <div className="space-y-4">
            {modules.map((mod, mIdx) => (
              <div
                key={mIdx}
                className="p-5 rounded-2xl bg-zinc-900 border border-zinc-800 space-y-4 shadow-sm"
              >
                {/* Module Header */}
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 pb-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-300 font-bold border border-indigo-500/20">
                      Bab {mIdx + 1}
                    </span>
                    <input
                      type="text"
                      value={mod.title}
                      onChange={(e) => handleModuleTitleChange(mIdx, e.target.value)}
                      placeholder="Judul Bab / Modul..."
                      className="flex-1 px-2.5 py-1 rounded-lg bg-zinc-950 border border-zinc-800 text-xs font-bold text-zinc-100 outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Add Lesson Quick Buttons */}
                    <button
                      type="button"
                      onClick={() => handleAddLesson(mIdx, 'reading')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1 transition"
                      title="Tambah Materi Artikel Bacaan"
                    >
                      <BookOpen className="w-3 h-3 text-indigo-400" />
                      <span>Bacaan</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLesson(mIdx, 'video')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1 transition"
                      title="Tambah Materi Video"
                    >
                      <Film className="w-3 h-3 text-sky-400" />
                      <span>Video</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddLesson(mIdx, 'quiz')}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-300 flex items-center gap-1 transition"
                      title="Tambah Kuis"
                    >
                      <FileCheck2 className="w-3 h-3 text-emerald-400" />
                      <span>Kuis</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveModule(mIdx)}
                      className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Hapus Bab Ini"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Lessons in this Module */}
                <div className="space-y-2.5 pl-3 border-l-2 border-zinc-800">
                  {mod.lessons.length === 0 ? (
                    <div className="text-xs text-zinc-500 py-2 italic">
                      Belum ada materi di bab ini. Klik tombol di atas untuk menambah materi.
                    </div>
                  ) : (
                    mod.lessons.map((les, lIdx) => {
                      const lessonKey = `${mIdx}-${lIdx}`;
                      const isExpanded = expandedLessonKey === lessonKey;

                      return (
                        <div
                          key={lIdx}
                          className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden transition"
                        >
                          <div className="p-3 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 flex-1 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedLessonKey(isExpanded ? null : lessonKey)
                                }
                                className="text-zinc-500 hover:text-zinc-300"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4" />
                                ) : (
                                  <ChevronRight className="w-4 h-4" />
                                )}
                              </button>

                              {les.type === 'video' ? (
                                <Film className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                              ) : les.type === 'quiz' ? (
                                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              ) : (
                                <BookOpen className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              )}

                              <input
                                type="text"
                                value={les.title}
                                onChange={(e) =>
                                  handleLessonChange(mIdx, lIdx, { title: e.target.value })
                                }
                                placeholder="Judul materi..."
                                className="flex-1 px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 outline-none focus:border-indigo-500"
                              />
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <div
                                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 font-mono focus-within:border-indigo-500/60 transition"
                                title="Estimasi durasi penyelesaian (menit)"
                              >
                                <Clock className="w-3 h-3 text-zinc-500 shrink-0" />
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  pattern="[0-9]*"
                                  value={extractDurationNumber(les.duration)}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/[^0-9]/g, '');
                                    handleLessonChange(mIdx, lIdx, {
                                      duration: digits ? `${digits} min` : '',
                                    });
                                  }}
                                  placeholder="15"
                                  className="w-7 text-[11px] text-zinc-200 text-center font-mono outline-none bg-transparent"
                                />
                                <span className="text-[10px] text-zinc-500 font-sans font-medium select-none">
                                  min
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveLesson(mIdx, lIdx)}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 transition"
                                title="Hapus Materi"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Expanded Content Editor for this Lesson */}
                          {isExpanded && (
                            <div className="p-4 border-t border-zinc-800/80 bg-zinc-900/50 space-y-3">
                              {/* Lesson Editor (Supports Video, Reading, and Hybrid) */}
                              <div className="space-y-3">
                                {les.type === 'video' && (
                                  <div>
                                    <label className="block text-xs font-medium text-zinc-400 mb-1">
                                      URL Video Materi (YouTube / Vimeo / MP4)
                                    </label>
                                    <input
                                      type="url"
                                      value={les.videoUrl || ''}
                                      onChange={(e) =>
                                        handleLessonChange(mIdx, lIdx, { videoUrl: e.target.value })
                                      }
                                      placeholder="https://www.youtube.com/watch?v=... atau https://youtu.be/..."
                                      className="w-full px-3 py-2 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-mono outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                )}

                                {/* Markdown Content Area (Available for reading and video hybrid) */}
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-medium text-zinc-400">
                                      {les.type === 'video'
                                        ? 'Catatan, Rangkuman & Intisari Materi Video (Markdown - Opsional Hybrid)'
                                        : 'Isi Teks Materi Pembelajaran (Markdown)'}
                                    </label>
                                    <span className="text-[10px] text-zinc-500 font-mono">
                                      Mendukung heading, math, bold, code block
                                    </span>
                                  </div>
                                  <textarea
                                    rows={les.type === 'video' ? 5 : 7}
                                    value={les.contentMarkdown || ''}
                                    onChange={(e) =>
                                      handleLessonChange(mIdx, lIdx, {
                                        contentMarkdown: e.target.value,
                                      })
                                    }
                                    placeholder={
                                      les.type === 'video'
                                        ? '# Poin-Poin Utama Video\n\n- Konsep kunci yang dibahas dalam video...\n- Langkah setup kode praktikum...'
                                        : '# Judul Topik Pembelajaran\n\nPenjelasan materi secara mendalam...'
                                    }
                                    className="w-full p-3 rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 text-xs font-mono outline-none focus:border-indigo-500 leading-relaxed"
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddModule}
            className="w-full py-3 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-4 h-4 text-indigo-400" />
            <span>Tambah Bab Pembelajaran Baru</span>
          </button>
        </div>
      </div>
    </div>
  );
};
