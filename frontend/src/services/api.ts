import { browserAi } from './browser-ai';
import { draftFromMarkdown, draftFromSource } from './course-draft';
import { assessAnswer } from '../../../src/common/grounding';
import type { AiMessage, CourseDraft } from '../../../src/common/browser-ai';

const API_BASE = '/api/v1';

export class ApiService {
  private token: string | null = null;
  private aiConfig?: Promise<{ execution: 'browser' | 'server' }>;

  getAiConfig() {
    return (this.aiConfig ??= this.request<{ execution: 'browser' | 'server' }>(
      '/ai/config',
    )
      .then((config) => {
        browserAi.setExecution(config.execution);
        return config;
      })
      .catch((error) => {
        this.aiConfig = undefined;
        throw error;
      }));
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('rag_token', token);
    } else {
      localStorage.removeItem('rag_token');
    }
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('rag_token');
    }
    return this.token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message =
        errorData.message || errorData.error || `HTTP error ${response.status}`;
      throw Object.assign(
        new Error(Array.isArray(message) ? message.join(', ') : message),
        { status: response.status },
      );
    }

    return response.json();
  }

  // --- AUTH ---
  async login(email: string, password: string) {
    const data = await this.request<{ accessToken: string; user: any }>(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
    );
    this.setToken(data.accessToken);
    return data;
  }

  async register(payload: any) {
    const data = await this.request<{ accessToken: string; user: any }>(
      '/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    );
    this.setToken(data.accessToken);
    return data;
  }

  async getProfile() {
    return this.request<{ user: any }>('/auth/profile');
  }

  // --- CREATOR ---
  async getCreatorBySlug(slug: string) {
    return this.request<any>(`/creators/slug/${slug}`);
  }

  async getCreatorTiers(creatorProfileId: string) {
    return this.request<any[]>(`/creators/${creatorProfileId}/tiers`);
  }

  async createTier(tierData: {
    name: string;
    price: number;
    monthlyCreditQuota: number;
    description?: string;
  }) {
    return this.request<any>('/creators/tiers', {
      method: 'POST',
      body: JSON.stringify(tierData),
    });
  }

  async getCreatorAnalytics() {
    return this.request<any>('/creators/analytics/overview');
  }

  async getStudentActivityAnalytics() {
    return this.request<any>('/creators/analytics/student-activity');
  }

  // --- KNOWLEDGE BASE ---
  async uploadDocument(formData: FormData, signal?: AbortSignal) {
    const result = await this.request<any>('/knowledge-base/upload', {
      method: 'POST',
      body: formData,
      signal,
    });
    if ((await this.getAiConfig()).execution === 'browser') {
      try {
        await this.indexDocument(result.document.id, signal);
        result.document = await this.getDocumentStatus(result.document.id);
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        browserAi.useSources();
        result.notice =
          'Dokumen tersimpan untuk pencarian kata kunci. Indeks di perangkat dapat dilanjutkan nanti.';
        result.document = await this.getDocumentStatus(result.document.id);
      }
    }
    return result;
  }

  async indexDocument(id: string, signal?: AbortSignal) {
    if ((await this.getAiConfig()).execution !== 'browser') return;
    // Resume in small batches; a browser reload does not discard already stored vectors.
    const deadline = Date.now() + 120_000;
    while (true) {
      signal?.throwIfAborted();
      const batch = await this.request<{
        status: string;
        chunks: { id: string; content: string }[];
      }>(`/knowledge-base/documents/${encodeURIComponent(id)}/browser-chunks`, {
        signal,
      });
      if (
        batch.status === 'PROCESSING' ||
        (batch.status === 'PENDING' && batch.chunks.length === 0)
      ) {
        if (Date.now() > deadline)
          throw new Error(
            'Ekstraksi dokumen belum selesai. Gunakan tombol Indeks di perangkat untuk melanjutkan.',
          );
        await new Promise((resolve) => setTimeout(resolve, 1000));
        continue;
      }
      if (batch.chunks.length === 0) return;
      const chunks = [];
      for (const chunk of batch.chunks)
        chunks.push({
          id: chunk.id,
          embedding: await browserAi.embed(chunk.content, signal),
        });
      const result = await this.request<{ completed: boolean }>(
        `/knowledge-base/documents/${encodeURIComponent(id)}/browser-embeddings`,
        { method: 'POST', body: JSON.stringify({ chunks }), signal },
      );
      if (result.completed) return;
    }
  }

  async getDocuments(courseId?: string) {
    const url = courseId
      ? `/knowledge-base/documents?courseId=${encodeURIComponent(courseId)}`
      : '/knowledge-base/documents';
    return this.request<any[]>(url);
  }

  async assignDocumentToCourse(documentId: string, courseId: string | null) {
    return this.request<any>(
      `/knowledge-base/documents/${documentId}/assign-course`,
      {
        method: 'PATCH',
        body: JSON.stringify({ courseId }),
      },
    );
  }

  async batchAssignDocumentsToCourse(courseId: string, documentIds: string[]) {
    return this.request<any>(
      `/knowledge-base/courses/${courseId}/assign-documents`,
      {
        method: 'POST',
        body: JSON.stringify({ documentIds }),
      },
    );
  }

  async getDocumentStatus(id: string) {
    return this.request<any>(`/knowledge-base/documents/${id}/status`);
  }

  // --- CHAT COPILOT ---
  async queryChat(
    creatorProfileId: string,
    message: string,
    chatSessionId?: string,
    courseId?: string,
    signal?: AbortSignal,
  ) {
    const local = (await this.getAiConfig()).execution === 'browser';
    let embedding: number[] | undefined;
    if (local) {
      try {
        embedding = await browserAi.embed(message, signal);
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        browserAi.useSources();
      }
    }
    signal?.throwIfAborted();
    const context = await this.request<any>('/chat/query', {
      method: 'POST',
      signal,
      body: JSON.stringify({
        creatorProfileId,
        message,
        sessionId: chatSessionId,
        courseId,
        embedding,
      }),
    });
    if (context.execution !== 'browser') return context;
    let answer: string | undefined;
    try {
      answer = await browserAi.generate(context.messages, false, signal);
      if (
        context.sources?.length &&
        !assessAnswer(answer, context.sources).supported
      )
        throw new Error('Jawaban perangkat belum didukung sumber.');
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      browserAi.useServer();
      try {
        const result = await this.request<any>('/chat/server-fallback', {
          method: 'POST',
          signal,
          body: JSON.stringify({ requestMessageId: context.requestMessageId }),
        });
        if (result.mode === 'sources') browserAi.useSources();
        else browserAi.useServer(true);
        return result;
      } catch (serverError) {
        if (
          (serverError as Error).name === 'AbortError' ||
          [401, 403].includes(
            (serverError as Error & { status?: number }).status || 0,
          )
        )
          throw serverError;
        browserAi.useSources();
      }
    }
    signal?.throwIfAborted();
    return this.request<any>('/chat/complete', {
      method: 'POST',
      signal,
      body: JSON.stringify({
        requestMessageId: context.requestMessageId,
        answer,
        ...(!answer ? { mode: 'sources' } : {}),
      }),
    });
  }

  async getChatSessions(creatorProfileId: string) {
    return this.request<any[]>(`/chat/sessions/${creatorProfileId}`);
  }

  async getSessionMessages(sessionId: string) {
    return this.request<any[]>(`/chat/sessions/${sessionId}/messages`);
  }

  // --- BILLING & CREATOR WALLET (APPROACH 2) ---
  async createInvoice(creatorProfileId: string, tierId: string) {
    return this.request<any>('/billing/create-invoice', {
      method: 'POST',
      body: JSON.stringify({ creatorProfileId, tierId }),
    });
  }

  async simulateWebhookPaid(externalId: string, amount: number) {
    return this.request<any>('/billing/xendit-webhook', {
      method: 'POST',
      headers: {
        'x-callback-token': 'rag_xendit_webhook_token_secret',
      },
      body: JSON.stringify({
        id: `xendit_${Date.now()}`,
        external_id: externalId,
        status: 'PAID',
        payment_method: 'QRIS',
        amount,
      }),
    });
  }

  async getStudentOrders() {
    return this.request<any[]>('/billing/orders');
  }

  async getStudentBalance(creatorProfileId: string) {
    return this.request<any>(`/billing/balance/${creatorProfileId}`);
  }

  async getCreatorWallet() {
    return this.request<any>('/billing/creator/wallet');
  }

  async updateCreatorBankAccount(bankData: {
    bankName: string;
    bankAccountNumber: string;
    bankAccountHolderName: string;
  }) {
    return this.request<any>('/billing/creator/bank-account', {
      method: 'PATCH',
      body: JSON.stringify(bankData),
    });
  }

  async requestPayout(amount: number, notes?: string) {
    return this.request<any>('/billing/creator/payout-request', {
      method: 'POST',
      body: JSON.stringify({ amount, notes }),
    });
  }

  async getCreatorPayouts() {
    return this.request<any[]>('/billing/creator/payouts');
  }

  // --- COURSES & SYLLABUS ---
  async getCourses() {
    return this.request<any[]>('/courses');
  }

  async createFullCourse(courseData: {
    title: string;
    slug: string;
    description?: string;
    thumbnailUrl?: string;
    level?: string;
    isPublished?: boolean;
    reviewed?: boolean;
    documentIds?: string[];
    modules?: {
      title: string;
      description?: string;
      orderIndex?: number;
      lessons?: {
        title: string;
        type?: string;
        duration?: string;
        contentMarkdown?: string;
        videoUrl?: string;
        orderIndex?: number;
      }[];
    }[];
  }) {
    return this.request<any>('/courses/full', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async generateSyllabusFromPdf(formData: FormData, signal?: AbortSignal) {
    const result = await this.request<{
      execution?: 'browser';
      messages?: AiMessage[];
      sourceFileName: string;
      sourceText?: string;
      courseDraft?: CourseDraft;
      fallbackToken?: string;
    }>('/courses/generate-from-pdf', {
      method: 'POST',
      body: formData,
      signal,
    });
    if (result.execution === 'browser') {
      const level = formData.get('targetLevel') as string | undefined;
      const validateDraft = (content: string) => {
        const draft = draftFromMarkdown(content, result.sourceFileName, level);
        if (
          result.sourceText &&
          draft.modules.some((module) =>
            module.lessons.some(
              (lesson) =>
                !assessAnswer(lesson.contentMarkdown, [
                  { content: result.sourceText! },
                ]).supported,
            ),
          )
        )
          throw new Error('Draf belum didukung kutipan PDF.');
        return draft;
      };
      try {
        let draft: CourseDraft;
        try {
          draft = validateDraft(
            await browserAi.generate(result.messages!, true, signal),
          );
        } catch (localError) {
          if (
            (localError as Error).name === 'AbortError' ||
            !result.fallbackToken
          )
            throw localError;
          browserAi.useServer();
          draft = validateDraft(
            (
              await this.request<{ content: string }>(
                '/courses/generate-from-pdf/server-fallback',
                {
                  method: 'POST',
                  signal,
                  body: JSON.stringify({ token: result.fallbackToken }),
                },
              )
            ).content,
          );
          browserAi.useServer(true);
        }
        return {
          success: true,
          sourceFileName: result.sourceFileName,
          courseDraft: draft,
          mode: 'generated',
        };
      } catch (error) {
        if ((error as Error).name === 'AbortError') throw error;
        if (
          [401, 403].includes(
            (error as Error & { status?: number }).status || 0,
          )
        )
          throw error;
        if (!result.sourceText) throw error;
        browserAi.useSources();
        return {
          success: true,
          sourceFileName: result.sourceFileName,
          courseDraft: draftFromSource(
            result.sourceText,
            result.sourceFileName,
            level,
          ),
          mode: 'sources',
        };
      }
    }
    return result;
  }

  async getMyCourses() {
    return this.request<any[]>('/courses/my-courses');
  }

  async getCourseBySlug(slug: string) {
    return this.request<any>(`/courses/slug/${encodeURIComponent(slug)}`);
  }

  async createCourse(courseData: {
    title: string;
    slug: string;
    description?: string;
    thumbnailUrl?: string;
    level?: string;
  }) {
    return this.request<any>('/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async createModule(
    courseId: string,
    moduleData: { title: string; description?: string; orderIndex?: number },
  ) {
    return this.request<any>(`/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(moduleData),
    });
  }

  async createLesson(
    moduleId: string,
    lessonData: {
      title: string;
      type?: string;
      duration?: string;
      contentMarkdown?: string;
      videoUrl?: string;
      orderIndex?: number;
    },
  ) {
    return this.request<any>(`/courses/modules/${moduleId}/lessons`, {
      method: 'POST',
      body: JSON.stringify(lessonData),
    });
  }

  async updateLessonProgress(lessonId: string, completed: boolean) {
    return this.request<any>(`/courses/lessons/${lessonId}/progress`, {
      method: 'PATCH',
      body: JSON.stringify({ completed }),
    });
  }

  async getEnrolledCourses() {
    return this.request<any[]>('/courses/students/enrolled');
  }

  // --- STUDENT NOTES ---
  async getNotes(lessonId?: string) {
    const url = lessonId
      ? `/notes?lessonId=${encodeURIComponent(lessonId)}`
      : '/notes';
    return this.request<any[]>(url);
  }

  async createNote(data: {
    lessonId: string;
    selectedText?: string;
    noteText: string;
  }) {
    return this.request<any>('/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateNote(noteId: string, noteText: string) {
    return this.request<any>(`/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify({ noteText }),
    });
  }

  async deleteNote(noteId: string) {
    return this.request<any>(`/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  // --- LESSON DISCUSSIONS & Q&A FORUM ---
  async getDiscussions(lessonId: string) {
    return this.request<any[]>(`/discussions/lesson/${lessonId}`);
  }

  async createDiscussion(data: {
    lessonId: string;
    content: string;
    parentId?: string;
  }) {
    return this.request<any>('/discussions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async replyDiscussion(parentId: string, content: string) {
    return this.request<any>(`/discussions/${parentId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteDiscussion(discussionId: string) {
    return this.request<any>(`/discussions/${discussionId}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();
