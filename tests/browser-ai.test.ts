import { afterEach, expect, mock, test } from 'bun:test';
import { JwtService } from '@nestjs/jwt';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AiService } from '../src/modules/ai/ai.service';
import {
  BROWSER_EMBEDDING_SPACE,
  parseCourseDraft,
} from '../src/common/browser-ai';
import {
  QueryChatDto,
  CompleteChatDto,
} from '../src/modules/chat/dto/query-chat.dto';
import { BrowserEmbeddingsDto } from '../src/modules/knowledge-base/dto/browser-embeddings.dto';

mock.module('../src/prisma/db', () => ({ db: {} }));
mock.module('pdf-parse', () => ({
  default: async () => ({ text: 'Materi RAG yang diverifikasi.' }),
}));
const { RagEngineService } =
  await import('../src/modules/rag-engine/rag-engine.service');
const { CoursesService } =
  await import('../src/modules/courses/courses.service');
const { IngestionProcessor } = await import('../src/jobs/ingestion.processor');
const { KnowledgeBaseService } =
  await import('../src/modules/knowledge-base/knowledge-base.service');
const { ChatService } = await import('../src/modules/chat/chat.service');
const originalEnv = { ...process.env };
const originalFetch = globalThis.fetch;
afterEach(() => {
  process.env = { ...originalEnv };
  globalThis.fetch = originalFetch;
});

function browserAi() {
  delete process.env.AI_EXECUTION;
  return new AiService();
}

test('browser is the default and server inference cannot contact any provider', async () => {
  process.env.LLM_PROVIDER = 'unused-legacy-provider';
  process.env.EMBEDDING_PROVIDER = 'unused-legacy-provider';
  const ai = browserAi();
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    throw new Error('must not fetch');
  }) as typeof fetch;
  expect(ai.browser).toBe(true);
  await expect(ai.embed('materi')).rejects.toThrow(
    'Inferensi server dinonaktifkan',
  );
  await expect(
    ai.generate([{ role: 'user', content: 'pertanyaan' }]),
  ).rejects.toThrow('Inferensi server dinonaktifkan');
  expect(calls).toBe(0);
});

test('browser retrieval uses client vectors and returns grounded prompts without running a server model', async () => {
  const ai = browserAi();
  const prisma = {
    searchSimilarChunks: async (...args: any[]) => {
      expect(args).toEqual([
        'creator',
        [1, 0],
        5,
        0.05,
        'course',
        'pertanyaan',
        BROWSER_EMBEDDING_SPACE,
      ]);
      return [
        {
          documentId: 'doc',
          content: 'Materi resmi',
          metadata: {},
          similarity: 0.9,
        },
      ];
    },
  };
  const context = await new RagEngineService(prisma as any, ai).prepareRagQuery(
    'creator',
    'pertanyaan',
    'Guru',
    'course',
    [1, 0],
  );
  expect(context.messages[1].content).toContain('Materi resmi');
  expect(context.sources).toHaveLength(1);
});

test('browser PDF generation extracts text and returns prompts instead of calling an LLM', async () => {
  const result = await new CoursesService(
    {} as any,
    browserAi(),
  ).generateSyllabusFromPdf(Buffer.from('pdf'), 'materi.pdf');
  expect(result.execution).toBe('browser');
  expect(result.messages?.[1].content).toContain('Materi RAG');
  expect(result.courseDraft).toBeUndefined();
});

test('PDF fallback signatures bind the prompt to its creator and expire', async () => {
  const jwt = new JwtService({ secret: 'test-secret-for-signed-pdf-context' });
  const ai = browserAi();
  let calls = 0;
  ai.generateFallback = async (messages) => {
    calls++;
    expect(messages[1].content).toContain('Materi');
    return {
      content: 'PDF answer',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  };
  const service = new CoursesService({} as any, ai, jwt);
  const context = await service.generateSyllabusFromPdf(
    Buffer.from('pdf'),
    'materi.pdf',
    undefined,
    undefined,
    'creator',
  );
  expect(context.fallbackToken).toBeString();
  await expect(
    service.fallbackSyllabus('stranger', context.fallbackToken!),
  ).rejects.toThrow('tidak dapat diakses');
  await expect(
    service.fallbackSyllabus('creator', context.fallbackToken! + 'tampered'),
  ).rejects.toThrow('tidak valid');
  const expired = jwt.sign(
    { purpose: 'pdf-server-fallback', userId: 'creator', messages: [] },
    { expiresIn: -1 },
  );
  await expect(service.fallbackSyllabus('creator', expired)).rejects.toThrow(
    'kedaluwarsa',
  );
  expect(
    (await service.fallbackSyllabus('creator', context.fallbackToken!)).content,
  ).toBe('PDF answer');
  expect(calls).toBe(1);
});

test('course drafts remain private and publishing requires explicit review', async () => {
  const service = new CoursesService(
    {
      course: {
        findUnique: async () => ({
          isPublished: false,
          creatorProfile: { userId: 'creator' },
        }),
      },
    } as any,
    browserAi(),
  );
  await expect(service.getCourseBySlug('draft', 'student')).rejects.toThrow(
    'not published',
  );
  await expect(service.getCourseBySlug('draft')).rejects.toThrow(
    'not published',
  );
  await expect(
    service.createFullCourse('creator', {
      title: 'Course',
      slug: 'course',
      isPublished: true,
    }),
  ).rejects.toThrow('Tinjau materi');
});

test('browser ingestion stores text only and waits for creator device embeddings', async () => {
  const statuses: string[] = [];
  const prisma = {
    document: { update: async ({ data }: any) => statuses.push(data.status) },
    $executeRawUnsafe: async (...args: any[]) => {
      expect(args[8]).toBeNull();
      expect(JSON.parse(args[7]).embeddingSpace).toBeUndefined();
    },
  };
  const result = await new IngestionProcessor(
    prisma as any,
    browserAi(),
  ).process({
    data: {
      documentId: 'doc',
      creatorProfileId: 'creator',
      fileType: 'TXT',
      fileName: 'materi.txt',
      fileBufferBase64: Buffer.from('Materi RAG').toString('base64'),
    },
  } as any);
  expect(statuses).toEqual(['PROCESSING', 'PENDING']);
  expect(result.status).toBe('AWAITING_BROWSER_EMBEDDINGS');
});

test('browser DTOs reject invalid vector dimensions, non-finite data and forged usage fields', async () => {
  const id = '123e4567-e89b-12d3-a456-426614174000';
  const valid = plainToInstance(QueryChatDto, {
    creatorProfileId: id,
    message: 'RAG',
    embedding: new Array(384).fill(0.1),
  });
  expect(await validate(valid)).toHaveLength(0);
  valid.embedding = [NaN];
  expect((await validate(valid)).length).toBeGreaterThan(0);
  const completion = plainToInstance(CompleteChatDto, {
    requestMessageId: id,
    answer: 'jawaban',
    promptTokens: 0,
  });
  expect(
    (
      await validate(completion, {
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    ).length,
  ).toBeGreaterThan(0);
  const batch = plainToInstance(BrowserEmbeddingsDto, {
    chunks: [{ id, embedding: [Infinity] }],
  });
  expect((await validate(batch)).length).toBeGreaterThan(0);
});

test('only document owners can read chunks or write embeddings; all batch IDs are checked before writes', async () => {
  let writes = 0;
  const prisma = {
    document: {
      findUnique: async () => ({
        creatorProfileId: 'owner',
        status: 'PENDING',
      }),
    },
    $queryRawUnsafe: async () => [{ id: 'owned', content: 'materi' }],
    $executeRawUnsafe: async () => {
      writes++;
    },
  };
  const kb = new KnowledgeBaseService(prisma as any, {} as any);
  await expect(kb.getBrowserChunks('doc', 'stranger')).rejects.toThrow(
    'access denied',
  );
  await expect(
    kb.saveBrowserEmbeddings('doc', 'owner', {
      chunks: [
        { id: 'owned', embedding: new Array(384).fill(0.1) },
        { id: 'foreign', embedding: new Array(384).fill(0.1) },
      ],
    }),
  ).rejects.toThrow('Chunk access denied');
  await expect(
    kb.saveBrowserEmbeddings('doc', 'owner', {
      chunks: [{ id: 'owned', embedding: new Array(384).fill(0) }],
    }),
  ).rejects.toThrow('Embedding tidak valid');
  expect(writes).toBe(0);
});

test('browser embeddings are padded, scoped, marked and complete only after the final batch', async () => {
  let completed = false;
  const prisma = {
    document: {
      findUnique: async () => ({
        creatorProfileId: 'owner',
        status: 'PENDING',
      }),
      update: async ({ data }: any) => {
        completed = data.status === 'COMPLETED';
      },
    },
    $queryRawUnsafe: async (sql: string) =>
      sql.includes('SELECT id, content') ? [] : [{ id: 'chunk' }],
    $executeRawUnsafe: async (
      _: string,
      vector: string,
      space: string,
      id: string,
      doc: string,
      creator: string,
    ) => {
      expect(JSON.parse(vector)).toHaveLength(1536);
      expect([space, id, doc, creator]).toEqual([
        BROWSER_EMBEDDING_SPACE,
        'chunk',
        'doc',
        'owner',
      ]);
    },
  };
  const result = await new KnowledgeBaseService(
    prisma as any,
    {} as any,
  ).saveBrowserEmbeddings('doc', 'owner', {
    chunks: [{ id: 'chunk', embedding: new Array(384).fill(0.1) }],
  });
  expect(result.completed).toBe(true);
  expect(completed).toBe(true);
});

function chatFixture() {
  const messages = new Map<string, any>();
  let charged = 0;
  let credits = 5000;
  const prisma = {
    creatorProfile: {
      findUnique: async () => ({ id: 'creator', displayName: 'Guru' }),
    },
    course: {
      findUnique: async ({ where }: any) => ({
        id: where.id,
        creatorProfileId: where.id === 'foreign' ? 'other' : 'creator',
      }),
    },
    chatSession: {
      findUnique: async () => ({
        id: 'session',
        studentId: 'student',
        creatorProfileId: 'creator',
      }),
      create: async () => ({ id: 'session' }),
    },
    chatMessage: {
      findUnique: async ({ where }: any) => messages.get(where.id),
      create: async ({ data }: any) => {
        const record = {
          id:
            data.id || (data.sender === 'USER' ? 'question' : 'server-answer'),
          ...data,
        };
        if (messages.has(record.id)) throw new Error('duplicate primary key');
        messages.set(record.id, record);
        return record;
      },
      update: async ({ where, data }: any) => {
        Object.assign(messages.get(where.id), data);
        return messages.get(where.id);
      },
    },
    $transaction: async (fn: any) => fn(prisma),
  };
  const billing = {
    validateCreditAvailability: async () => ({ remainingCredits: credits }),
    deductTokens: async (
      _student: string,
      _creator: string,
      _session: string,
      prompt: number,
      completion: number,
      tx: unknown,
    ) => {
      expect(tx).toBe(prisma);
      charged++;
      credits -= prompt + completion;
      return {
        creditsDeducted: prompt + completion,
        remainingCredits: credits,
      };
    },
  };
  const rag = {
    prepareRagQuery: async () => ({
      messages: [{ role: 'user', content: 'trusted prompt' }],
      sources: [{ documentId: 'doc', content: 'Jawaban lokal' }],
    }),
    executeRagQuery: async () => {
      throw new Error('must not run on server');
    },
  };
  const ai = browserAi();
  const chat = new ChatService(prisma as any, rag as any, billing as any, ai);
  return { chat, ai, rag, messages, charges: () => charged };
}

test('primary server mode also saves the answer and ledger in the same transaction', async () => {
  const { chat, ai, rag, charges } = chatFixture();
  Object.defineProperty(ai, 'browser', { value: false });
  rag.executeRagQuery = async () =>
    ({
      answer: 'Jawaban lokal',
      sources: [],
      usage: { promptTokens: 4, completionTokens: 4, totalTokens: 8 },
    }) as never;
  const result = await chat.handleChatQuery('student', {
    creatorProfileId: 'creator',
    message: 'RAG',
  });
  expect(result.credits.deducted).toBe(8);
  expect(charges()).toBe(1);
});

test('browser chat enforces course and session ownership before releasing context', async () => {
  const { chat } = chatFixture();
  await expect(
    chat.handleChatQuery('student', {
      creatorProfileId: 'creator',
      message: 'RAG',
      courseId: 'foreign',
    }),
  ).rejects.toThrow('access denied');
  await expect(
    chat.handleChatQuery('stranger', {
      creatorProfileId: 'creator',
      message: 'RAG',
      sessionId: 'session',
    }),
  ).rejects.toThrow('access denied');
});

test('browser completion saves once, computes quota on the server, and rejects other students', async () => {
  const { chat, messages, charges } = chatFixture();
  const context = await chat.handleChatQuery('student', {
    creatorProfileId: 'creator',
    message: 'RAG',
  });
  expect(context.execution).toBe('browser');
  await expect(
    chat.completeBrowserQuery('stranger', {
      requestMessageId: 'question',
      answer: 'forged',
    }),
  ).rejects.toThrow('access denied');
  const result = await chat.completeBrowserQuery('student', {
    requestMessageId: 'question',
    answer: 'Jawaban lokal',
  });
  expect(result.usage).toEqual({
    promptTokens: 4,
    completionTokens: 4,
    totalTokens: 8,
  });
  const replay = await chat.completeBrowserQuery('student', {
    requestMessageId: 'question',
    answer: 'changed',
  });
  expect(replay.answer).toBe('Jawaban lokal');
  expect(replay.credits.deducted).toBe(0);
  expect(messages.size).toBe(2);
  expect(charges()).toBe(1);
});

test('server fallback uses stored prompts, rejects strangers and deduplicates simultaneous inference', async () => {
  const { chat, ai, charges } = chatFixture();
  await chat.handleChatQuery('student', {
    creatorProfileId: 'creator',
    message: 'RAG',
  });
  let calls = 0;
  ai.generateFallback = async (prompt) => {
    calls++;
    expect(prompt).toEqual([{ role: 'user', content: 'trusted prompt' }]);
    await new Promise((resolve) => setTimeout(resolve, 5));
    return {
      content: 'Jawaban lokal',
      usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 },
    };
  };
  await expect(
    chat.fallbackBrowserQuery('stranger', 'question'),
  ).rejects.toThrow('access denied');
  const results = await Promise.all([
    chat.fallbackBrowserQuery('student', 'question'),
    chat.fallbackBrowserQuery('student', 'question'),
  ]);
  expect(results[0].messageId).toBe(results[1].messageId);
  await chat.fallbackBrowserQuery('student', 'question');
  expect(calls).toBe(1);
  expect(charges()).toBe(1);
});

test('unsupported completion returns trusted source quotes without charging', async () => {
  const { chat, charges } = chatFixture();
  await chat.handleChatQuery('student', {
    creatorProfileId: 'creator',
    message: 'RAG',
  });
  const result = await chat.completeBrowserQuery('student', {
    requestMessageId: 'question',
    answer: 'Harga bitcoin akan mencapai 999999 dolar.',
  });
  expect(result.mode).toBe('sources');
  expect(result.answer).toContain('> Jawaban lokal');
  expect(result.answer).not.toContain('bitcoin');
  expect(result.usage.totalTokens).toBe(0);
  expect(charges()).toBe(0);
});

test('optional server syllabus JSON accepts code fences but rejects invalid lesson structure', () => {
  const json =
    '{"modules":[{"title":"Modul","lessons":[{"title":"RAG","contentMarkdown":"Materi"}]}]}';
  expect(
    parseCourseDraft('```json\n' + json + '\n```', 'materi.pdf').slug,
  ).toBe('materi');
  expect(() => parseCourseDraft('{"modules":[]}', 'materi.pdf')).toThrow(
    'Struktur silabus',
  );
});
