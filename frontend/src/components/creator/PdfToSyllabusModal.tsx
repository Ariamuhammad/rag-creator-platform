import React, { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  FileUp,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Film,
  Layers,
  Clock,
  Save,
  RotateCcw,
  Edit3,
  Eye,
  Sliders,
  ChevronRight,
  BookOpen,
} from 'lucide-react';
import { api } from '../../services/api';

interface LessonDraft {
  title: string;
  type: 'reading' | 'video' | 'hybrid' | string;
  duration: string;
  contentMarkdown: string;
  videoPlacement?: 'TOP' | 'MIDDLE' | 'BOTTOM' | string;
  videoUrl?: string;
  orderIndex?: number;
}

interface ModuleDraft {
  title: string;
  description: string;
  orderIndex?: number;
  lessons: LessonDraft[];
}

interface CourseDraft {
  title: string;
  slug: string;
  description: string;
  level: string;
  modules: ModuleDraft[];
}

interface PdfToSyllabusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToCurriculumStudio: (draft: CourseDraft) => void;
  onCourseCreated?: () => void;
}

export const PdfToSyllabusModal: React.FC<PdfToSyllabusModalProps> = ({
  isOpen,
  onClose,
  onApplyToCurriculumStudio,
  onCourseCreated,
}) => {
  // Modal step: 'UPLOAD' | 'GENERATING' | 'REVIEW'
  const [step, setStep] = useState<'UPLOAD' | 'GENERATING' | 'REVIEW'>('UPLOAD');

  // Upload inputs
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [targetLevel, setTargetLevel] = useState<string>('AUTO');
  const [instructions, setInstructions] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Generated draft
  const [draft, setDraft] = useState<CourseDraft | null>(null);
  const [activeModuleIdx, setActiveModuleIdx] = useState(0);
  const [activeLessonIdx, setActiveLessonIdx] = useState(0);
  const [markdownTab, setMarkdownTab] = useState<'PREVIEW' | 'EDIT'>('PREVIEW');

  // Direct save state
  const [isSavingDirectly, setIsSavingDirectly] = useState(false);
  const [directSaveSuccess, setDirectSaveSuccess] = useState(false);

  if (!isOpen) return null;

  // Handle Drag & Drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.toLowerCase().endsWith('.pdf')) {
        setFile(droppedFile);
        setErrorMessage(null);
      } else {
        setErrorMessage('File harus berformat PDF (.pdf).');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.name.toLowerCase().endsWith('.pdf')) {
        setFile(selected);
        setErrorMessage(null);
      } else {
        setErrorMessage('File harus berformat PDF (.pdf).');
      }
    }
  };

  // Submit PDF to AI Generator
  const handleGenerate = async () => {
    if (!file) {
      setErrorMessage('Silakan pilih dokumen PDF terlebih dahulu.');
      return;
    }

    setErrorMessage(null);
    setStep('GENERATING');

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (instructions.trim()) {
        formData.append('instructions', instructions.trim());
      }
      if (targetLevel !== 'AUTO') {
        formData.append('targetLevel', targetLevel);
      }

      const res = await api.generateSyllabusFromPdf(formData);
      if (res && res.courseDraft) {
        setDraft(res.courseDraft);
        setActiveModuleIdx(0);
        setActiveLessonIdx(0);
        setStep('REVIEW');
      } else {
        throw new Error('Gagal memproses struktur silabus dari dokumen ini.');
      }
    } catch (err: any) {
      console.error('Error generating syllabus:', err);
      setErrorMessage(err.message || 'Terjadi kesalahan saat memproses dokumen PDF dengan AI.');
      setStep('UPLOAD');
    }
  };

  // Active Lesson accessor
  const activeLesson: LessonDraft | undefined =
    draft?.modules?.[activeModuleIdx]?.lessons?.[activeLessonIdx];

  const updateActiveLesson = (updatedFields: Partial<LessonDraft>) => {
    if (!draft) return;
    setDraft((prev) => {
      if (!prev) return null;
      const nextModules = [...prev.modules];
      const targetMod = { ...nextModules[activeModuleIdx] };
      const nextLessons = [...targetMod.lessons];
      nextLessons[activeLessonIdx] = {
        ...nextLessons[activeLessonIdx],
        ...updatedFields,
      };
      targetMod.lessons = nextLessons;
      nextModules[activeModuleIdx] = targetMod;
      return {
        ...prev,
        modules: nextModules,
      };
    });
  };

  // Save directly to backend database
  const handleDirectSave = async () => {
    if (!draft) return;
    setIsSavingDirectly(true);
    setErrorMessage(null);

    try {
      // Map modules and lessons to DTO
      const payload = {
        title: draft.title,
        slug: draft.slug,
        description: draft.description,
        level: draft.level,
        modules: draft.modules.map((m, mIdx) => ({
          title: m.title,
          description: m.description,
          orderIndex: mIdx + 1,
          lessons: m.lessons.map((l, lIdx) => ({
            title: l.title,
            type: l.type,
            duration: l.duration,
            contentMarkdown: l.contentMarkdown,
            videoUrl: l.videoUrl || '',
            orderIndex: lIdx + 1,
          })),
        })),
      };

      await api.createFullCourse(payload);
      setDirectSaveSuccess(true);
      if (onCourseCreated) onCourseCreated();

      setTimeout(() => {
        onClose();
        setDirectSaveSuccess(false);
        setStep('UPLOAD');
        setFile(null);
        setDraft(null);
      }, 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Gagal menyimpan kursus ke database.');
    } finally {
      setIsSavingDirectly(false);
    }
  };

  // Apply to Studio Builder
  const handleApplyToStudio = () => {
    if (!draft) return;
    onApplyToCurriculumStudio(draft);
    onClose();
    setStep('UPLOAD');
    setFile(null);
    setDraft(null);
  };

  const totalLessonsCount = (draft?.modules || []).reduce(
    (acc, m) => acc + (m.lessons?.length || 0),
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                <span>AI Course &amp; Syllabus Generator (PDF to Markdown)</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                  Auto-Curriculum
                </span>
              </h3>
              <p className="text-xs text-zinc-400">
                Unggah buku teks, handbook, atau dokumen materi untuk diubah otomatis menjadi silabus kursus &amp; konten Markdown.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded-lg hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP 1: UPLOAD SCREEN */}
        {step === 'UPLOAD' && (
          <div className="p-6 overflow-y-auto space-y-6">
            {/* Drag & Drop Zone */}
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-8 rounded-2xl border-2 border-dashed transition flex flex-col items-center justify-center text-center cursor-pointer group ${
                dragActive
                  ? 'border-amber-400 bg-amber-500/5'
                  : file
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/40 hover:bg-zinc-900/70'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
              />

              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition ${
                  file
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-zinc-900 text-zinc-400 group-hover:text-amber-400 group-hover:scale-105'
                }`}
              >
                {file ? <FileText className="w-7 h-7" /> : <FileUp className="w-7 h-7" />}
              </div>

              {file ? (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-zinc-100">{file.name}</div>
                  <div className="text-xs text-zinc-400 font-mono">
                    {(file.size / 1024 / 1024).toFixed(2)} MB • PDF Siap Diproses
                  </div>
                  <span className="inline-block mt-2 text-[11px] text-amber-400 hover:underline">
                    Klik untuk mengganti dokumen
                  </span>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-zinc-200">
                    Tarik dan lepaskan file PDF ke sini, atau klik untuk memilih
                  </div>
                  <div className="text-xs text-zinc-500">
                    Mendukung buku pegangan, slide presentasi materi, kurikulum kampus, atau panduan teknis (hingga 25MB)
                  </div>
                </div>
              )}
            </div>

            {/* Custom Configuration */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Target Tingkat Kesulitan</span>
                </label>
                <select
                  value={targetLevel}
                  onChange={(e) => setTargetLevel(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition"
                >
                  <option value="AUTO">✨ Rekomendasi Otomatis AI</option>
                  <option value="BEGINNER">Pemula (Beginner)</option>
                  <option value="INTERMEDIATE">Menengah (Intermediate)</option>
                  <option value="ADVANCED">Tingkat Lanjut (Advanced)</option>
                </select>
                <p className="text-[11px] text-zinc-500 mt-1">
                  AI akan menyesuaikan kedalaman penjelasan materi Markdown dengan target peserta.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Instruksi Khusus (Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Buat 3 modul, fokus implementasi praktis..."
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 transition placeholder:text-zinc-600"
                />
                <p className="text-[11px] text-zinc-500 mt-1">
                  Beri panduan khusus gaya bahasa, jumlah bab, atau fokus studi kasus.
                </p>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Bottom CTA */}
            <div className="flex justify-end pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!file}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-amber-950 font-bold text-xs transition flex items-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>Generate Silabus &amp; Konten Markdown Sekarang</span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: GENERATING SCREEN */}
        {step === 'GENERATING' && (
          <div className="p-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-amber-400">
                <Sparkles className="w-8 h-8 animate-pulse" />
              </div>
            </div>

            <div className="space-y-2 max-w-md">
              <h4 className="text-lg font-bold text-zinc-100">
                AI Sedang Menyusun Silabus &amp; Materi...
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mengekstrak teks dokumen PDF, mengelompokkan topik bahasan, merancang hierarki modul, dan menyintesis materi edukasi berformat Markdown lengkap.
              </p>
            </div>

            <div className="w-full max-w-sm p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-2.5 text-xs text-zinc-400 font-mono text-left">
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Ekstraksi teks PDF selesai</span>
              </div>
              <div className="flex items-center gap-2 text-amber-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analisis kurikulum &amp; perancangan bab...</span>
              </div>
              <div className="flex items-center gap-2 text-zinc-600">
                <Clock className="w-4 h-4" />
                <span>Sintesis teks Markdown edukatif</span>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: REVIEW & CUSTOMIZE GENERATED SYLLABUS */}
        {step === 'REVIEW' && draft && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Info Bar */}
            <div className="p-4 px-6 bg-zinc-900/40 border-b border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] uppercase font-mono font-semibold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    Level: {draft.level}
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {draft.modules.length} Modul • {totalLessonsCount} Materi Terstruktur
                  </span>
                </div>
                <input
                  type="text"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className="text-lg font-bold text-zinc-100 bg-transparent border-b border-dashed border-zinc-700 hover:border-zinc-500 focus:border-amber-400 focus:outline-none transition w-full max-w-xl"
                  title="Klik untuk mengubah judul kursus"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setStep('UPLOAD')}
                  className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-medium transition flex items-center gap-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Upload Ulang</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyToStudio}
                  className="px-3.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-300 text-xs font-semibold transition flex items-center gap-1.5 border border-zinc-700"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Buka di Studio Kurikulum</span>
                </button>

                <button
                  type="button"
                  onClick={handleDirectSave}
                  disabled={isSavingDirectly || directSaveSuccess}
                  className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {isSavingDirectly ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : directSaveSuccess ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {directSaveSuccess ? 'Tersimpan!' : 'Simpan &amp; Publikasikan'}
                  </span>
                </button>
              </div>
            </div>

            {/* Split Review Pane */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Modules & Lessons Tree */}
              <div className="w-72 sm:w-80 border-r border-zinc-800 bg-zinc-950/80 p-3 overflow-y-auto space-y-4 shrink-0">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider font-mono px-2 pt-1">
                  Struktur Bab &amp; Materi
                </div>

                <div className="space-y-3">
                  {draft.modules.map((mod, mIdx) => (
                    <div key={mIdx} className="space-y-1.5">
                      <div className="px-2 py-1 text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span className="line-clamp-1">{mod.title}</span>
                      </div>

                      <div className="space-y-1 pl-2">
                        {mod.lessons.map((les, lIdx) => {
                          const isSelected =
                            activeModuleIdx === mIdx && activeLessonIdx === lIdx;
                          return (
                            <button
                              key={lIdx}
                              type="button"
                              onClick={() => {
                                setActiveModuleIdx(mIdx);
                                setActiveLessonIdx(lIdx);
                              }}
                              className={`w-full text-left px-3 py-2 rounded-xl text-xs transition flex items-center justify-between group ${
                                isSelected
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 font-medium'
                                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent'
                              }`}
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                {les.type === 'video' ? (
                                  <Film className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                ) : les.type === 'hybrid' ? (
                                  <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                ) : (
                                  <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                )}
                                <span className="truncate">{les.title}</span>
                              </div>
                              <ChevronRight className="w-3 h-3 text-zinc-600 group-hover:text-zinc-400 shrink-0" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Pane: Lesson Inspector & Markdown Editor */}
              <div className="flex-1 flex flex-col overflow-hidden bg-zinc-900/30">
                {activeLesson ? (
                  <div className="flex-1 flex flex-col overflow-hidden p-5 space-y-4">
                    {/* Lesson Header Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 shrink-0">
                      <div className="sm:col-span-2">
                        <label className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                          Judul Materi
                        </label>
                        <input
                          type="text"
                          value={activeLesson.title}
                          onChange={(e) => updateActiveLesson({ title: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 font-medium"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                          Tipe Materi
                        </label>
                        <select
                          value={activeLesson.type}
                          onChange={(e) => updateActiveLesson({ type: e.target.value })}
                          className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                        >
                          <option value="reading">Bahan Bacaan (Reading)</option>
                          <option value="video">Video Materi</option>
                          <option value="hybrid">Hybrid (Video + Bacaan)</option>
                        </select>
                      </div>

                      {/* Video Placement Setting for Video or Hybrid */}
                      {(activeLesson.type === 'video' || activeLesson.type === 'hybrid') && (
                        <>
                          <div className="sm:col-span-2">
                            <label className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                              URL Video Materi (YouTube / Embed)
                            </label>
                            <input
                              type="text"
                              placeholder="https://www.youtube.com/watch?v=..."
                              value={activeLesson.videoUrl || ''}
                              onChange={(e) => updateActiveLesson({ videoUrl: e.target.value })}
                              className="w-full px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400 font-mono text-[11px]"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] uppercase font-mono text-zinc-500 block mb-1">
                              Posisi Video
                            </label>
                            <select
                              value={activeLesson.videoPlacement || 'TOP'}
                              onChange={(e) => updateActiveLesson({ videoPlacement: e.target.value })}
                              className="w-full px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                            >
                              <option value="TOP">Di Awal (Atas)</option>
                              <option value="MIDDLE">Di Tengah-tengah Bacaan</option>
                              <option value="BOTTOM">Di Akhir (Bawah)</option>
                            </select>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Markdown Studio Header */}
                    <div className="flex items-center justify-between pt-1 border-b border-zinc-800 pb-2 shrink-0">
                      <div className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-bold text-zinc-200">
                          Konten Materi Markdown (Hasil Sintesis AI)
                        </span>
                      </div>

                      <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                        <button
                          type="button"
                          onClick={() => setMarkdownTab('PREVIEW')}
                          className={`px-3 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                            markdownTab === 'PREVIEW'
                              ? 'bg-zinc-800 text-amber-300 font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Eye className="w-3 h-3" />
                          <span>Preview Render</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => setMarkdownTab('EDIT')}
                          className={`px-3 py-1 rounded-md text-[11px] font-medium transition flex items-center gap-1.5 ${
                            markdownTab === 'EDIT'
                              ? 'bg-zinc-800 text-amber-300 font-semibold'
                              : 'text-zinc-400 hover:text-zinc-200'
                          }`}
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Raw Markdown</span>
                        </button>
                      </div>
                    </div>

                    {/* Markdown Content Viewer / Editor */}
                    <div className="flex-1 overflow-hidden rounded-xl bg-zinc-950 border border-zinc-800">
                      {markdownTab === 'PREVIEW' ? (
                        <div className="h-full overflow-y-auto p-5 prose prose-invert prose-amber max-w-none text-xs leading-relaxed">
                          {activeLesson.contentMarkdown ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {activeLesson.contentMarkdown}
                            </ReactMarkdown>
                          ) : (
                            <p className="text-zinc-500 italic">Materi belum memiliki konten markdown.</p>
                          )}
                        </div>
                      ) : (
                        <textarea
                          value={activeLesson.contentMarkdown || ''}
                          onChange={(e) => updateActiveLesson({ contentMarkdown: e.target.value })}
                          placeholder="# Tulis atau sesuaikan konten markdown materi di sini..."
                          className="w-full h-full p-4 bg-zinc-950 text-zinc-200 font-mono text-xs leading-relaxed resize-none focus:outline-none border-none"
                        />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center justify-center p-8 text-center text-zinc-500 text-xs">
                    Pilih salah satu materi di sebelah kiri untuk melihat dan menyesuaikan kontennya.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
