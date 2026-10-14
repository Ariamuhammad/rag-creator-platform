import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { AiService } from '../src/modules/ai/ai.service';

const originalEnv = { ...process.env };
const messages = [
  { role: 'user' as const, content: 'Reply with the two words: server ready' },
];
const ai = new AiService();
const result = await ai.generateFallback(messages);
assert(result.content.trim().length > 0 && result.usage.totalTokens > 0);
console.log(
  `Configured fallback ${ai.fallbackProvider}/${ai.fallbackModel}: real inference OK (${result.usage.totalTokens} tokens).`,
);

// The authenticated gateway forwards to real Ollama; it verifies transport, not a commercial provider account.
if (ai.fallbackProvider === 'ollama') {
  const key = randomUUID();
  const gateway = Bun.serve({
    port: 0,
    async fetch(req) {
      if (req.headers.get('authorization') !== `Bearer ${key}`)
        return new Response('Unauthorized', { status: 401 });
      return fetch(
        `${process.env.OLLAMA_BASE_URL || 'http://localhost:11434'}/v1/chat/completions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: await req.text(),
        },
      );
    },
  });
  try {
    process.env.SERVER_FALLBACK_PROVIDER = 'openai';
    process.env.SERVER_FALLBACK_MODEL = ai.fallbackModel;
    process.env.OPENAI_BASE_URL = `http://127.0.0.1:${gateway.port}/v1`;
    process.env.OPENAI_API_KEY = 'invalid-test-key';
    await assert.rejects(
      new AiService().generateFallback(messages),
      /HTTP 401/,
    );
    process.env.OPENAI_API_KEY = key;
    const tokenResult = await new AiService().generateFallback(messages);
    assert(tokenResult.content.trim() && tokenResult.usage.totalTokens > 0);
    console.log(
      'OpenAI-compatible API: invalid token rejected; valid token reached real model inference.',
    );
  } finally {
    gateway.stop(true);
    process.env = originalEnv;
  }
  process.env.AI_EXECUTION = 'server';
  process.env.EMBEDDING_PROVIDER = 'ollama';
  const vector = await new AiService().embed('RAG retrieves course documents.');
  assert(
    vector.length === 1536 &&
      vector.every(Number.isFinite) &&
      vector.some((value) => value !== 0),
  );
  console.log('Server embedding: real vector OK (1536 padded dimensions).');
}
console.log(
  'Commercial provider credentials are verified only when that provider is configured and the first real inference above succeeds.',
);
