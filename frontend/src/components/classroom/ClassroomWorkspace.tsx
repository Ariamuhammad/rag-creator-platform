import React, { useState, useEffect } from 'react';
import { CheckCircle, Loader2 } from 'lucide-react';
import { CurriculumSidebar } from './CurriculumSidebar';
import { LearningCanvas } from './LearningCanvas';
import { NotebookCopilot } from './NotebookCopilot';
import { api } from '../../services/api';
import type { CourseModule, Lesson, PersonalNote, KnowledgeSource } from '../../types/classroom';

interface ClassroomWorkspaceProps {
  creatorProfileId: string;
  courseId?: string;
  courseSlug?: string;
  remainingCredits: number;
}

export const ClassroomWorkspace: React.FC<ClassroomWorkspaceProps> = ({
  creatorProfileId,
  courseId,
  courseSlug = 'enterprise-rag-systems',
  remainingCredits,
}) => {
  // Course State (Clean Database-Driven State)
  const [modules, setModules] = useState<CourseModule[]>([]);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [courseTitle, setCourseTitle] = useState('Memuat Silabus Kursus...');
  const [activeCourseId, setActiveCourseId] = useState<string | undefined>(courseId);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [isSavingProgress, setIsSavingProgress] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [completionToast, setCompletionToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);

  // Personal Notes State from Database
  const [notes, setNotes] = useState<PersonalNote[]>([]);

  useEffect(() => {
    if (courseSlug) {
      loadCourseData(courseSlug);
    }
    loadRealNotes();
  }, [courseSlug]);

  const loadRealNotes = async () => {
    try {
      const realNotes = await api.getNotes().catch(() => []);
      if (Array.isArray(realNotes)) {
        const mappedNotes: PersonalNote[] = realNotes.map((n: any) => ({
          id: n.id,
          lessonId: n.lessonId,
          lessonTitle: n.lesson?.title || 'Materi Kursus',
          selectedText: n.selectedText || '',
          noteText: n.noteText,
          timestamp: n.createdAt ? new Date(n.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Baru saja',
        }));
        setNotes(mappedNotes);
      }
    } catch (e) {
      console.warn('Failed loading notes from DB:', e);
    }
  };

  const loadCourseData = async (slug: string) => {
    setIsLoading(true);
    try {
      const res = await api.getCourseBySlug(slug).catch(() => null);
      if (res) {
        if (res.title) setCourseTitle(res.title);
        if (res.id) setActiveCourseId(res.id);

        if (res.modules && res.modules.length > 0) {
          setModules(res.modules);
          // Auto-select first incomplete lesson, or first lesson
          const flat = res.modules.flatMap((m: any) => m.lessons || []);
          const firstIncomplete = flat.find((l: any) => !l.completed);
          const targetLesson = firstIncomplete || flat[0] || null;
          if (targetLesson) {
            setActiveLesson(targetLesson);
          }
        }

        if (res.documents && res.documents.length > 0) {
          const mappedDocs: KnowledgeSource[] = res.documents.map((d: any) => ({
            id: d.id,
            title: d.title,
            type: d.fileType?.toLowerCase() === 'pdf' ? 'pdf' : 'doc',
            chunkCount: d.chunkCount || 20,
            fileSize: `${((d.fileSize || 1024) / 1024).toFixed(0)} KB`,
            status: 'indexed',
            relevanceTag: 'Dokumen Kursus Terisolasi',
          }));
          setKnowledgeSources(mappedDocs);
        }
      }
    } catch (e) {
      console.warn('Failed loading course data in classroom:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Tri-Pane Layout State
  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [isFocusMode, setIsFocusMode] = useState(false);

  // Cross-pane context passing (Highlight in Canvas -> Query in AI Mentor)
  const [highlightContextForAI, setHighlightContextForAI] = useState<string | undefined>(undefined);

  // Calculate syllabus progress and relative positioning
  const allLessons = modules.flatMap((m) => m.lessons);
  const completedCount = allLessons.filter((l) => l.completed).length;
  const totalCount = allLessons.length;

  const activeModule = modules.find((m) => m.lessons.some((l) => l.id === activeLesson?.id));
  const moduleTitle = activeModule?.title;
  const moduleLessons = activeModule?.lessons || [];
  const lessonIndexInModule = activeLesson
    ? moduleLessons.findIndex((l) => l.id === activeLesson.id) + 1
    : 1;
  const totalLessonsInModule = moduleLessons.length;

  const currentFlatIndex = activeLesson ? allLessons.findIndex((l) => l.id === activeLesson.id) : -1;
  const hasNextLesson = currentFlatIndex >= 0 && currentFlatIndex < allLessons.length - 1;

  const handleSelectLesson = (lesson: Lesson) => {
    setActiveLesson(lesson);
  };

  const handleMarkCompleteAndNext = async (lessonId: string) => {
    if (!lessonId || isSavingProgress) return;
    setIsSavingProgress(true);

    // 1. Calculate next lesson before updating state
    const flatLessons = modules.flatMap((m) => m.lessons);
    const currentIndex = flatLessons.findIndex((l) => l.id === lessonId);
    const nextLesson =
      currentIndex >= 0 && currentIndex < flatLessons.length - 1
        ? flatLessons[currentIndex + 1]
        : null;

    // 2. Optimistic local state update
    setModules((prev) =>
      prev.map((mod) => ({
        ...mod,
        lessons: mod.lessons.map((l) => (l.id === lessonId ? { ...l, completed: true } : l)),
      }))
    );

    if (activeLesson?.id === lessonId) {
      setActiveLesson((prev) => (prev ? { ...prev, completed: true } : null));
    }

    // 3. Persist progress to DB
    try {
      await api.updateLessonProgress(lessonId, true);
    } catch (err: any) {
      console.warn('Gagal menyimpan progres ke database:', err?.message);
    } finally {
      setIsSavingProgress(false);
    }

    // 4. Advance to next lesson if available
    if (nextLesson) {
      setActiveLesson(nextLesson);
      setCompletionToast({
        message: `Materi tuntas! Beralih ke: ${nextLesson.title}`,
        type: 'success',
      });
      setTimeout(() => setCompletionToast(null), 3500);
    } else {
      setCompletionToast({
        message: '🎉 Selamat! Anda telah menyelesaikan seluruh materi di kursus ini!',
        type: 'success',
      });
      setTimeout(() => setCompletionToast(null), 5000);
    }
  };

  const handleAddNote = async (newNoteData: { noteText: string; selectedText?: string }) => {
    if (!activeLesson) return;
    try {
      const savedNote = await api.createNote({
        lessonId: activeLesson.id,
        selectedText: newNoteData.selectedText,
        noteText: newNoteData.noteText,
      });

      const newNote: PersonalNote = {
        id: savedNote.id || `note_${Date.now()}`,
        lessonId: activeLesson.id,
        lessonTitle: activeLesson.title,
        selectedText: newNoteData.selectedText,
        noteText: newNoteData.noteText,
        timestamp: 'Baru saja',
      };
      setNotes((prev) => [newNote, ...prev]);
    } catch (err: any) {
      console.error('Failed saving note to DB:', err);
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.error('Failed deleting note from DB:', err);
    }
  };

  const handleToggleFocusMode = () => {
    if (!isFocusMode) {
      setIsLeftPanelOpen(false);
      setIsRightPanelOpen(false);
      setIsFocusMode(true);
    } else {
      setIsLeftPanelOpen(true);
      setIsRightPanelOpen(true);
      setIsFocusMode(false);
    }
  };

  const handleAskAIWithContext = (text: string) => {
    setHighlightContextForAI(text);
    if (!isRightPanelOpen) {
      setIsRightPanelOpen(true);
    }
  };

  const handleAddNoteFromHighlight = (text: string) => {
    handleAddNote({
      selectedText: text,
      noteText: 'Kutipan penting untuk dipelajari kembali.',
    });
    if (!isRightPanelOpen) {
      setIsRightPanelOpen(true);
    }
  };

  if (isLoading && modules.length === 0) {
    return (
      <div className="w-full h-[calc(100vh-62px)] flex items-center justify-center bg-zinc-950 text-zinc-400 gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
        <span className="text-sm font-medium">Memuat silabus materi dari database...</span>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[calc(100vh-62px)] flex bg-zinc-950 overflow-hidden text-zinc-100 font-sans">
      {/* 1. Left Panel (Curriculum & Knowledge Sources) ~22% width */}
      {!isFocusMode && isLeftPanelOpen && (
        <div className="w-72 lg:w-80 shrink-0 h-full transition-all duration-200">
          <CurriculumSidebar
            modules={modules}
            activeLessonId={activeLesson?.id || ''}
            onSelectLesson={handleSelectLesson}
            knowledgeSources={knowledgeSources}
            completedCount={completedCount}
            totalCount={totalCount}
          />
        </div>
      )}

      {/* 2. Middle Panel (Primary Learning Canvas) ~50% - 100% width */}
      <div className="flex-1 h-full min-w-0 transition-all duration-200">
        {activeLesson ? (
          <LearningCanvas
            lesson={activeLesson}
            courseTitle={courseTitle}
            moduleTitle={moduleTitle}
            lessonIndex={lessonIndexInModule}
            totalLessonsInModule={totalLessonsInModule}
            hasNextLesson={hasNextLesson}
            isSavingProgress={isSavingProgress}
            knowledgeSources={knowledgeSources}
            isLeftPanelOpen={isLeftPanelOpen}
            onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
            isRightPanelOpen={isRightPanelOpen}
            onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
            isFocusMode={isFocusMode}
            onToggleFocusMode={handleToggleFocusMode}
            onAskAIWithContext={handleAskAIWithContext}
            onAddNoteFromHighlight={handleAddNoteFromHighlight}
            onMarkComplete={handleMarkCompleteAndNext}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">
            Pilih materi dari silabus di sebelah kiri untuk mulai belajar.
          </div>
        )}
      </div>

      {/* 3. Right Panel (Contextual RAG Copilot & Personal Notes) ~28% width */}
      {!isFocusMode && isRightPanelOpen && (
        <div className="w-80 lg:w-96 shrink-0 h-full transition-all duration-200">
          <NotebookCopilot
            creatorProfileId={creatorProfileId}
            courseId={activeCourseId || courseId}
            activeLessonTitle={activeLesson?.title || 'Materi Kursus'}
            notes={notes}
            onAddNote={handleAddNote}
            onDeleteNote={handleDeleteNote}
            remainingCredits={remainingCredits}
            initialContextQuery={highlightContextForAI}
            onClearInitialContextQuery={() => setHighlightContextForAI(undefined)}
          />
        </div>
      )}

      {/* Completion Toast Notification */}
      {completionToast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl bg-zinc-900 border border-emerald-500/40 text-emerald-300 text-xs shadow-2xl flex items-center gap-2.5 animate-in slide-in-from-bottom-2 duration-200">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="font-medium">{completionToast.message}</span>
        </div>
      )}
    </div>
  );
};
