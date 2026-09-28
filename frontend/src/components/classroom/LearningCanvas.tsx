import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Play,
  FileText,
  CheckCircle,
  CheckCircle2,
  Circle,
  Clock,
  BookOpen,
  HelpCircle,
  BookmarkPlus,
  Loader2,
  Sparkles,
  Send,
  GraduationCap,
} from 'lucide-react';
import { api } from '../../services/api';
import type { Lesson, KnowledgeSource } from '../../types/classroom';

interface LearningCanvasProps {
  lesson: Lesson;
  courseTitle: string;
  moduleTitle?: string;
  lessonIndex?: number;
  totalLessonsInModule?: number;
  hasNextLesson?: boolean;
  isSavingProgress?: boolean;
  knowledgeSources?: KnowledgeSource[];
  isLeftPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  isRightPanelOpen: boolean;
  onToggleRightPanel: () => void;
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
  onAskAIWithContext: (highlightedText: string) => void;
  onAddNoteFromHighlight: (highlightedText: string) => void;
  onMarkComplete: (lessonId: string) => void;
}

// Helper to parse YouTube, Vimeo, and direct MP4/WebM video URLs into embeddable sources
const getVideoEmbedInfo = (url?: string) => {
  if (!url || !url.trim()) return null;
  const trimmed = url.trim();

  // YouTube (watch?v=, youtu.be/, embed/, shorts/)
  const ytMatch = trimmed.match(
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=|shorts\/)|youtu\.be\/)([^"&?\/\s]{11})/i
  );
  if (ytMatch && ytMatch[1]) {
    return {
      type: 'youtube' as const,
      src: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=0&rel=0&modestbranding=1`,
    };
  }

  // Vimeo
  const vimeoMatch = trimmed.match(/(?:vimeo\.com\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return {
      type: 'vimeo' as const,
      src: `https://player.vimeo.com/video/${vimeoMatch[1]}?title=0&byline=0&portrait=0`,
    };
  }

  // Direct video file (mp4, webm, ogg, blob, data)
  if (trimmed.match(/\.(mp4|webm|ogg)($|\?)/i) || trimmed.startsWith('blob:') || trimmed.startsWith('data:video')) {
    return {
      type: 'direct' as const,
      src: trimmed,
    };
  }

  // Generic http/https video
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return {
      type: 'direct' as const,
      src: trimmed,
    };
  }

  return null;
};

export const LearningCanvas: React.FC<LearningCanvasProps> = ({
  lesson,
  courseTitle,
  moduleTitle,
  lessonIndex,
  totalLessonsInModule,
  hasNextLesson = false,
  isSavingProgress = false,
  knowledgeSources = [],
  isLeftPanelOpen,
  onToggleLeftPanel,
  isRightPanelOpen,
  onToggleRightPanel,
  isFocusMode,
  onToggleFocusMode,
  onAskAIWithContext,
  onAddNoteFromHighlight,
  onMarkComplete,
}) => {
  const [viewMode, setViewMode] = useState<'reading' | 'video'>(
    lesson?.type === 'video' || (lesson?.videoUrl && !lesson?.contentMarkdown) ? 'video' : 'reading'
  );
  const [bottomTab, setBottomTab] = useState<'SUMMARY' | 'RESOURCES' | 'DISCUSSION'>('SUMMARY');

  // Auto-switch viewMode when a new lesson is selected
  useEffect(() => {
    if (lesson) {
      if (lesson.type === 'video' || (lesson.videoUrl && !lesson.contentMarkdown)) {
        setViewMode('video');
      } else {
        setViewMode('reading');
      }
    }
  }, [lesson?.id, lesson?.type]);

  const videoEmbed = getVideoEmbedInfo(lesson?.videoUrl);
  
  // Real Discussions State from DB
  const [discussions, setDiscussions] = useState<any[]>([]);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(false);
  const [newDiscussionContent, setNewDiscussionContent] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingDiscussion, setIsSubmittingDiscussion] = useState(false);

  useEffect(() => {
    if (lesson?.id) {
      loadDiscussions(lesson.id);
    }
  }, [lesson?.id]);

  const loadDiscussions = async (lessonId: string) => {
    setIsLoadingDiscussions(true);
    try {
      const data = await api.getDiscussions(lessonId).catch(() => []);
      setDiscussions(Array.isArray(data) ? data : []);
    } finally {
      setIsLoadingDiscussions(false);
    }
  };

  const handlePostDiscussion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscussionContent.trim() || isSubmittingDiscussion || !lesson?.id) return;
    setIsSubmittingDiscussion(true);
    try {
      await api.createDiscussion({
        lessonId: lesson.id,
        content: newDiscussionContent.trim(),
      });
      setNewDiscussionContent('');
      await loadDiscussions(lesson.id);
    } catch (err) {
      console.error('Failed creating discussion:', err);
    } finally {
      setIsSubmittingDiscussion(false);
    }
  };

  const handleReplyDiscussion = async (parentId: string) => {
    if (!replyContent.trim() || isSubmittingDiscussion || !lesson?.id) return;
    setIsSubmittingDiscussion(true);
    try {
      await api.replyDiscussion(parentId, replyContent.trim());
      setReplyContent('');
      setReplyingToId(null);
      await loadDiscussions(lesson.id);
    } catch (err) {
      console.error('Failed replying to discussion:', err);
    } finally {
      setIsSubmittingDiscussion(false);
    }
  };

  // Selection popover state
  const [popoverPos, setPopoverPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedText, setSelectedText] = useState<string>('');
  const contentContainerRef = useRef<HTMLDivElement>(null);

  // Detect text selection on mouse up
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed) {
        setPopoverPos(null);
        setSelectedText('');
        return;
      }

      const text = selection.toString().trim();
      if (text.length > 5) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setSelectedText(text);
        setPopoverPos({
          x: rect.left + rect.width / 2,
          y: rect.top - 12,
        });
      } else {
        setPopoverPos(null);
        setSelectedText('');
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      // If clicking outside popover, close it
      const target = e.target as HTMLElement;
      if (!target.closest('#selection-popover')) {
        // give small delay so click on button still fires
        setTimeout(() => {
          const sel = window.getSelection();
          if (!sel || sel.isCollapsed) {
            setPopoverPos(null);
          }
        }, 150);
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  const handleAskAI = () => {
    if (selectedText) {
      onAskAIWithContext(selectedText);
      setPopoverPos(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleSaveToNotes = () => {
    if (selectedText) {
      onAddNoteFromHighlight(selectedText);
      setPopoverPos(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col bg-zinc-900/50 text-zinc-100 overflow-hidden">
      {/* 1. Canvas Top Control Bar */}
      <header className="px-5 py-3 border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur flex items-center justify-between gap-4 shrink-0">
        {/* Left Side: Panel Toggles & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          {!isFocusMode && (
            <button
              type="button"
              onClick={onToggleLeftPanel}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title={isLeftPanelOpen ? 'Sembunyikan Silabus' : 'Tampilkan Silabus'}
            >
              {isLeftPanelOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 font-mono">
              <span className="truncate max-w-[180px] sm:max-w-xs">{courseTitle}</span>
              <span>/</span>
              <span className="text-zinc-400 truncate max-w-[160px] sm:max-w-xs">{moduleTitle || 'Modul Pembelajaran'}</span>
            </div>
            <h2 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate">{lesson.title}</h2>
          </div>
        </div>

        {/* Right Side: View Mode, Fullscreen, and Right Panel Toggle */}
        <div className="flex items-center gap-2">
          {/* Mode Switcher (Reading vs Video) */}
          <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setViewMode('reading')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
                viewMode === 'reading' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Baca Materi</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('video')}
              className={`px-2.5 py-1 rounded flex items-center gap-1.5 transition ${
                viewMode === 'video' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Video Materi</span>
            </button>
          </div>

          {/* Focus Mode Toggle */}
          <button
            type="button"
            onClick={onToggleFocusMode}
            className={`p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
              isFocusMode
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
            title="Focus Mode (Distraction-Free)"
          >
            {isFocusMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          {/* Right Panel Toggle (AI Copilot) */}
          {!isFocusMode && (
            <button
              type="button"
              onClick={onToggleRightPanel}
              className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 transition"
              title={isRightPanelOpen ? 'Sembunyikan AI Mentor' : 'Tampilkan AI Mentor'}
            >
              {isRightPanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
            </button>
          )}
        </div>
      </header>

      {/* 2. Primary Media / Reading Canvas Content */}
      <div
        ref={contentContainerRef}
        className="flex-1 overflow-y-auto px-6 py-8 md:px-14 lg:px-20 scrollbar-thin space-y-8"
      >
        {viewMode === 'video' ? (
          /* Real Video Player Canvas with Hybrid Notes Support */
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header Title & Meta for Video Mode */}
            <div className="border-b border-zinc-800/70 pb-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium whitespace-nowrap">
                  <Play className="w-3.5 h-3.5 text-sky-400" />
                  <span>Video Materi</span>
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{lesson.duration || '15 min'}</span>
                </span>
                {moduleTitle && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 text-xs truncate max-w-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                    <span className="truncate">{moduleTitle}</span>
                  </span>
                )}
                {lesson.completed ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-medium text-xs whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sudah Selesai</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs whitespace-nowrap">
                    <Circle className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Belum Selesai</span>
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                {lesson.title}
              </h1>
            </div>

            {/* Real Playable Video Frame */}
            {videoEmbed ? (
              <div className="relative aspect-video w-full rounded-2xl bg-black border border-zinc-800 overflow-hidden shadow-2xl">
                {videoEmbed.type === 'youtube' || videoEmbed.type === 'vimeo' ? (
                  <iframe
                    src={videoEmbed.src}
                    title={lesson.title}
                    className="w-full h-full border-0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <video
                    controls
                    playsInline
                    className="w-full h-full object-contain"
                    src={videoEmbed.src}
                  >
                    Browser Anda tidak mendukung pemutar video HTML5.
                  </video>
                )}
              </div>
            ) : (
              /* Informative Empty State for Lessons without Video URL */
              <div className="relative aspect-video w-full rounded-2xl bg-zinc-950 border border-zinc-800/80 overflow-hidden shadow-2xl flex flex-col items-center justify-center p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 text-zinc-400 flex items-center justify-center shadow-lg">
                  <Play className="w-7 h-7 text-indigo-400 translate-x-0.5" />
                </div>
                <div className="space-y-1.5 max-w-md">
                  <h3 className="text-base font-bold text-zinc-200">Video Materi Belum Ditautkan</h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Edukator belum menautkan link video resmi (YouTube / MP4) untuk materi ini di Studio Kurikulum. Anda dapat membaca catatan materi di bawah ini atau berkonsultasi dengan AI Mentor di panel samping.
                  </p>
                </div>
              </div>
            )}

            {/* Hybrid Feature: Catatan, Rangkuman & Intisari Materi di Bawah Video */}
            {lesson.contentMarkdown ? (
              <div className="pt-6 border-t border-zinc-800/80 space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2 text-sm font-bold text-zinc-100">
                    <BookOpen className="w-4 h-4 text-indigo-400" />
                    <span>Catatan &amp; Intisari Pendukung Video</span>
                  </div>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    Sorot teks untuk bertanya ke AI Mentor
                  </span>
                </div>
                <div className="text-sm sm:text-[15px] leading-7 space-y-4 text-zinc-300">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => (
                        <h2 className="text-xl sm:text-2xl font-bold text-white pt-4 pb-2 border-b border-zinc-800/80">
                          {children}
                        </h2>
                      ),
                      h2: ({ children }) => (
                        <h3 className="text-lg sm:text-xl font-bold text-zinc-100 pt-4 pb-1">
                          {children}
                        </h3>
                      ),
                      h3: ({ children }) => (
                        <h4 className="text-base font-semibold text-zinc-200 pt-3 pb-1">
                          {children}
                        </h4>
                      ),
                      p: ({ children }) => (
                        <p className="text-zinc-300 leading-relaxed my-3.5">
                          {children}
                        </p>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-outside ml-5 space-y-1.5 text-zinc-300 my-3">
                          {children}
                        </ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-outside ml-5 space-y-1.5 text-zinc-300 my-3">
                          {children}
                        </ol>
                      ),
                      li: ({ children }) => (
                        <li className="text-zinc-300 leading-relaxed">{children}</li>
                      ),
                      blockquote: ({ children }) => (
                        <blockquote className="p-4 rounded-xl bg-zinc-950/80 border-l-4 border-indigo-500 text-xs sm:text-sm text-zinc-300 italic leading-relaxed my-4">
                          {children}
                        </blockquote>
                      ),
                      code: ({ className, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(className || '');
                        const isInline = !match && !String(children).includes('\n');
                        return isInline ? (
                          <code className="px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 font-mono text-xs text-indigo-300" {...props}>
                            {children}
                          </code>
                        ) : (
                          <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs my-4 shadow-lg">
                            <div className="px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 flex justify-between items-center text-[11px]">
                              <span className="text-indigo-400 uppercase font-semibold">{match ? match[1] : 'snippet'}</span>
                              <span className="text-zinc-500">PostgreSQL / RAG Engine</span>
                            </div>
                            <pre className="p-4 text-emerald-400 leading-relaxed overflow-x-auto">
                              <code>{children}</code>
                            </pre>
                          </div>
                        );
                      },
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-4 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                          <table className="w-full text-left text-xs border-collapse">
                            {children}
                          </table>
                        </div>
                      ),
                      thead: ({ children }) => (
                        <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-mono bg-zinc-900/50">
                          {children}
                        </thead>
                      ),
                      th: ({ children }) => (
                        <th className="p-3 font-semibold text-zinc-300">{children}</th>
                      ),
                      td: ({ children }) => (
                        <td className="p-3 text-zinc-300 border-t border-zinc-900">{children}</td>
                      ),
                      strong: ({ children }) => (
                        <strong className="text-white font-semibold">{children}</strong>
                      ),
                    }}
                  >
                    {lesson.contentMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 text-xs text-zinc-400 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <span>Tonton video di atas hingga tuntas. Tanyakan konsep teknis ke <strong>AI Mentor</strong> di panel samping jika ada materi yang perlu diperjelas.</span>
              </div>
            )}

            {/* Video Mode Completion Action Bar */}
            <div className="pt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80">
              <span className="text-xs text-zinc-500 font-mono">
                {lessonIndex !== undefined && totalLessonsInModule !== undefined
                  ? `Materi ${lessonIndex} dari ${totalLessonsInModule} pada ${moduleTitle || 'Bab Ini'}`
                  : lesson.duration || 'Estimasi 15 menit'}
              </span>

              <button
                type="button"
                disabled={isSavingProgress}
                onClick={() => onMarkComplete(lesson.id)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-sm ${
                  lesson.completed
                    ? 'bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-emerald-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                } ${isSavingProgress ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSavingProgress ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                ) : (
                  <CheckCircle className={`w-4 h-4 ${lesson.completed ? 'text-emerald-400' : 'text-white'}`} />
                )}
                <span>
                  {isSavingProgress
                    ? 'Menyimpan Progres...'
                    : lesson.completed
                    ? hasNextLesson
                      ? 'Lanjut ke Materi Berikutnya →'
                      : 'Materi Selesai (Materi Terakhir)'
                    : hasNextLesson
                    ? 'Tandai Materi Selesai & Lanjut →'
                    : 'Tandai Selesai (Selesai Kursus 🎉)'}
                </span>
              </button>
            </div>
          </div>
        ) : (
          /* Editorial Academic Reading Canvas */
          <article className="max-w-3xl mx-auto space-y-6 text-zinc-300 leading-relaxed font-sans selection:bg-indigo-500/20 selection:text-indigo-200">
            {/* Accompanying Video Invitation Banner if Available */}
            {videoEmbed && (
              <div className="p-4 rounded-2xl bg-gradient-to-r from-sky-950/40 via-indigo-950/30 to-zinc-900 border border-sky-500/30 text-xs text-sky-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500/20 border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                    <Play className="w-4 h-4 translate-x-0.5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-xs">Materi ini dilengkapi Video Pembelajaran</h4>
                    <p className="text-[11px] text-sky-300/80">Tonton penjelasan visual materi dari instruktur.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setViewMode('video')}
                  className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs flex items-center gap-1.5 transition shadow-sm shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Buka Video Materi</span>
                </button>
              </div>
            )}

            {/* Header Title & Meta */}
            <div className="border-b border-zinc-800/70 pb-6 space-y-3.5">
              {/* Clean Editorial Metadata Bar */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                {/* Lesson Type Tag */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 font-medium whitespace-nowrap">
                  {lesson.type === 'video' ? (
                    <Play className="w-3.5 h-3.5 text-zinc-400" />
                  ) : lesson.type === 'quiz' ? (
                    <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  ) : (
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  <span>{lesson.type === 'video' ? 'Video Materi' : lesson.type === 'quiz' ? 'Kuis Evaluasi' : 'Teks Bacaan'}</span>
                </span>

                {/* Duration Tag */}
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/60 border border-zinc-800/80 text-zinc-400 whitespace-nowrap">
                  <Clock className="w-3.5 h-3.5 text-zinc-500" />
                  <span>{lesson.duration || '15 min'}</span>
                </span>

                {/* Module Scope Tag */}
                {moduleTitle && (
                  <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-zinc-400 text-xs truncate max-w-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />
                    <span className="truncate">{moduleTitle}</span>
                  </span>
                )}

                {/* Completion Status */}
                {lesson.completed ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 font-medium text-xs whitespace-nowrap">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Sudah Selesai</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-900/40 border border-zinc-800/60 text-zinc-500 text-xs whitespace-nowrap">
                    <Circle className="w-3.5 h-3.5 text-zinc-600" />
                    <span>Belum Selesai</span>
                  </span>
                )}
              </div>

              {/* Lesson Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
                {lesson.title}
              </h1>

              {/* Subtitle / Context Note */}
              <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl">
                Pelajari materi kurikulum terverifikasi di bawah ini. Anda dapat menyorot teks mana pun untuk membuat catatan atau langsung menanyakannya kepada AI Mentor RAG.
              </p>
            </div>

            {/* Dynamic Technical / Markdown Content */}
            {lesson.contentMarkdown ? (
              <div className="text-sm sm:text-[15px] leading-7 space-y-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => (
                      <h2 className="text-xl sm:text-2xl font-bold text-white pt-4 pb-2 border-b border-zinc-800/80">
                        {children}
                      </h2>
                    ),
                    h2: ({ children }) => (
                      <h3 className="text-lg sm:text-xl font-bold text-zinc-100 pt-4 pb-1">
                        {children}
                      </h3>
                    ),
                    h3: ({ children }) => (
                      <h4 className="text-base font-semibold text-zinc-200 pt-3 pb-1">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="text-zinc-300 leading-relaxed my-3.5">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-outside ml-5 space-y-1.5 text-zinc-300 my-3">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-outside ml-5 space-y-1.5 text-zinc-300 my-3">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="text-zinc-300 leading-relaxed">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="p-4 rounded-xl bg-zinc-950/80 border-l-4 border-indigo-500 text-xs sm:text-sm text-zinc-300 italic leading-relaxed my-4">
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children, ...props }: any) => {
                      const match = /language-(\w+)/.exec(className || '');
                      const isInline = !match && !String(children).includes('\n');
                      return isInline ? (
                        <code className="px-1.5 py-0.5 rounded bg-zinc-800/80 border border-zinc-700/50 font-mono text-xs text-indigo-300" {...props}>
                          {children}
                        </code>
                      ) : (
                        <div className="rounded-xl bg-zinc-950 border border-zinc-800 overflow-hidden font-mono text-xs my-4 shadow-lg">
                          <div className="px-4 py-2 bg-zinc-900/80 border-b border-zinc-800 text-zinc-400 flex justify-between items-center text-[11px]">
                            <span className="text-indigo-400 uppercase font-semibold">{match ? match[1] : 'snippet'}</span>
                            <span className="text-zinc-500">PostgreSQL / RAG Engine</span>
                          </div>
                          <pre className="p-4 text-emerald-400 leading-relaxed overflow-x-auto">
                            <code>{children}</code>
                          </pre>
                        </div>
                      );
                    },
                    table: ({ children }) => (
                      <div className="overflow-x-auto my-4 p-1 rounded-xl bg-zinc-950 border border-zinc-800">
                        <table className="w-full text-left text-xs border-collapse">
                          {children}
                        </table>
                      </div>
                    ),
                    thead: ({ children }) => (
                      <thead className="border-b border-zinc-800 text-zinc-400 uppercase text-[10px] font-mono bg-zinc-900/50">
                        {children}
                      </thead>
                    ),
                    th: ({ children }) => (
                      <th className="p-3 font-semibold text-zinc-300">{children}</th>
                    ),
                    td: ({ children }) => (
                      <td className="p-3 text-zinc-300 border-t border-zinc-900">{children}</td>
                    ),
                    strong: ({ children }) => (
                      <strong className="text-white font-semibold">{children}</strong>
                    ),
                  }}
                >
                  {lesson.contentMarkdown}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="p-8 rounded-2xl bg-zinc-950/60 border border-zinc-800/80 text-center space-y-4 my-6">
                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mx-auto flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-zinc-200">
                    {lesson.title}
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto">
                    Materi ini sedang dipersiapkan oleh edukator. Silakan buka tab Video Materi atau tanyakan langsung ke AI Mentor di panel kanan.
                  </p>
                </div>
              </div>
            )}

            {/* Lesson Completion Action Button */}
            <div className="pt-8 border-t border-zinc-800/80 flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-zinc-500 font-mono">
                {lessonIndex !== undefined && totalLessonsInModule !== undefined
                  ? `Materi ${lessonIndex} dari ${totalLessonsInModule} pada ${moduleTitle || 'Bab Ini'}`
                  : lesson.duration || 'Estimasi 15 menit'}
              </span>

              <button
                type="button"
                disabled={isSavingProgress}
                onClick={() => onMarkComplete(lesson.id)}
                className={`px-5 py-2.5 rounded-xl font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-sm ${
                  lesson.completed
                    ? 'bg-zinc-800 hover:bg-zinc-750 text-emerald-400 border border-emerald-500/30'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/20'
                } ${isSavingProgress ? 'opacity-70 cursor-wait' : ''}`}
              >
                {isSavingProgress ? (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-300" />
                ) : (
                  <CheckCircle className={`w-4 h-4 ${lesson.completed ? 'text-emerald-400' : 'text-white'}`} />
                )}
                <span>
                  {isSavingProgress
                    ? 'Menyimpan Progres...'
                    : lesson.completed
                    ? hasNextLesson
                      ? 'Lanjut ke Materi Berikutnya →'
                      : 'Materi Selesai (Materi Terakhir)'
                    : hasNextLesson
                    ? 'Tandai Materi Selesai & Lanjut →'
                    : 'Tandai Selesai (Selesai Kursus 🎉)'}
                </span>
              </button>
            </div>
          </article>
        )}

        {/* 3. Bottom Tabs: Executive Summary, Resources, Discussion */}
        <section className="max-w-3xl mx-auto pt-8 border-t border-zinc-800/80 space-y-4">
          <div className="flex gap-2 border-b border-zinc-800/60 pb-2 text-xs font-medium">
            <button
              type="button"
              onClick={() => setBottomTab('SUMMARY')}
              className={`px-3 py-1.5 rounded-lg transition ${
                bottomTab === 'SUMMARY' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Ringkasan Materi
            </button>
            <button
              type="button"
              onClick={() => setBottomTab('RESOURCES')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                bottomTab === 'RESOURCES' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Dokumen Kursus</span>
              <span className="w-4 h-4 rounded-full bg-zinc-800 text-zinc-300 text-[10px] flex items-center justify-center font-mono">
                {knowledgeSources.length}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setBottomTab('DISCUSSION')}
              className={`px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 ${
                bottomTab === 'DISCUSSION' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Forum Tanya-Jawab</span>
              <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] flex items-center justify-center font-mono">
                {discussions.length}
              </span>
            </button>
          </div>

          <div className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 text-xs text-zinc-300">
            {bottomTab === 'SUMMARY' && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                  <BookOpen className="w-4 h-4 text-indigo-400" />
                  <span>Poin Utama Materi: {lesson.title}</span>
                </div>
                <div className="text-zinc-400 text-xs leading-relaxed space-y-2">
                  <p>
                    Materi ini dirancang untuk memberikan pemahaman arsitektural yang mendalam. Sorot teks pada bacaan di atas untuk langsung berkonsultasi dengan AI Mentor RAG yang terhubung ke dokumen edukator.
                  </p>
                  <ul className="list-disc list-inside space-y-1 text-zinc-300">
                    <li>Estimasi waktu penyelesaian: <strong className="text-zinc-100">{lesson.duration || '15 min'}</strong></li>
                    <li>Status materi: <strong className={lesson.completed ? 'text-emerald-400' : 'text-amber-400'}>{lesson.completed ? 'Sudah Tuntas' : 'Sedang Dipelajari'}</strong></li>
                    <li>Tersinkronisasi otomatis dengan basis pengetahuan RAG edukator.</li>
                  </ul>
                </div>
              </div>
            )}

            {bottomTab === 'RESOURCES' && (
              <div className="space-y-3">
                {knowledgeSources.length > 0 ? (
                  <div className="space-y-2">
                    {knowledgeSources.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/80 border border-zinc-800"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-indigo-400 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-zinc-200 truncate">{doc.title}</p>
                            <p className="text-[11px] text-zinc-500 font-mono">
                              {doc.fileSize} &bull; {doc.chunkCount} vector chunks terindeks
                            </p>
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                          Terisolasi pgvector
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    Belum ada dokumen yang dilampirkan ke kursus ini.
                  </div>
                )}
              </div>
            )}

            {bottomTab === 'DISCUSSION' && (
              <div className="space-y-4">
                {/* Form Ask Question */}
                <form onSubmit={handlePostDiscussion} className="space-y-2 pb-4 border-b border-zinc-800/80">
                  <label className="block text-xs font-medium text-zinc-200">
                    Tanya Edukator &amp; Diskusi Terbuka
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newDiscussionContent}
                      onChange={(e) => setNewDiscussionContent(e.target.value)}
                      placeholder="Tuliskan pertanyaan Anda mengenai materi ini..."
                      className="flex-1 px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSubmittingDiscussion || !newDiscussionContent.trim()}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition cursor-pointer shrink-0"
                    >
                      {isSubmittingDiscussion ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>Kirim</span>
                    </button>
                  </div>
                </form>

                {/* Discussions List */}
                {isLoadingDiscussions ? (
                  <div className="py-6 flex items-center justify-center gap-2 text-xs text-zinc-500">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                    <span>Memuat thread diskusi dari database...</span>
                  </div>
                ) : discussions.length > 0 ? (
                  <div className="space-y-3">
                    {discussions.map((d: any) => (
                      <div key={d.id} className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-2.5">
                        <div className="flex justify-between items-center text-[11px]">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-zinc-200">
                              {d.user?.fullName || d.user?.email || 'Murid'}
                            </span>
                            {d.user?.role === 'CREATOR' && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-medium">
                                Edukator
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-500 font-mono text-[10px]">
                            {d.createdAt ? new Date(d.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300 leading-relaxed">{d.content}</p>

                        {/* Replies */}
                        {d.replies && d.replies.length > 0 && (
                          <div className="mt-3 pl-3 border-l-2 border-indigo-500/40 space-y-2">
                            {d.replies.map((r: any) => (
                              <div key={r.id} className="p-2.5 rounded-lg bg-indigo-950/20 border border-indigo-500/20 space-y-1">
                                <div className="flex justify-between items-center text-[10px]">
                                  <div className="flex items-center gap-1.5 text-indigo-300 font-semibold">
                                    <GraduationCap className="w-3.5 h-3.5" />
                                    <span>{r.user?.fullName || 'Edukator Kursus'}</span>
                                  </div>
                                  <span className="text-zinc-500 font-mono">
                                    {r.createdAt ? new Date(r.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                                  </span>
                                </div>
                                <p className="text-xs text-zinc-200 leading-relaxed">{r.content}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Reply Input Form */}
                        {replyingToId === d.id ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="text"
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder="Balas diskusi ini..."
                              className="flex-1 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleReplyDiscussion(d.id)}
                              disabled={isSubmittingDiscussion || !replyContent.trim()}
                              className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium cursor-pointer"
                            >
                              Kirim
                            </button>
                            <button
                              type="button"
                              onClick={() => setReplyingToId(null)}
                              className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300 text-xs"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setReplyingToId(d.id)}
                            className="text-[11px] text-zinc-400 hover:text-indigo-400 transition"
                          >
                            Balas diskusi ini &rarr;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-zinc-500 text-xs">
                    Belum ada diskusi untuk materi ini. Jadilah yang pertama mengajukan pertanyaan!
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* 4. Interactive Highlight Popover (Floating Action Bar on Text Selection) */}
      {popoverPos && (
        <div
          id="selection-popover"
          style={{
            position: 'fixed',
            left: `${popoverPos.x}px`,
            top: `${popoverPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          className="z-50 flex items-center gap-1 p-1 bg-zinc-900 text-zinc-200 border border-zinc-700/80 rounded-xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          <button
            type="button"
            onClick={handleAskAI}
            className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center gap-1.5 transition shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Tanyakan AI Mentor</span>
          </button>

          <button
            type="button"
            onClick={handleSaveToNotes}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white font-medium text-xs flex items-center gap-1.5 transition"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Simpan ke Catatan</span>
          </button>
        </div>
      )}
    </div>
  );
};
