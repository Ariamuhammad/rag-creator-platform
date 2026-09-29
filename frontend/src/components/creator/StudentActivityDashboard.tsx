import React, { useState, useEffect } from 'react';
import {
  Users,
  GraduationCap,
  Zap,
  CheckCircle2,
  Search,
  RefreshCw,
  MessageSquare,
  Clock,
  Sparkles,
  ChevronRight,
  TrendingUp,
  ExternalLink,
} from 'lucide-react';
import { api } from '../../services/api';

interface StudentCourseProgress {
  courseId: string;
  courseTitle: string;
  slug: string;
  completedCount: number;
  totalLessons: number;
  percentage: number;
  lastActiveAt: string | null;
}

interface StudentRosterItem {
  studentId: string;
  fullName: string;
  email: string;
  tierName: string;
  remainingCredits: number;
  subscriptionStatus: string;
  enrolledAt: string;
  courses: StudentCourseProgress[];
  overallProgress: number;
}

interface RecentActivity {
  id: string;
  studentName?: string;
  studentEmail?: string;
  authorName?: string;
  lessonTitle?: string;
  courseTitle?: string;
  question?: string;
  content?: string;
  totalTokens?: number;
  timestamp: string;
  activityType: 'LESSON_COMPLETED' | 'AI_QUERY' | 'DISCUSSION';
}

interface AnalyticsData {
  kpis: {
    totalStudents: number;
    totalCompletedLessons: number;
    totalTokensConsumed: number;
    averageCompletionRate: number;
    totalCourses: number;
  };
  students: StudentRosterItem[];
  recentCompletions: RecentActivity[];
  recentAiQueries: RecentActivity[];
  recentDiscussions: RecentActivity[];
  courses: Array<{ id: string; title: string; slug: string; level: string }>;
}

interface StudentActivityDashboardProps {
  onNavigateToCourse?: (courseSlug: string) => void;
  onPreviewClassroom?: () => void;
}

export const StudentActivityDashboard: React.FC<StudentActivityDashboardProps> = ({
  onNavigateToCourse,
  onPreviewClassroom,
}) => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'ACTIVITIES' | 'AI_TOPICS' | 'DISCUSSIONS'>('ROSTER');
  const [selectedStudent, setSelectedStudent] = useState<StudentRosterItem | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      const res = await api.getStudentActivityAnalytics().catch(() => null);
      if (res && res.kpis) {
        setData(res);
      }
    } catch (err) {
      console.warn('Error loading student activity analytics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStudents = (data?.students || []).filter((s) => {
    const matchesSearch =
      s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.email.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedCourseFilter === 'ALL') return true;
    return s.courses.some((c) => c.courseId === selectedCourseFilter);
  });

  const allActivities: RecentActivity[] = [
    ...(data?.recentCompletions || []),
    ...(data?.recentAiQueries || []),
    ...(data?.recentDiscussions || []),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="w-full max-w-7xl mx-auto p-4 sm:p-6 md:p-8 space-y-6 animate-in fade-in duration-200">
      {/* 1. Header with Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <TrendingUp className="w-3.5 h-3.5" />
              Creator Analytics &amp; Student Activity
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
            Aktivitas &amp; Progres Belajar Murid
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            Pantau kemajuan silabus, konsumsi token AI Copilot, dan keaktifan murid di kelas Anda secara real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={loadAnalytics}
            disabled={isLoading}
            className="px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 font-medium transition flex items-center gap-1.5 shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Segarkan Data</span>
          </button>

          {onPreviewClassroom && (
            <button
              type="button"
              onClick={onPreviewClassroom}
              className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition flex items-center gap-1.5 shadow-sm"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Preview Classroom</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Overview KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Students */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Total Murid Terdaftar</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono">
              {isLoading ? '...' : data?.kpis.totalStudents ?? 0}
            </div>
            <p className="text-[11px] text-emerald-400/90 mt-1 flex items-center gap-1">
              <span>●</span> Murid aktif berlangganan kelas
            </p>
          </div>
        </div>

        {/* Card 2: Average Completion Rate */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Rata-Rata Progres Silabus</span>
            <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center">
              <GraduationCap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono">
              {isLoading ? '...' : `${data?.kpis.averageCompletionRate ?? 0}%`}
            </div>
            <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${data?.kpis.averageCompletionRate ?? 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Card 3: Lessons Completed */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Materi Terselesaikan</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono">
              {isLoading ? '...' : data?.kpis.totalCompletedLessons ?? 0}
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">Total centang modul oleh siswa</p>
          </div>
        </div>

        {/* Card 4: AI Copilot Tokens */}
        <div className="p-4 sm:p-5 rounded-2xl bg-zinc-900/80 border border-zinc-800/80 relative overflow-hidden shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-400">Konsumsi Token AI Mentor</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-extrabold text-zinc-100 font-mono">
              {isLoading
                ? '...'
                : (data?.kpis.totalTokensConsumed ?? 0) > 1000
                ? `${((data?.kpis.totalTokensConsumed ?? 0) / 1000).toFixed(1)}k`
                : data?.kpis.totalTokensConsumed ?? 0}
            </div>
            <p className="text-[11px] text-indigo-400/90 mt-1">Interaksi RAG privat murid</p>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex items-center bg-zinc-900 p-1 rounded-xl border border-zinc-800 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('ROSTER')}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
              activeTab === 'ROSTER'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-emerald-400" />
            <span>Daftar Murid &amp; Silabus ({data?.students?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ACTIVITIES')}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
              activeTab === 'ACTIVITIES'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-sky-400" />
            <span>Log Aktivitas Terbaru</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('AI_TOPICS')}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
              activeTab === 'AI_TOPICS'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Topik AI Copilot ({data?.recentAiQueries?.length ?? 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('DISCUSSIONS')}
            className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 ${
              activeTab === 'DISCUSSIONS'
                ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
            <span>Forum Diskusi ({data?.recentDiscussions?.length ?? 0})</span>
          </button>
        </div>

        {/* Filter Controls (for Roster tab) */}
        {activeTab === 'ROSTER' && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-60">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Cari murid..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <select
              value={selectedCourseFilter}
              onChange={(e) => setSelectedCourseFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500 transition"
            >
              <option value="ALL">Semua Kursus</option>
              {(data?.courses || []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 4. Tab Contents */}

      {/* TAB 1: STUDENT ROSTER */}
      {activeTab === 'ROSTER' && (
        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <div className="p-12 text-center rounded-2xl bg-zinc-900/40 border border-zinc-800/60 space-y-3">
              <div className="w-12 h-12 rounded-xl bg-zinc-800 text-zinc-400 mx-auto flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-zinc-200">Belum Ada Murid yang Terdaftar</h3>
              <p className="text-xs text-zinc-400 max-w-sm mx-auto">
                {searchQuery
                  ? 'Tidak ada murid yang cocok dengan kata kunci pencarian Anda.'
                  : 'Murid yang mendaftar ke kursus atau tier langganan Anda akan otomatis muncul di sini beserta progres belajarnya.'}
              </p>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/80 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/60 text-zinc-400 uppercase tracking-wider font-mono text-[10px] border-b border-zinc-800">
                    <tr>
                      <th className="py-3 px-4">Murid</th>
                      <th className="py-3 px-4">Tier Langganan</th>
                      <th className="py-3 px-4">Progres Rata-Rata</th>
                      <th className="py-3 px-4">Sisa Kuota Token</th>
                      <th className="py-3 px-4">Bergabung</th>
                      <th className="py-3 px-4 text-right">Rincian Kursus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {filteredStudents.map((st) => (
                      <tr key={st.studentId} className="hover:bg-zinc-800/40 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                              {st.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-zinc-200">{st.fullName}</div>
                              <div className="text-[11px] text-zinc-500 font-mono">{st.email}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-zinc-800 text-zinc-300 border border-zinc-700/60">
                            {st.tierName}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="w-36 space-y-1">
                            <div className="flex justify-between items-center text-[10px]">
                              <span className="font-mono font-semibold text-zinc-200">
                                {st.overallProgress}% Selesai
                              </span>
                            </div>
                            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  st.overallProgress >= 100
                                    ? 'bg-emerald-500'
                                    : st.overallProgress > 0
                                    ? 'bg-indigo-500'
                                    : 'bg-zinc-700'
                                }`}
                                style={{ width: `${st.overallProgress}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1 font-mono text-zinc-300">
                            <Zap className="w-3.5 h-3.5 text-amber-400" />
                            <span>{st.remainingCredits.toLocaleString()}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-zinc-400 font-mono text-[11px]">
                          {new Date(st.enrolledAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedStudent(st)}
                            className="px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[11px] font-medium transition inline-flex items-center gap-1"
                          >
                            <span>Lihat Progres</span>
                            <ChevronRight className="w-3 h-3 text-zinc-400" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: LIVE ACTIVITY TIMELINE */}
      {activeTab === 'ACTIVITIES' && (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <Clock className="w-4 h-4 text-sky-400" />
            <span>Linimasa Aktivitas Pembelajaran Murid</span>
          </h3>

          {allActivities.length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Belum ada aktivitas baru dari murid.</p>
          ) : (
            <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-zinc-800">
              {allActivities.map((act) => (
                <div key={act.id} className="relative group">
                  <div
                    className={`absolute -left-6 top-1 w-4 h-4 rounded-full border-2 border-zinc-950 flex items-center justify-center ${
                      act.activityType === 'LESSON_COMPLETED'
                        ? 'bg-emerald-500 text-white'
                        : act.activityType === 'AI_QUERY'
                        ? 'bg-indigo-500 text-white'
                        : 'bg-amber-500 text-white'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-zinc-800/80 hover:border-zinc-700 transition space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-200">
                          {act.studentName || act.authorName || 'Murid'}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                            act.activityType === 'LESSON_COMPLETED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : act.activityType === 'AI_QUERY'
                              ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {act.activityType === 'LESSON_COMPLETED'
                            ? 'Materi Selesai'
                            : act.activityType === 'AI_QUERY'
                            ? 'Konsultasi AI'
                            : 'Forum Diskusi'}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-500 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    {act.activityType === 'LESSON_COMPLETED' && (
                      <p className="text-xs text-zinc-300">
                        Menyelesaikan materi pelajaran{' '}
                        <strong className="text-emerald-300 font-semibold">{act.lessonTitle}</strong> pada kursus{' '}
                        <span className="text-zinc-400">{act.courseTitle}</span>.
                      </p>
                    )}

                    {act.activityType === 'AI_QUERY' && (
                      <p className="text-xs text-zinc-300">
                        Menanyakan kepada AI Copilot:{' '}
                        <span className="text-indigo-300 italic font-mono">"{act.question}"</span>
                        <span className="text-[10px] text-zinc-500 ml-2 font-mono">({act.totalTokens} token)</span>
                      </p>
                    )}

                    {act.activityType === 'DISCUSSION' && (
                      <p className="text-xs text-zinc-300">
                        Membuat posting diskusi:{' '}
                        <span className="text-amber-300">"{act.content?.slice(0, 100)}..."</span> pada{' '}
                        <span className="text-zinc-400">{act.lessonTitle}</span>.
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AI COPILOT TOPICS INSIGHT */}
      {activeTab === 'AI_TOPICS' && (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Pertanyaan yang Paling Sering Diajukan Murid ke AI Copilot</span>
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Kreator dapat melihat topik-topik materi yang membutuhkan penjelasan lebih mendalam.
              </p>
            </div>
          </div>

          {(data?.recentAiQueries || []).length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Belum ada catatan interaksi tanya jawab murid.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(data?.recentAiQueries || []).map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-indigo-500/40 transition space-y-2"
                >
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-semibold text-zinc-300">{q.studentName}</span>
                    <span className="text-zinc-500 font-mono text-[10px]">
                      {new Date(q.timestamp).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-200 font-medium leading-relaxed bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/50">
                    "{q.question}"
                  </p>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 font-mono">
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-amber-400" />
                      {q.totalTokens} token terpakai
                    </span>
                    <span className="text-emerald-400">Ter-grounding Vektor Kursus</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: DISCUSSIONS FEED */}
      {activeTab === 'DISCUSSIONS' && (
        <div className="rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber-400" />
            <span>Tanya Jawab &amp; Diskusi Terbuka Murid</span>
          </h3>

          {(data?.recentDiscussions || []).length === 0 ? (
            <p className="text-xs text-zinc-500 py-6 text-center">Belum ada thread diskusi aktif.</p>
          ) : (
            <div className="space-y-3">
              {(data?.recentDiscussions || []).map((d) => (
                <div
                  key={d.id}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-amber-500/30 transition space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-zinc-200">{d.authorName}</span>
                      <span className="text-[10px] text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded border border-zinc-800">
                        {d.lessonTitle}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(d.timestamp).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{d.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Student Course Breakdown Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-base font-bold text-zinc-100">{selectedStudent.fullName}</h4>
                <p className="text-xs text-zinc-400 font-mono">{selectedStudent.email}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="text-zinc-500 hover:text-zinc-300 p-1 rounded-lg hover:bg-zinc-800 transition"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800 grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-mono block">Paket Tier</span>
                <span className="font-semibold text-indigo-400">{selectedStudent.tierName}</span>
              </div>
              <div>
                <span className="text-zinc-500 text-[10px] uppercase font-mono block">Sisa Kredit AI</span>
                <span className="font-mono text-amber-400 font-semibold">
                  {selectedStudent.remainingCredits.toLocaleString()} Token
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h5 className="text-xs font-bold text-zinc-300 uppercase tracking-wider font-mono">
                Progres Tiap Kursus
              </h5>
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                {selectedStudent.courses.map((c) => (
                  <div key={c.courseId} className="p-3 rounded-xl bg-zinc-950/60 border border-zinc-800 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-zinc-200">{c.courseTitle}</span>
                      <span className="font-mono text-zinc-400 font-semibold">
                        {c.completedCount} / {c.totalLessons} materi ({c.percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          c.percentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'
                        }`}
                        style={{ width: `${c.percentage}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-zinc-500 font-mono">
                      {c.lastActiveAt ? (
                        <span>
                          Aktivitas:{' '}
                          {new Date(c.lastActiveAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      ) : (
                        <span>Belum ada aktivitas</span>
                      )}
                      {onNavigateToCourse && c.slug && (
                        <button
                          type="button"
                          onClick={() => {
                            onNavigateToCourse(c.slug);
                            setSelectedStudent(null);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-sans font-medium transition"
                        >
                          <span>Buka Kursus</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedStudent(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
