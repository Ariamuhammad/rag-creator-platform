import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  BookmarkCheck,
  MessageSquare,
  GraduationCap,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { api } from '../../services/api';

interface EnrolledCourse {
  courseId: string;
  courseTitle: string;
  slug: string;
  description?: string;
  thumbnailUrl?: string;
  level: string;
  creator: {
    id: string;
    displayName: string;
    slug: string;
  };
  subscription: {
    tierName: string;
    remainingCredits: number;
    expiresAt?: string;
  };
  curriculumProgress: {
    completedCount: number;
    totalLessons: number;
    percentage: number;
  };
}

interface MasterSyllabusViewProps {
  onEnterClassroom: (courseSlug?: string) => void;
  onExploreCourses: () => void;
}

export const MasterSyllabusView: React.FC<MasterSyllabusViewProps> = ({
  onEnterClassroom,
  onExploreCourses,
}) => {
  const [activeTab, setActiveTab] = useState<'COURSES' | 'NOTES' | 'DISCUSSIONS'>('COURSES');
  const [enrolledCourses, setEnrolledCourses] = useState<EnrolledCourse[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [discussions, setDiscussions] = useState<any[]>([]);

  useEffect(() => {
    fetchEnrolledData();
  }, []);

  const fetchEnrolledData = async () => {
    setIsLoading(true);
    try {
      const res = await api.getEnrolledCourses().catch(() => []);
      setEnrolledCourses(Array.isArray(res) ? res : []);

      const notesRes = await api.getNotes().catch(() => []);
      setNotes(Array.isArray(notesRes) ? notesRes : []);

      if (res && res.length > 0) {
        const slug = res[0].slug;
        const courseDetail = await api.getCourseBySlug(slug).catch(() => null);
        const firstLessonId = courseDetail?.modules?.[0]?.lessons?.[0]?.id;
        if (firstLessonId) {
          const discRes = await api.getDiscussions(firstLessonId).catch(() => []);
          setDiscussions(Array.isArray(discRes) ? discRes : []);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const totalCompleted = enrolledCourses.reduce((acc, c) => acc + c.curriculumProgress.completedCount, 0);
  const totalLessons = enrolledCourses.reduce((acc, c) => acc + c.curriculumProgress.totalLessons, 0);
  const overallPercentage = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  return (
    <div className="w-full max-w-7xl mx-auto p-6 md:p-8 space-y-8 animate-in fade-in duration-200">
      {/* 1. Header & Overview KPIs */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <GraduationCap className="w-3.5 h-3.5" />
              Student Learning Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Master Silabus &amp; Kursus Terdaftar
          </h1>
          <p className="text-zinc-400 text-sm mt-1 max-w-2xl">
            Akses kurikulum seluruh kreator terdaftar, pantau progres materi dan sisa token AI, serta review catatan intisari Anda.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExploreCourses}
            className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium transition"
          >
            Jelajahi Silabus Lain
          </button>
          <button
            type="button"
            onClick={() => onEnterClassroom()}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
          >
            <span>Lanjutkan Belajar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 2. Linear-Style Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Kursus Aktif</span>
            <BookOpen className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{enrolledCourses.length}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Dari kreator terverifikasi</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Materi Diselesaikan</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {totalCompleted} <span className="text-sm font-normal text-zinc-400">/ {totalLessons}</span>
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">{overallPercentage}% silabus tuntas</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Sisa Token AI RAG</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">
            {enrolledCourses[0]?.subscription.remainingCredits.toLocaleString() || '250.000'}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">Kuota perpanjangan bulanan</p>
        </div>

        <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium">Catatan Pribadi</span>
            <BookmarkCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-zinc-100">{notes.length || 3}</div>
          <p className="text-[11px] text-zinc-500 mt-1">Kutipan tersimpan</p>
        </div>
      </div>

      {/* 3. Sub Tabs (Courses / Notes / Discussions) */}
      <div className="flex gap-2 border-b border-zinc-800 pb-2 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('COURSES')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'COURSES'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Kursus &amp; Silabus ({enrolledCourses.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('NOTES')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'NOTES'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <BookmarkCheck className="w-3.5 h-3.5" />
          <span>Catatan &amp; Rangkuman</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('DISCUSSIONS')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
            activeTab === 'DISCUSSIONS'
              ? 'bg-zinc-800 text-white font-semibold'
              : 'text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Forum Tanya-Jawab</span>
        </button>
      </div>

      {/* 4. Tab Contents */}
      {isLoading ? (
        <div className="w-full flex items-center justify-center gap-2 p-12 text-xs text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Memuat data kurikulum &amp; silabus...</span>
        </div>
      ) : (
        <div className="w-full space-y-4">
          {activeTab === 'COURSES' && (
            <div className="w-full space-y-4">
              {enrolledCourses.map((course) => (
                <div
                  key={course.courseId}
                  className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-5"
                >
                  {/* Creator & Course Title */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-400 font-medium">Edukator:</span>
                        <span className="text-xs font-semibold text-zinc-200">{course.creator.displayName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {course.level}
                        </span>
                      </div>
                      <h3 className="text-lg font-bold text-zinc-100">{course.courseTitle}</h3>
                      <p className="text-xs text-zinc-400 max-w-3xl">{course.description}</p>
                    </div>

                    <div className="shrink-0 flex sm:flex-col items-end gap-1">
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        {course.subscription.tierName}
                      </span>
                      {course.subscription.expiresAt && (
                        <span className="text-[10px] text-zinc-500">
                          Aktif s/d {course.subscription.expiresAt}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar (Linear aesthetic) */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-zinc-400 font-mono">
                      <span>Progres Kelulusan Silabus</span>
                      <span className="text-zinc-200 font-semibold">
                        {course.curriculumProgress.completedCount} / {course.curriculumProgress.totalLessons} Selesai ({course.curriculumProgress.percentage}%)
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
                        style={{ width: `${course.curriculumProgress.percentage}%` }}
                      />
                    </div>
                  </div>

                  {/* Bottom Quick Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800/80">
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                        <span>{course.subscription.remainingCredits.toLocaleString()} Token AI</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Est. 4.5 Jam Materi</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEnterClassroom(course.slug)}
                      className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition shadow-sm"
                    >
                      <span>Masuk ke Ruang Belajar (Classroom)</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'NOTES' && (
            <div className="w-full space-y-4">
              {/* Header Info Banner */}
              <div className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <BookmarkCheck className="w-4 h-4 text-indigo-400" />
                    <span>Catatan &amp; Highlight Intisari Materi</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Koleksi kutipan dan intisari penting yang Anda tandai saat membaca materi di Learning Canvas.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-mono text-zinc-400 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/60">
                    Total {notes.length} Catatan
                  </span>
                </div>
              </div>

              {/* Real Notes List from Database */}
              {notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {note.lesson?.title || 'Materi Kursus'}
                          </span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {note.createdAt ? new Date(note.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : 'Tersimpan'}
                        </span>
                      </div>

                      {note.selectedText && (
                        <blockquote className="p-3.5 rounded-xl bg-zinc-950/80 border border-zinc-800 text-sm italic text-zinc-200 leading-relaxed">
                          &ldquo;{note.selectedText}&rdquo;
                        </blockquote>
                      )}

                      <div className="text-xs text-zinc-300 leading-relaxed bg-zinc-950/60 p-3.5 rounded-xl border border-zinc-800/60">
                        <strong className="text-zinc-100">Catatan Pribadi:</strong> {note.noteText}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Tersinkronisasi dengan Database PostgreSQL</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => onEnterClassroom(enrolledCourses[0]?.slug || 'enterprise-rag-systems')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
                        >
                          <span>Buka di Learning Canvas</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-2">
                  <p className="text-sm font-semibold text-zinc-300">Belum ada catatan yang disimpan.</p>
                  <p className="text-xs text-zinc-500">
                    Buka materi pada Learning Canvas, sorot teks penting, lalu simpan ke catatan pribadi.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'DISCUSSIONS' && (
            <div className="w-full space-y-4">
              {/* Header Info Banner */}
              <div className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/30 border border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-100 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span>Forum Tanya-Jawab &amp; Diskusi Komunitas</span>
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Thread tanya-jawab nyata antara Anda, kreator edukator, dan sesama pembelajar yang tersimpan di PostgreSQL.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEnterClassroom(enrolledCourses[0]?.slug || 'enterprise-rag-systems')}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium flex items-center gap-1.5 transition shadow-sm"
                  >
                    <span>Buka Forum di Classroom</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Real Discussions List from Database */}
              {discussions.length > 0 ? (
                <div className="space-y-4">
                  {discussions.map((disc) => (
                    <div
                      key={disc.id}
                      className="w-full p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 hover:border-zinc-700/80 transition-all space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded text-[10px] font-mono uppercase bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                            {disc.replies && disc.replies.length > 0 ? 'Dijawab Edukator' : 'Menunggu Jawaban'}
                          </span>
                          <span className="text-xs text-zinc-300 font-medium">Penanya: {disc.user?.fullName || disc.user?.email || 'Murid'}</span>
                        </div>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {disc.createdAt ? new Date(disc.createdAt).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-zinc-100">
                          &ldquo;{disc.content}&rdquo;
                        </h4>
                      </div>

                      {disc.replies && disc.replies.map((reply: any) => (
                        <div key={reply.id} className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400">
                            <GraduationCap className="w-4 h-4" />
                            <span>Jawaban dari {reply.user?.fullName || 'Edukator Kursus'}</span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed">
                            {reply.content}
                          </p>
                        </div>
                      ))}

                      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 text-xs text-zinc-400">
                        <span className="text-[11px] text-zinc-500">{disc.replies?.length || 0} Jawaban Edukator</span>
                        <button
                          type="button"
                          onClick={() => onEnterClassroom(enrolledCourses[0]?.slug || 'enterprise-rag-systems')}
                          className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
                        >
                          <span>Buka Diskusi di Classroom</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center rounded-2xl bg-zinc-900/30 border border-zinc-800/80 space-y-2">
                  <p className="text-sm font-semibold text-zinc-300">Belum ada diskusi atau tanya-jawab aktif.</p>
                  <p className="text-xs text-zinc-500">
                    Masuk ke salah satu materi di Classroom untuk mengajukan pertanyaan langsung kepada instruktur.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
