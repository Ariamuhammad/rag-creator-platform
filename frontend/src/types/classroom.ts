export interface Lesson {
  id: string;
  moduleId: string;
  title: string;
  duration: string;
  type: 'video' | 'reading' | 'quiz';
  completed: boolean;
  locked?: boolean;
  videoUrl?: string;
  contentMarkdown?: string;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  lessons: Lesson[];
}

export interface KnowledgeSource {
  id: string;
  title: string;
  type: 'pdf' | 'slides' | 'transcript' | 'doc';
  chunkCount: number;
  fileSize: string;
  status: 'indexed' | 'processing';
  relevanceTag?: string;
}

export interface CitationReference {
  id: string;
  number: number;
  sourceTitle: string;
  snippet: string;
  timestampOrPage: string;
  similarity: number;
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  citations?: CitationReference[];
  tokens?: {
    prompt: number;
    completion: number;
    total: number;
  };
}

export interface PersonalNote {
  id: string;
  lessonId: string;
  lessonTitle: string;
  selectedText?: string;
  noteText: string;
  timestamp: string;
}
