import { afterEach, expect, mock, test } from 'bun:test';
import { AiService } from '../src/modules/ai/ai.service';

mock.module('../src/prisma/db', () => ({ db: {} }));
mock.module('pdf-parse', () => ({
  default: async () => ({
    text: 'Materi kursus tentang RAG dan pencarian semantik.',
  }),
}));
const { RagEngineService } =
  await import('../src/modules/rag-engine/rag-engine.service');
const { IngestionProcessor } = await import('../src/jobs/ingestion.processor');
const { PrismaService } = await import('../src/modules/prisma/prisma.service');
const { CoursesService } =
  await import('../src/modules/courses/courses.service');

const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
const messages = [{ role: 'user' as const, content: 'Jelaskan RAG' }];

afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

function localAi() {
  process.env.AI_EXECUTION = 'server';
  for (const key of [
    'LLM_PROVIDER',
    'EMBEDDING_PROVIDER',
    'OLLAMA_BASE_URL',
    'OLLAMA_LLM_MODEL',
    'OLLAMA_EMBEDDING_MODEL',
  ]) {
    delete process.env[key];
  }
  return new AiService();
}

function reply(
  body: object,
  inspect?: (url: string, init: RequestInit) => void,
) {
  globalThis.fetch = (async (url, init) => {
    inspect?.(String(url), init!);
    return Response.json(body);
  }) as typeof fetch;
}

test('local is the default even when legacy API credentials and models exist', async () => {
  process.env.OPENAI_API_KEY = 'old-key';
  process.env.OPENAI_BASE_URL = 'https://api.groq.com/openai/v1';
  process.env.LLM_MODEL = 'old-cloud-model';
  process.env.EMBEDDING_MODEL = 'text-embedding-3-small';
  const ai = localAi();
  expect(ai.embeddingModel).toBe('embeddinggemma');
  reply(
    {
      message: { content: 'Jawaban lokal' },
      prompt_eval_count: 12,
      eval_count: 8,
    },
    (url, init) => {
      expect(url).toBe('http://localhost:11434/api/chat');
      expect(init.headers).not.toHaveProperty('Authorization');
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: 'qwen3:1.7b',
        stream: false,
        think: false,
      });
    },
  );
  expect(await ai.generate(messages)).toEqual({
    content: 'Jawaban lokal',
    usage: { promptTokens: 12, completionTokens: 8, totalTokens: 20 },
  });
});

test('browser fallback alone can reach a server model without keys, and queue cancellation skips inference', async () => {
  delete process.env.AI_EXECUTION;
  delete process.env.SERVER_FALLBACK_PROVIDER;
  const ai = new AiService();
  let calls = 0;
  reply({ message: { content: 'server answer' } }, (_, init) => {
    calls++;
    expect(init.headers).not.toHaveProperty('Authorization');
  });
  expect((await ai.generateFallback(messages)).content).toBe('server answer');
  const controller = new AbortController();
  controller.abort();
  await expect(
    ai.generateFallback(messages, controller.signal),
  ).rejects.toHaveProperty('name', 'AbortError');
  expect(calls).toBe(1);
});

test('syllabus requests JSON and rejects truncated output', async () => {
  const ai = localAi();
  reply(
    { message: { content: '{"title":"Kursus"}' }, done_reason: 'stop' },
    (_, init) => {
      expect(JSON.parse(init.body as string)).toMatchObject({
        format: 'json',
        options: { num_ctx: 16384 },
      });
    },
  );
  expect(JSON.parse((await ai.generate(messages, true)).content).title).toBe(
    'Kursus',
  );
  reply({ message: { content: '{"title":' }, done_reason: 'length' });
  await expect(ai.generate(messages, true)).rejects.toThrow('batas output');
});

test('semantic vectors are padded without changing their values; query and document prompts differ', async () => {
  const ai = localAi();
  const inputs: string[] = [];
  reply({ embeddings: [[0.6, 0.8]] }, (url, init) => {
    expect(url).toEndWith('/api/embed');
    const body = JSON.parse(init.body as string);
    expect(body.truncate).toBe(false);
    inputs.push(body.input);
  });
  const vector = await ai.embed('materi', true);
  expect(vector).toHaveLength(1536);
  expect(vector.slice(0, 3)).toEqual([0.6, 0.8, 0]);
  expect(vector.reduce((sum, value) => sum + value * value, 0)).toBe(1);
  await ai.embed('pertanyaan');
  expect(inputs).toEqual([
    'title: none | text: materi',
    'task: search result | query: pertanyaan',
  ]);
});

test('invalid or oversized embeddings are rejected instead of replaced with fake vectors', async () => {
  const ai = localAi();
  for (const vector of [[], [0, 0], ['bad'], [null], new Array(1537).fill(1)]) {
    reply({ embeddings: [vector] });
    await expect(ai.embed('materi')).rejects.toThrow('Embedding tidak valid');
  }
});

test('local failure has actionable error and never retries against a paid provider', async () => {
  const ai = localAi();
  let calls = 0;
  globalThis.fetch = (async (url) => {
    calls++;
    expect(String(url)).toStartWith('http://localhost:11434');
    return Response.json({ error: 'model not found' }, { status: 404 });
  }) as typeof fetch;
  await expect(ai.generate(messages)).rejects.toThrow('ollama pull');
  expect(calls).toBe(1);
});

test('OpenAI-compatible chat requires opt in and a key, embedding can remain local', async () => {
  localAi();
  process.env.LLM_PROVIDER = 'openai';
  delete process.env.OPENAI_API_KEY;
  delete process.env.GROQ_API_KEY;
  const ai = new AiService();
  await expect(ai.generate(messages)).rejects.toThrow('API key');
  process.env.OPENAI_API_KEY = 'test-key';
  process.env.OPENAI_BASE_URL = 'https://example.test/v1/';
  reply(
    {
      choices: [{ message: { content: 'API answer' } }],
      usage: { prompt_tokens: 0, completion_tokens: 3 },
    },
    (url, init) => {
      expect(url).toBe('https://example.test/v1/chat/completions');
      expect(init.headers).toHaveProperty('Authorization', 'Bearer test-key');
    },
  );
  expect((await ai.generate(messages)).usage).toEqual({
    promptTokens: 0,
    completionTokens: 3,
    totalTokens: 3,
  });
  expect(ai.embeddingProvider).toBe('ollama');
});

test('API embeddings use their own endpoint and key', async () => {
  localAi();
  process.env.EMBEDDING_PROVIDER = 'openai';
  process.env.EMBEDDING_BASE_URL = 'https://embedding.test/v1';
  process.env.EMBEDDING_API_KEY = 'embedding-key';
  reply({ data: [{ embedding: new Array(1536).fill(0.1) }] }, (url, init) => {
    expect(url).toBe('https://embedding.test/v1/embeddings');
    expect(init.headers).toHaveProperty(
      'Authorization',
      'Bearer embedding-key',
    );
  });
  expect(await new AiService().embed('materi')).toHaveLength(1536);
});

test('a legacy placeholder never shadows the configured Groq token', async () => {
  process.env.AI_EXECUTION = 'browser';
  process.env.SERVER_FALLBACK_PROVIDER = 'openai';
  process.env.OPENAI_API_KEY = 'old-placeholder';
  process.env.GROQ_API_KEY = 'valid-groq-test-key';
  delete process.env.OPENAI_BASE_URL;
  reply({ choices: [{ message: { content: 'answer' } }] }, (url, init) => {
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(init.headers).toHaveProperty(
      'Authorization',
      'Bearer valid-groq-test-key',
    );
  });
  expect((await new AiService().generateFallback(messages)).content).toBe(
    'answer',
  );
});

test('unknown providers and empty generation are rejected', async () => {
  process.env.AI_EXECUTION = 'server';
  process.env.LLM_PROVIDER = 'typo';
  expect(() => new AiService()).toThrow('Provider AI tidak dikenal');
  const ai = localAi();
  reply({ message: { content: '' } });
  await expect(ai.generate(messages)).rejects.toThrow(
    'tidak mengembalikan teks',
  );
});

test('RAG falls back to keyword retrieval with the tenant, course, and embedding model intact', async () => {
  const ai = localAi();
  ai.embed = async () => {
    throw new Error('offline');
  };
  const usage = { promptTokens: 4, completionTokens: 2, totalTokens: 6 };
  ai.generate = async (prompt) => {
    expect(prompt[1].content).toContain('Materi resmi');
    return { content: 'Jawaban', usage };
  };
  const prisma = {
    searchSimilarChunks: async (...args: any[]) => {
      expect(args).toEqual([
        'tenant',
        null,
        5,
        0.05,
        'course',
        'RAG',
        'ollama:embeddinggemma',
      ]);
      return [
        {
          documentId: 'doc',
          content: 'Materi resmi',
          metadata: {},
          similarity: 0.35,
        },
      ];
    },
  };
  const response = await new RagEngineService(
    prisma as any,
    ai,
  ).executeRagQuery('tenant', 'RAG', 'Guru', 'course');
  expect(response.answer).toBe('Jawaban');
  expect(response.usage).toEqual(usage);
});

test('RAG does not generate or charge tokens when no material is found', async () => {
  const ai = localAi();
  ai.embed = async () => [1];
  ai.generate = async () => {
    throw new Error('Must not generate');
  };
  const prisma = { searchSimilarChunks: async () => [] };
  const response = await new RagEngineService(
    prisma as any,
    ai,
  ).executeRagQuery('tenant', 'RAG');
  expect(response.sources).toEqual([]);
  expect(response.usage.totalTokens).toBe(0);
});

test('retrieval SQL compares only compatible embeddings and hides failed documents', async () => {
  const prisma = Object.create(PrismaService.prototype);
  prisma.getConnection = async () => ({
    driver: {
      query: async function* (query: any) {
        expect(query.sql).toContain("dc.metadata->>'embeddingSpace' = $6");
        expect(query.sql).toContain("d.status = 'COMPLETED'");
        expect(query.sql).toContain('dc."creatorProfileId" = $2');
        expect(query.sql).toContain('d."courseId" = $5');
        expect(query.params).toEqual([
          null,
          'tenant',
          0.05,
          5,
          'course',
          'ollama:embeddinggemma',
        ]);
      },
    },
  });
  expect(
    await prisma.searchSimilarChunks(
      'tenant',
      null,
      5,
      0.05,
      'course',
      'RAG',
      'ollama:embeddinggemma',
    ),
  ).toEqual([]);
});

test('ingestion writes semantic embeddings with a model marker and marks provider failures FAILED', async () => {
  const ai = localAi();
  const statuses: string[] = [];
  let inserts = 0;
  const prisma = {
    document: {
      update: async ({ data }: any) => {
        statuses.push(data.status);
      },
    },
    $executeRawUnsafe: async (...args: any[]) => {
      inserts++;
      expect(JSON.parse(args[7]).embeddingSpace).toBe('ollama:embeddinggemma');
      expect(args[8]).toBe('[0.6,0.8]');
    },
  };
  ai.embed = async (_, document) => {
    expect(document).toBe(true);
    return [0.6, 0.8];
  };
  const job = {
    data: {
      documentId: 'doc',
      creatorProfileId: 'tenant',
      fileType: 'TXT',
      fileName: 'materi.txt',
      fileBufferBase64: Buffer.from('Materi RAG').toString('base64'),
    },
  };
  const worker = new IngestionProcessor(prisma as any, ai);
  await worker.process(job as any);
  expect(statuses).toEqual(['PROCESSING', 'COMPLETED']);
  ai.embed = async () => {
    throw new Error('offline');
  };
  await expect(worker.process(job as any)).rejects.toThrow('offline');
  expect(statuses.slice(-2)).toEqual(['PROCESSING', 'FAILED']);
  expect(inserts).toBe(1);
});

test('PDF syllabus uses the shared provider and rejects malformed lesson data', async () => {
  const ai = localAi();
  const courses = new CoursesService({} as any, ai);
  const draft = {
    modules: [
      {
        title: 'Modul',
        lessons: [{ title: 'RAG', contentMarkdown: 'Materi RAG' }],
      },
    ],
  };
  ai.generate = async (prompt, json) => {
    expect(json).toBe(true);
    expect(prompt[1].content).toContain('Materi kursus');
    return {
      content: JSON.stringify(draft),
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  };
  const response = await courses.generateSyllabusFromPdf(
    Buffer.from('pdf'),
    'materi.pdf',
  );
  expect(response.courseDraft.title).toBe('materi');
  expect(response.courseDraft.slug).toBe('materi');
  draft.modules[0].lessons = [];
  await expect(
    courses.generateSyllabusFromPdf(Buffer.from('pdf'), 'materi.pdf'),
  ).rejects.toThrow('Struktur silabus');
});
