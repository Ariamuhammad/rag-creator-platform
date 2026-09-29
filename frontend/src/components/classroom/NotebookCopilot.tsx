import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Sparkles,
  Bot,
  User as UserIcon,
  Zap,
  BookmarkCheck,
  Paperclip,
  Trash2,
  FileText,
  CornerDownLeft,
  X,
  Plus,
  Compass,
} from 'lucide-react';
import type { CopilotMessage, PersonalNote } from '../../types/classroom';

interface NotebookCopilotProps {
  creatorProfileId: string;
  courseId?: string;
  activeLessonTitle: string;
  notes: PersonalNote[];
  onAddNote: (note: { noteText: string; selectedText?: string }) => void;
  onDeleteNote: (id: string) => void;
  remainingCredits: number;
  initialContextQuery?: string;
  onClearInitialContextQuery?: () => void;
}

export const NotebookCopilot: React.FC<NotebookCopilotProps> = ({
  creatorProfileId,
  courseId,
  activeLessonTitle,
  notes,
  onAddNote,
  onDeleteNote,
  remainingCredits,
  initialContextQuery,
  onClearInitialContextQuery,
}) => {
  const [activeTab, setActiveTab] = useState<'COPILOT' | 'NOTES'>('COPILOT');
  const [scope, setScope] = useState<'LESSON' | 'COURSE'>('LESSON');
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedContext, setAttachedContext] = useState<string | null>(null);


  // New Note Form State
  const [newNoteInput, setNewNoteInput] = useState('');

  // Initial messages with NotebookLM style citations
  const [messages, setMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-welcome',
      sender: 'assistant',
      content:
        'Halo! Saya **AI Mentor RAG** yang terhubung ke dokumen materi kursus ini. Tanyakan konsep teknis, mintakan analogi, atau minta rangkuman langsung dari materi resmi yang terindeks.',
      timestamp: 'Baru saja',
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // If initialContextQuery passed from text highlight in Canvas, populate input
  useEffect(() => {
    if (initialContextQuery) {
      setAttachedContext(initialContextQuery);
      setInputQuery(`Jelaskan lebih detail bagian materi ini: "${initialContextQuery.slice(0, 80)}..."`);
      setActiveTab('COPILOT');
      onClearInitialContextQuery?.();
    }
  }, [initialContextQuery, onClearInitialContextQuery]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputQuery;
    if (!text.trim() || isLoading) return;

    let fullPrompt = text;
    if (attachedContext) {
      fullPrompt = `Konteks yang saya kutip dari materi:\n"${attachedContext}"\n\nPertanyaan: ${text}`;
    }

    const userMessage: CopilotMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuery('');
    setAttachedContext(null);
    setIsLoading(true);

    try {
      // Connect to real NestJS RAG API
      const res = await fetch('/api/v1/chat/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('rag_token')}`,
        },
        body: JSON.stringify({
          creatorProfileId,
          message: fullPrompt,
          courseId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Gagal menghubungi AI Mentor');
      }

      const assistantMessage: CopilotMessage = {
        id: `asst_${Date.now()}`,
        sender: 'assistant',
        content: data.answer || 'Tidak ada respons.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tokens: data.tokens,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      const errMsg: CopilotMessage = {
        id: `asst_err_${Date.now()}`,
        sender: 'assistant',
        content: `⚠️ Gagal memproses pertanyaan RAG: ${err.message || 'Koneksi ke backend bermasalah'}. Pastikan layanan AI dan database aktif.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddNewNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoteInput.trim()) return;

    onAddNote({ noteText: newNoteInput });
    setNewNoteInput('');
  };

  return (
    <aside className="relative w-full h-full flex flex-col bg-zinc-950 border-l border-zinc-800/80 text-zinc-200 select-none">
      {/* 1. Header with Tabs & Scope Selector */}
      <div className="p-3.5 border-b border-zinc-800/80 bg-zinc-950 space-y-2.5">
        {/* Switchable Tabs: AI Mentor vs Notes */}
        <div className="grid grid-cols-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('COPILOT')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'COPILOT'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-400" />
            <span>AI Mentor</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('NOTES')}
            className={`py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
              activeTab === 'NOTES'
                ? 'bg-zinc-800 text-zinc-100 shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <BookmarkCheck className="w-3.5 h-3.5 text-amber-400" />
            <span>Catatan Saya ({notes.length})</span>
          </button>
        </div>

        {/* Scope Pill Selector (NotebookLM Context Indicator) */}
        {activeTab === 'COPILOT' && (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-zinc-900/70 border border-zinc-800 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <Compass className="w-3 h-3 text-indigo-400 shrink-0" />
              <span className="text-zinc-400 shrink-0">Konteks RAG:</span>
              <span className="font-semibold text-zinc-200 truncate">
                {scope === 'LESSON' ? 'Bab 3 (Materi Ini)' : 'Seluruh Kursus'}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setScope(scope === 'LESSON' ? 'COURSE' : 'LESSON')}
              className="text-[10px] text-indigo-400 hover:text-indigo-300 font-medium shrink-0 ml-2"
            >
              Ubah
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Tab Body */}
      {activeTab === 'COPILOT' ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Messages Stream Scroll Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5" />
                  </div>
                )}

                <div className={`max-w-[88%] space-y-2 ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Bubble Container */}
                  <div
                    className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 font-sans'
                        : 'bg-zinc-900/95 text-zinc-200 border border-zinc-800/80 shadow-sm font-sans'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : (
                      <div className="prose prose-invert prose-xs max-w-none space-y-2 [&_p]:leading-relaxed [&_strong]:text-indigo-300 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-1">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>

                  {/* Token Consumption */}
                  {msg.tokens && (
                    <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono">
                      <Zap className="w-3 h-3 text-emerald-400" />
                      <span>{msg.tokens.total} token</span>
                    </div>
                  )}
                </div>

                {msg.sender === 'user' && (
                  <div className="w-6 h-6 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center shrink-0 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-2.5 items-center text-xs text-indigo-400 animate-pulse">
                <div className="w-6 h-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5" />
                </div>
                <span>Mencari di pgvector &amp; merumuskan jawaban...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 border-t border-zinc-800/80 bg-zinc-950 flex gap-1.5 overflow-x-auto scrollbar-none">
            {[
              'Jelaskan analogi sederhana',
              'Buat kuis latihan 3 soal',
              'Rangkum poin kunci materi',
            ].map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendMessage(chip)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] text-zinc-300 font-medium transition"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Context Tag if Highlight was attached */}
          {attachedContext && (
            <div className="mx-3 my-1.5 p-2 rounded-lg bg-indigo-950/40 border border-indigo-500/30 flex items-center justify-between text-[11px] text-indigo-300">
              <div className="flex items-center gap-1.5 truncate">
                <FileText className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">Kutipan: "{attachedContext}"</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedContext(null)}
                className="text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Bottom Chat Input Form */}
          <div className="p-3 border-t border-zinc-800/80 bg-zinc-950 space-y-1.5">
            <div className="relative flex items-end rounded-xl bg-zinc-900 border border-zinc-800 focus-within:border-indigo-500 transition">
              <textarea
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={2}
                placeholder="Tanyakan ke AI Mentor... (Cmd + Enter)"
                className="w-full px-3 py-2.5 bg-transparent text-zinc-100 text-xs outline-none resize-none placeholder:text-zinc-500"
              />

              <div className="flex items-center gap-1 p-2">
                <button
                  type="button"
                  onClick={() => setAttachedContext(activeLessonTitle)}
                  title="Lampirkan konteks judul materi"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => handleSendMessage()}
                  disabled={isLoading || !inputQuery.trim()}
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 transition cursor-pointer"
                >
                  <CornerDownLeft className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-zinc-500 px-1 font-mono">
              <span>Sisa: {remainingCredits.toLocaleString()} Token</span>
              <span>Model: Llama 3 / GPT-4o</span>
            </div>
          </div>
        </div>
      ) : (
        /* TAB 2: MY PERSONAL NOTES */
        <div className="flex-1 flex flex-col min-h-0 p-4 space-y-4 overflow-y-auto scrollbar-thin">
          {/* Quick Note Input */}
          <form onSubmit={handleAddNewNote} className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span className="font-semibold text-zinc-200">Tambah Catatan Pelajaran</span>
              <span className="text-[10px] font-mono text-zinc-500">{activeLessonTitle.slice(0, 20)}...</span>
            </div>
            <div className="relative">
              <textarea
                value={newNoteInput}
                onChange={(e) => setNewNoteInput(e.target.value)}
                rows={3}
                placeholder="Tulis ringkasan atau insight pribadi..."
                className="w-full px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 focus:border-indigo-500 text-zinc-200 text-xs outline-none resize-none"
              />
              <button
                type="submit"
                disabled={!newNoteInput.trim()}
                className="absolute right-2 bottom-2 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-medium disabled:opacity-40 transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Simpan</span>
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="space-y-3">
            <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-500 block">
              Daftar Catatan Tersimpan ({notes.length}):
            </span>

            {notes.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                Belum ada catatan. Anda dapat mem-blok teks di modul bacaan lalu klik <strong>"Simpan ke Catatan"</strong>.
              </div>
            ) : (
              notes.map((note) => (
                <div
                  key={note.id}
                  className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition space-y-2"
                >
                  <div className="flex justify-between items-start text-[11px]">
                    <span className="font-semibold text-indigo-400 font-mono truncate max-w-[180px]">
                      {note.lessonTitle}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteNote(note.id)}
                      className="text-zinc-500 hover:text-red-400 p-0.5 transition"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {note.selectedText && (
                    <blockquote className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-300 italic">
                      &ldquo;{note.selectedText.slice(0, 120)}...&rdquo;
                    </blockquote>
                  )}

                  <p className="text-xs text-zinc-200 whitespace-pre-wrap">{note.noteText}</p>

                  <div className="flex justify-between items-center text-[10px] text-zinc-500 pt-1 font-mono">
                    <span>{note.timestamp}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setInputQuery(`Bantu kembangkan catatan saya ini: "${note.noteText}"`);
                        setActiveTab('COPILOT');
                      }}
                      className="text-indigo-400 hover:text-indigo-300 font-sans"
                    >
                      Tanyakan ke AI &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
