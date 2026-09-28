import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  FileText,
  Lock,
  PlayCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Database,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { CourseModule, KnowledgeSource, Lesson } from '../../types/classroom';

interface CurriculumSidebarProps {
  modules: CourseModule[];
  activeLessonId: string;
  onSelectLesson: (lesson: Lesson) => void;
  knowledgeSources: KnowledgeSource[];
  completedCount: number;
  totalCount: number;
}

export const CurriculumSidebar: React.FC<CurriculumSidebarProps> = ({
  modules,
  activeLessonId,
  onSelectLesson,
  knowledgeSources,
  completedCount,
  totalCount,
}) => {
  const [activeTab, setActiveTab] = useState<'CURRICULUM' | 'SOURCES'>('CURRICULUM');
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Auto-expand module containing active lesson or first module by default
  useEffect(() => {
    if (modules.length > 0) {
      const activeParentModule = modules.find((m) =>
        m.lessons.some((l) => l.id === activeLessonId)
      );
      if (activeParentModule) {
        setExpandedModules((prev) => ({
          ...prev,
          [activeParentModule.id]: true,
        }));
      } else if (modules[0]?.id) {
        setExpandedModules((prev) => ({
          ...prev,
          [modules[0].id]: true,
        }));
      }
    }
  }, [activeLessonId, modules]);

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const progressPercentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <aside className="w-full h-full flex flex-col bg-zinc-950 border-r border-zinc-800/80 text-zinc-300 select-none">
      {/* Course Header & Progress Bar */}
      <div className="p-4 border-b border-zinc-800/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-zinc-800 text-zinc-300">
              <BookOpen className="w-4 h-4" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Silabus Kursus
            </span>
          </div>
          <span className="text-xs font-mono font-medium text-emerald-400">
            {progressPercentage}% Selesai
          </span>
        </div>

        {/* Minimal Linear Progress Bar */}
        <div className="space-y-1">
          <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-zinc-500">
            <span>{completedCount} dari {totalCount} materi tuntas</span>
            <span>Target: Minggu Ini</span>
          </div>
        </div>

        {/* Navigation Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('CURRICULUM')}
            className={`py-1.5 rounded-md transition ${
              activeTab === 'CURRICULUM'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Silabus Modul
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('SOURCES')}
            className={`py-1.5 rounded-md transition flex items-center justify-center gap-1.5 ${
              activeTab === 'SOURCES'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Sumber RAG</span>
            <span className="w-4 h-4 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] flex items-center justify-center font-mono">
              {knowledgeSources.length}
            </span>
          </button>
        </div>
      </div>

      {/* Main Tab Content Scroll Area */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900 scrollbar-thin">
        {activeTab === 'CURRICULUM' ? (
          <div className="py-2">
            {modules.map((mod) => {
              const isExpanded = expandedModules[mod.id] ?? false;
              const moduleCompleted = mod.lessons.every((l) => l.completed);

              return (
                <div key={mod.id} className="border-b border-zinc-900 last:border-b-0">
                  {/* Module Title Accordion Header */}
                  <button
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-zinc-900/60 transition group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-zinc-500 group-hover:text-zinc-300 transition">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <span
                        className={`text-xs font-semibold truncate ${
                          moduleCompleted ? 'text-zinc-300' : 'text-zinc-200'
                        }`}
                      >
                        {mod.title}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-zinc-500 shrink-0 ml-2">
                      {mod.lessons.filter((l) => l.completed).length}/{mod.lessons.length}
                    </span>
                  </button>

                  {/* Lessons List in Module */}
                  {isExpanded && (
                    <div className="pb-2 space-y-0.5">
                      {mod.lessons.map((lesson) => {
                        const isActive = lesson.id === activeLessonId;

                        return (
                          <button
                            key={lesson.id}
                            type="button"
                            disabled={lesson.locked}
                            onClick={() => onSelectLesson(lesson)}
                            className={`w-full px-4 py-2.5 flex items-start gap-2.5 text-left text-xs transition relative group ${
                              isActive
                                ? 'bg-zinc-800/90 text-zinc-100 font-medium'
                                : lesson.locked
                                ? 'opacity-40 cursor-not-allowed text-zinc-500'
                                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/40'
                            }`}
                          >
                            {/* Active indicator bar */}
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 rounded-r" />
                            )}

                            {/* Status Icon */}
                            <span className="shrink-0 mt-0.5">
                              {lesson.locked ? (
                                <Lock className="w-3.5 h-3.5 text-zinc-600" />
                              ) : lesson.completed ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              ) : isActive ? (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-indigo-400 flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                                </div>
                              ) : (
                                <Circle className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400" />
                              )}
                            </span>

                            {/* Lesson Title & Type Duration */}
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 leading-relaxed">{lesson.title}</p>
                              <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 font-mono">
                                <span className="flex items-center gap-1">
                                  {lesson.type === 'video' ? (
                                    <PlayCircle className="w-3 h-3 text-zinc-400" />
                                  ) : lesson.type === 'reading' ? (
                                    <FileText className="w-3 h-3 text-zinc-400" />
                                  ) : (
                                    <HelpCircle className="w-3 h-3 text-zinc-400" />
                                  )}
                                  <span>{lesson.duration}</span>
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* TAB 2: KNOWLEDGE SOURCES (NOTEBOOKLM INSPIRED) */
          <div className="p-4 space-y-4">
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-800/80 text-xs text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-zinc-200">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>RAG Knowledge Grounding</span>
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                File materi ini telah diindeks ke dalam PostgreSQL pgvector. AI Mentor hanya
                mengambil jawaban dari sumber-sumber ini.
              </p>
            </div>

            <div className="space-y-2.5">
              {knowledgeSources.map((source) => (
                <div
                  key={source.id}
                  className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1.5 rounded bg-zinc-800 text-zinc-300 shrink-0">
                        {source.type === 'pdf' ? (
                          <FileText className="w-4 h-4 text-red-400" />
                        ) : source.type === 'slides' ? (
                          <FileText className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Database className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>
                      <span className="text-xs font-medium text-zinc-200 truncate" title={source.title}>
                        {source.title}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                    <span>{source.chunkCount} Vector Chunks</span>
                    <span className="flex items-center gap-1 text-emerald-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Indexed &amp; Active
                    </span>
                  </div>

                  {source.relevanceTag && (
                    <div className="text-[10px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 inline-block font-sans">
                      🏷️ {source.relevanceTag}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-950/90 text-[11px] text-zinc-500 flex items-center justify-between">
        <span className="truncate">EduRAG Platform • v1.0</span>
        <span className="flex items-center gap-1 text-indigo-400 hover:text-indigo-300 cursor-pointer">
          <span>Docs</span>
          <ExternalLink className="w-3 h-3" />
        </span>
      </div>
    </aside>
  );
};
