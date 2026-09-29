const API_BASE = '/api/v1';

class ApiService {
  private token: string | null = null;

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

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
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
      const message = errorData.message || errorData.error || `HTTP error ${response.status}`;
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }

    return response.json();
  }

  // --- AUTH ---
  async login(email: string, password: string) {
    const data = await this.request<{ accessToken: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.accessToken);
    return data;
  }

  async register(payload: any) {
    const data = await this.request<{ accessToken: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

  async createTier(tierData: { name: string; price: number; monthlyCreditQuota: number; description?: string }) {
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
  async uploadDocument(formData: FormData) {
    return this.request<any>('/knowledge-base/upload', {
      method: 'POST',
      body: formData,
    });
  }

  async getDocuments(courseId?: string) {
    const url = courseId ? `/knowledge-base/documents?courseId=${encodeURIComponent(courseId)}` : '/knowledge-base/documents';
    return this.request<any[]>(url);
  }

  async assignDocumentToCourse(documentId: string, courseId: string | null) {
    return this.request<any>(`/knowledge-base/documents/${documentId}/assign-course`, {
      method: 'PATCH',
      body: JSON.stringify({ courseId }),
    });
  }

  async batchAssignDocumentsToCourse(courseId: string, documentIds: string[]) {
    return this.request<any>(`/knowledge-base/courses/${courseId}/assign-documents`, {
      method: 'POST',
      body: JSON.stringify({ documentIds }),
    });
  }

  async getDocumentStatus(id: string) {
    return this.request<any>(`/knowledge-base/documents/${id}/status`);
  }

  // --- CHAT COPILOT ---
  async queryChat(creatorProfileId: string, message: string, chatSessionId?: string, courseId?: string) {
    return this.request<any>('/chat/query', {
      method: 'POST',
      body: JSON.stringify({ creatorProfileId, message, chatSessionId, courseId }),
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

  async updateCreatorBankAccount(bankData: { bankName: string; bankAccountNumber: string; bankAccountHolderName: string }) {
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

  async getMyCourses() {
    return this.request<any[]>('/courses/my-courses');
  }

  async getCourseBySlug(slug: string) {
    return this.request<any>(`/courses/slug/${encodeURIComponent(slug)}`);
  }

  async createCourse(courseData: { title: string; slug: string; description?: string; thumbnailUrl?: string; level?: string }) {
    return this.request<any>('/courses', {
      method: 'POST',
      body: JSON.stringify(courseData),
    });
  }

  async createModule(courseId: string, moduleData: { title: string; description?: string; orderIndex?: number }) {
    return this.request<any>(`/courses/${courseId}/modules`, {
      method: 'POST',
      body: JSON.stringify(moduleData),
    });
  }

  async createLesson(moduleId: string, lessonData: { title: string; type?: string; duration?: string; contentMarkdown?: string; videoUrl?: string; orderIndex?: number }) {
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
    const url = lessonId ? `/notes?lessonId=${encodeURIComponent(lessonId)}` : '/notes';
    return this.request<any[]>(url);
  }

  async createNote(data: { lessonId: string; selectedText?: string; noteText: string }) {
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

  async createDiscussion(data: { lessonId: string; content: string; parentId?: string }) {
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
