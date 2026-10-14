import { fromMarkdown } from 'mdast-util-from-markdown';
import type { CourseDraft } from '../../../src/common/browser-ai';

export function draftFromMarkdown(
  content: string,
  fileName: string,
  targetLevel?: string,
): CourseDraft {
  if (!content.trim())
    throw new Error('Model tidak menghasilkan materi silabus.');
  let title = fileName.replace(/\.[^/.]+$/, '');
  let introduction = '';
  const modules: CourseDraft['modules'] = [];
  let module: CourseDraft['modules'][number] | undefined;
  let lesson: CourseDraft['modules'][number]['lessons'][number] | undefined;
  const nodes = fromMarkdown(content).children;
  if (nodes.every((node) => node.type === 'heading'))
    throw new Error(
      'Materi lesson dari model kosong. Coba instruksi yang lebih singkat.',
    );
  for (const node of nodes) {
    const text = content.slice(
      node.position!.start.offset,
      node.position!.end.offset,
    );
    if (node.type === 'heading' && node.depth === 1 && !module) {
      title = text.replace(/^#\s+/, '').trim() || title;
    } else if (node.type === 'heading' && node.depth === 2) {
      module = {
        title: text.replace(/^##\s+/, '').trim(),
        description: '',
        lessons: [],
      };
      modules.push(module);
      lesson = undefined;
    } else if (node.type === 'heading' && node.depth === 3) {
      if (!module) {
        module = { title, description: '', lessons: [] };
        modules.push(module);
      }
      lesson = {
        title: text.replace(/^###\s+/, '').trim(),
        type: 'reading',
        duration: '10 min',
        videoPlacement: 'TOP',
        videoUrl: '',
        contentMarkdown: '',
      };
      module.lessons.push(lesson);
    } else if (lesson) {
      lesson.contentMarkdown += text + '\n\n';
    } else if (module) {
      module.description += text + '\n\n';
    } else {
      introduction += text + '\n\n';
    }
  }
  if (!modules.length) modules.push({ title, description: '', lessons: [] });
  for (const section of modules) {
    if (!section.lessons.length)
      section.lessons.push({
        title: section.title,
        type: 'reading',
        duration: '10 min',
        videoPlacement: 'TOP',
        videoUrl: '',
        contentMarkdown: section.description || introduction || content,
      });
    if (section.lessons.some((item) => !item.contentMarkdown.trim()))
      throw new Error(
        'Materi lesson dari model kosong. Coba instruksi yang lebih singkat.',
      );
  }
  return {
    isPublished: false,
    title,
    slug:
      title
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'kursus',
    description: introduction.trim(),
    level: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].includes(targetLevel || '')
      ? targetLevel!
      : 'INTERMEDIATE',
    modules,
  };
}

export function draftFromSource(
  content: string,
  fileName: string,
  targetLevel?: string,
): CourseDraft {
  if (!content.trim()) throw new Error('Teks PDF kosong.');
  const title = fileName.replace(/\.[^/.]+$/, '') || 'Materi PDF';
  const draft = draftFromMarkdown(
    '# ' +
      title +
      '\n\n## Kutipan dokumen\n\n### Materi untuk ditinjau\n\n' +
      content
        .split('\n')
        .map((line) => '> ' + line)
        .join('\n'),
    fileName,
    targetLevel,
  );
  draft.description =
    'Draf berisi cuplikan teks PDF. Tinjau judul, susunan, dan isi sebelum menerbitkan.';
  return draft;
}
