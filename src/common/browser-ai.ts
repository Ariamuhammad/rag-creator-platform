export const BROWSER_LLM_MODEL = 'onnx-community/Qwen3-0.6B-ONNX';
export const BROWSER_LITE_LLM_MODEL = 'HuggingFaceTB/SmolLM2-135M-Instruct';
export const BROWSER_EMBEDDING_MODEL =
  'Xenova/paraphrase-multilingual-MiniLM-L12-v2';
export const BROWSER_EMBEDDING_SPACE = `browser:${BROWSER_EMBEDDING_MODEL}:q8:mean:normalized`;
export const BROWSER_EMBEDDING_DIMENSIONS = 384;
export type AiMessage = { role: 'system' | 'user'; content: string };

export interface CourseDraft {
  isPublished?: boolean;
  title: string;
  slug: string;
  description: string;
  level: string;
  modules: {
    title: string;
    description: string;
    lessons: {
      title: string;
      type: string;
      duration: string;
      contentMarkdown: string;
      videoPlacement?: string;
      videoUrl?: string;
    }[];
  }[];
}

export function parseCourseDraft(
  content: string,
  fileName: string,
  targetLevel?: string,
): CourseDraft {
  const draft = JSON.parse(
    content.trim().replace(/^```(?:json)?\s*|\s*```$/g, ''),
  );
  if (
    !draft ||
    typeof draft !== 'object' ||
    Array.isArray(draft) ||
    !Array.isArray(draft.modules) ||
    draft.modules.length === 0 ||
    !draft.modules.every(
      (module: CourseDraft['modules'][number]) =>
        typeof module?.title === 'string' &&
        Array.isArray(module.lessons) &&
        module.lessons.length > 0 &&
        module.lessons.every(
          (lesson) =>
            typeof lesson?.title === 'string' &&
            typeof lesson.contentMarkdown === 'string' &&
            lesson.contentMarkdown.trim(),
        ),
    )
  ) {
    throw new Error(
      'Struktur silabus dari model AI tidak valid. Coba instruksi yang lebih singkat.',
    );
  }
  if (typeof draft.title !== 'string' || !draft.title.trim())
    draft.title = fileName.replace(/\.[^/.]+$/, '');
  if (typeof draft.slug !== 'string' || !draft.slug.trim()) {
    draft.slug = draft.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (!['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(draft.level)) {
    draft.level = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(
      targetLevel || '',
    )
      ? targetLevel
      : 'INTERMEDIATE';
  }
  return draft;
}
