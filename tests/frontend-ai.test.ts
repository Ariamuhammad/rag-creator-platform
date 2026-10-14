import { afterAll, afterEach, expect, test } from 'bun:test';
import { ApiService } from '../frontend/src/services/api';
import { browserAi } from '../frontend/src/services/browser-ai';

const originalFetch = globalThis.fetch;
const originalEmbed = browserAi.embed;
const originalGenerate = browserAi.generate;
const originalStorage = globalThis.localStorage;
globalThis.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
} as unknown as Storage;
afterEach(() => {
  globalThis.fetch = originalFetch;
  browserAi.embed = originalEmbed;
  browserAi.generate = originalGenerate;
});

function respond(handler: (url: string, body: any) => object) {
  globalThis.fetch = (async (url, init) =>
    Response.json(
      handler(
        String(url),
        typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body,
      ),
    )) as typeof fetch;
}

test('frontend chat embeds and generates in the browser then submits only answer and request ID', async () => {
  const calls: string[] = [];
  browserAi.embed = async (message) => {
    expect(message).toBe('RAG');
    return new Array(384).fill(0.1);
  };
  browserAi.generate = async (messages) => {
    expect(messages[0].content).toBe('trusted context');
    return 'Local answer';
  };
  respond((url, body) => {
    calls.push(url);
    if (url.endsWith('/ai/config')) return { execution: 'browser' };
    if (url.endsWith('/chat/query')) {
      expect(body.sessionId).toBe('session');
      expect(body.embedding).toHaveLength(384);
      return {
        execution: 'browser',
        requestMessageId: 'question',
        messages: [{ role: 'user', content: 'trusted context' }],
      };
    }
    expect(body).toEqual({
      requestMessageId: 'question',
      answer: 'Local answer',
    });
    return { answer: body.answer };
  });
  expect(
    (await new ApiService().queryChat('creator', 'RAG', 'session', 'course'))
      .answer,
  ).toBe('Local answer');
  expect(calls).toEqual([
    '/api/v1/ai/config',
    '/api/v1/chat/query',
    '/api/v1/chat/complete',
  ]);
});

test('explicit server mode skips browser inference', async () => {
  browserAi.embed = async () => {
    throw new Error('must not embed');
  };
  browserAi.generate = async () => {
    throw new Error('must not generate');
  };
  respond((url) =>
    url.endsWith('/ai/config')
      ? { execution: 'server' }
      : { answer: 'Server answer' },
  );
  expect((await new ApiService().queryChat('creator', 'RAG')).answer).toBe(
    'Server answer',
  );
});

test('PDF drafting turns device Markdown into a validated course', async () => {
  browserAi.generate = async (_, draft) => {
    expect(draft).toBe(true);
    return '# materi\n\n## Modul\n\n### RAG\n\nMateri';
  };
  respond(() => ({
    execution: 'browser',
    sourceFileName: 'materi.pdf',
    messages: [{ role: 'user', content: 'materi' }],
  }));
  const result = await new ApiService().generateSyllabusFromPdf(new FormData());
  expect(result.courseDraft?.slug).toBe('materi');
  browserAi.generate = async () => '';
  await expect(
    new ApiService().generateSyllabusFromPdf(new FormData()),
  ).rejects.toThrow('Model tidak menghasilkan materi');
});

test('upload indexes creator chunks in the browser and returns the actual completed document', async () => {
  browserAi.embed = async (text) => {
    expect(text).toBe('materi');
    return new Array(384).fill(0.1);
  };
  const form = new FormData();
  let stored = false;
  respond((url, body) => {
    if (url.endsWith('/upload')) {
      expect(body).toBe(form);
      return { document: { id: 'doc', status: 'PENDING' } };
    }
    if (url.endsWith('/ai/config')) return { execution: 'browser' };
    if (url.endsWith('/browser-chunks'))
      return {
        status: 'PENDING',
        chunks: [{ id: 'chunk', content: 'materi' }],
      };
    if (url.endsWith('/browser-embeddings')) {
      expect(body.chunks[0].id).toBe('chunk');
      expect(body.chunks[0].embedding).toHaveLength(384);
      stored = true;
      return { completed: true };
    }
    expect(stored).toBe(true);
    return { id: 'doc', status: 'COMPLETED' };
  });
  expect((await new ApiService().uploadDocument(form)).document).toEqual({
    id: 'doc',
    status: 'COMPLETED',
  });
});

test('failed device indexing leaves an actionable resume message for the saved document', async () => {
  browserAi.embed = async () => {
    throw new Error('model offline');
  };
  respond((url) => {
    if (url.endsWith('/upload')) return { document: { id: 'doc' } };
    if (url.endsWith('/ai/config')) return { execution: 'browser' };
    if (url.endsWith('/status')) return { id: 'doc', status: 'PENDING' };
    return { status: 'PENDING', chunks: [{ id: 'chunk', content: 'materi' }] };
  });
  const result = await new ApiService().uploadDocument(new FormData());
  expect(result.document.id).toBe('doc');
  expect(result.notice).toContain('Dokumen tersimpan');
});

test('device failure seamlessly calls server; unavailable server returns trusted quotes', async () => {
  browserAi.embed = async () => {
    throw new Error('device memory');
  };
  browserAi.generate = async () => {
    throw new Error('all local profiles failed');
  };
  let offline = false;
  const calls: string[] = [];
  globalThis.fetch = (async (url, init) => {
    const path = String(url);
    calls.push(path);
    if (path.endsWith('/ai/config'))
      return Response.json({ execution: 'browser' });
    if (path.endsWith('/chat/query'))
      return Response.json({
        execution: 'browser',
        requestMessageId: 'question',
        messages: [],
      });
    if (path.endsWith('/server-fallback')) {
      expect(JSON.parse(init!.body as string)).toEqual({
        requestMessageId: 'question',
      });
      return offline
        ? Response.json({ message: 'offline' }, { status: 503 })
        : Response.json({ answer: 'Server answer' });
    }
    expect(JSON.parse(init!.body as string)).toEqual({
      requestMessageId: 'question',
      mode: 'sources',
    });
    return Response.json({ answer: 'Source quote' });
  }) as typeof fetch;
  expect((await new ApiService().queryChat('creator', 'RAG')).answer).toBe(
    'Server answer',
  );
  expect(calls.some((path) => path.endsWith('/complete'))).toBe(false);
  offline = true;
  expect((await new ApiService().queryChat('creator', 'RAG')).answer).toBe(
    'Source quote',
  );
});

test('PDF device failure uses signed server context and still produces an unpublished draft', async () => {
  browserAi.generate = async () => {
    throw new Error('device failed');
  };
  respond((url, body) => {
    if (url.endsWith('/server-fallback')) {
      expect(body).toEqual({ token: 'signed-context' });
      return {
        content: '# RAG\n## Materi\n### Pencarian\nRAG mengambil dokumen.',
      };
    }
    return {
      execution: 'browser',
      sourceFileName: 'materi.pdf',
      sourceText: 'RAG mengambil dokumen.',
      messages: [],
      fallbackToken: 'signed-context',
    };
  });
  const result = await new ApiService().generateSyllabusFromPdf(new FormData());
  expect(result.mode).toBe('generated');
  expect(result.courseDraft?.isPublished).toBe(false);
});

test('unsupported device answers try the server before using source-only output', async () => {
  browserAi.embed = async () => new Array(384).fill(0.1);
  browserAi.generate = async () => 'Harga bitcoin mencapai 999 dolar.';
  let fallback = false;
  respond((url) => {
    if (url.endsWith('/ai/config')) return { execution: 'browser' };
    if (url.endsWith('/chat/query'))
      return {
        execution: 'browser',
        requestMessageId: 'question',
        messages: [],
        sources: [{ content: 'RAG mengambil dokumen.' }],
      };
    expect(url).toEndWith('/server-fallback');
    fallback = true;
    return { answer: 'RAG mengambil dokumen.' };
  });
  expect((await new ApiService().queryChat('creator', 'RAG')).answer).toBe(
    'RAG mengambil dokumen.',
  );
  expect(fallback).toBe(true);
});

// Bun has no page storage; restore the test fixture after this file finishes.
afterAll(() => {
  globalThis.localStorage = originalStorage;
});
