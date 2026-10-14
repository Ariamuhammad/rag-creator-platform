import { expect, test } from 'bun:test';
import { draftFromMarkdown } from '../frontend/src/services/course-draft';

test('browser Markdown becomes a valid course while preserving code blocks and lesson boundaries', () => {
  const draft = draftFromMarkdown(
    '# Pencarian RAG\n\nDeskripsi kursus.\n\n## Fondasi\n\n### Embedding\n\nTeks menjadi vektor.\n\n```text\n## this is code, not a module\n```\n\n### Cosine\n\nMengukur kemiripan vektor.',
    'materi.pdf',
    'BEGINNER',
  );
  expect(draft.slug).toBe('pencarian-rag');
  expect(draft.level).toBe('BEGINNER');
  expect(draft.description).toBe('Deskripsi kursus.');
  expect(draft.modules).toHaveLength(1);
  expect(draft.modules[0].lessons).toHaveLength(2);
  expect(draft.modules[0].lessons[0].contentMarkdown).toContain(
    '## this is code, not a module',
  );
});

test('plain model text gets a complete draft and empty content is rejected', () => {
  const draft = draftFromMarkdown(
    'Embedding mengubah teks menjadi vektor.',
    'materi.pdf',
  );
  expect(draft.title).toBe('materi');
  expect(draft.modules[0].lessons[0].contentMarkdown).toContain('Embedding');
  expect(() => draftFromMarkdown('', 'materi.pdf')).toThrow(
    'Model tidak menghasilkan materi',
  );
  expect(() => draftFromMarkdown('# Judul\n\n## Modul', 'materi.pdf')).toThrow(
    'Materi lesson dari model kosong',
  );
});
