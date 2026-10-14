import { Injectable, ServiceUnavailableException } from '@nestjs/common';

type Provider = 'ollama' | 'openai';

@Injectable()
export class AiService {
  readonly browser = process.env.AI_EXECUTION !== 'server';
  readonly llmProvider = this.provider(
    this.browser ? undefined : process.env.LLM_PROVIDER,
  );
  readonly embeddingProvider = this.provider(
    this.browser ? undefined : process.env.EMBEDDING_PROVIDER,
  );
  readonly llmModel =
    this.llmProvider === 'ollama'
      ? process.env.OLLAMA_LLM_MODEL || 'qwen3:1.7b'
      : process.env.LLM_MODEL ||
        (process.env.OPENAI_BASE_URL?.includes('groq.com') ||
        process.env.GROQ_API_KEY
          ? 'openai/gpt-oss-20b'
          : 'gpt-4o-mini');
  readonly embeddingModel =
    this.embeddingProvider === 'ollama'
      ? process.env.OLLAMA_EMBEDDING_MODEL || 'embeddinggemma'
      : process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  readonly embeddingSpace = `${this.embeddingProvider}:${this.embeddingModel}`;
  readonly fallbackProvider = this.provider(
    process.env.SERVER_FALLBACK_PROVIDER,
  );
  readonly fallbackModel =
    process.env.SERVER_FALLBACK_MODEL ||
    (this.fallbackProvider === 'ollama'
      ? process.env.OLLAMA_LLM_MODEL || 'qwen3:1.7b'
      : process.env.LLM_MODEL ||
        (process.env.GROQ_API_KEY ||
        process.env.OPENAI_BASE_URL?.includes('groq.com')
          ? 'openai/gpt-oss-20b'
          : 'gpt-4o-mini'));
  private fallbackQueue = Promise.resolve();
  private readonly ollamaUrl =
    process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  private provider(value?: string): Provider {
    if (!value || value === 'ollama') return 'ollama';
    if (value === 'openai') return 'openai';
    throw new Error(
      `Provider AI tidak dikenal: ${value}. Gunakan ollama atau openai.`,
    );
  }

  private async request(
    provider: Provider,
    path: string,
    body: object,
    embedding = false,
    json = false,
    fallback = false,
    signal?: AbortSignal,
  ) {
    if (this.browser && !fallback) {
      throw new ServiceUnavailableException(
        'AI berjalan di browser pengguna. Inferensi server dinonaktifkan.',
      );
    }
    const apiKey = (
      embedding
        ? [process.env.EMBEDDING_API_KEY, process.env.OPENAI_API_KEY]
        : [process.env.OPENAI_API_KEY, process.env.GROQ_API_KEY]
    ).find((key) => key?.trim() && !key.includes('placeholder'));
    const baseUrl =
      provider === 'ollama'
        ? this.ollamaUrl
        : embedding
          ? process.env.EMBEDDING_BASE_URL || 'https://api.openai.com/v1'
          : process.env.OPENAI_BASE_URL ||
            (process.env.GROQ_API_KEY
              ? 'https://api.groq.com/openai/v1'
              : 'https://api.openai.com/v1');

    if (provider === 'openai' && (!apiKey || apiKey.includes('placeholder'))) {
      throw new ServiceUnavailableException(
        'Provider API memerlukan API key. Gunakan provider ollama untuk AI lokal tanpa token.',
      );
    }

    try {
      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider === 'openai'
            ? { Authorization: `Bearer ${apiKey}` }
            : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.any([
          AbortSignal.timeout(json ? 300_000 : 120_000),
          ...(signal ? [signal] : []),
        ]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      signal?.throwIfAborted();
      const hint =
        provider === 'ollama'
          ? 'Pastikan Ollama aktif dan model sudah diunduh dengan ollama pull.'
          : 'Periksa endpoint, API key, dan nama model provider.';
      throw new ServiceUnavailableException(
        `Layanan AI ${provider} gagal (${error.message}). ${hint}`,
      );
    }
  }

  async generate(
    messages: { role: 'system' | 'user'; content: string }[],
    json = false,
    fallback = false,
    signal?: AbortSignal,
  ) {
    const provider = fallback ? this.fallbackProvider : this.llmProvider;
    const local = provider === 'ollama';
    const response = await this.request(
      provider,
      local ? '/api/chat' : '/chat/completions',
      {
        model: fallback ? this.fallbackModel : this.llmModel,
        messages,
        ...(local
          ? {
              stream: false,
              think: false,
              ...(json ? { format: 'json' } : {}),
              options: {
                temperature: 0.2,
                num_ctx: json ? 16384 : 4096,
                num_predict: json ? 4096 : 1024,
              },
            }
          : {
              temperature: 0.2,
              max_tokens: json ? 8000 : 1024,
              ...(json ? { response_format: { type: 'json_object' } } : {}),
            }),
      },
      false,
      json,
      fallback,
      signal,
    );
    const content = local
      ? response.message?.content
      : response.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new ServiceUnavailableException(
        'Model AI tidak mengembalikan teks.',
      );
    }
    if (
      json &&
      (local ? response.done_reason : response.choices?.[0]?.finish_reason) ===
        'length'
    ) {
      throw new ServiceUnavailableException(
        'Silabus melebihi batas output model. Minta silabus yang lebih singkat.',
      );
    }
    const promptTokens =
      (local ? response.prompt_eval_count : response.usage?.prompt_tokens) ??
      Math.ceil(
        messages.reduce((sum, message) => sum + message.content.length, 0) / 4,
      );
    const completionTokens =
      (local ? response.eval_count : response.usage?.completion_tokens) ??
      Math.ceil(content.length / 4);
    return {
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  generateFallback(
    messages: { role: 'system' | 'user'; content: string }[],
    signal?: AbortSignal,
  ) {
    // One active fallback keeps model memory bounded when several browsers fail together.
    const job = this.fallbackQueue.then(() => {
      signal?.throwIfAborted();
      return this.generate(messages, false, true, signal);
    });
    this.fallbackQueue = job.then(
      () => {},
      () => {},
    );
    return job;
  }

  async embed(text: string, document = false): Promise<number[]> {
    const local = this.embeddingProvider === 'ollama';
    // EmbeddingGemma uses distinct retrieval prompts for documents and questions.
    const input =
      local && this.embeddingModel.split(':')[0] === 'embeddinggemma'
        ? document
          ? `title: none | text: ${text}`
          : `task: search result | query: ${text}`
        : text;
    const response = await this.request(
      this.embeddingProvider,
      local ? '/api/embed' : '/embeddings',
      {
        model: this.embeddingModel,
        input,
        ...(local ? { truncate: false } : {}),
      },
      true,
    );
    const vector = local
      ? response.embeddings?.[0]
      : response.data?.[0]?.embedding;
    if (
      !Array.isArray(vector) ||
      vector.length === 0 ||
      vector.length > 1536 ||
      !vector.every(
        (value) => typeof value === 'number' && Number.isFinite(value),
      ) ||
      !vector.some((value) => value !== 0)
    ) {
      throw new ServiceUnavailableException(
        'Embedding tidak valid; gunakan model dengan maksimal 1536 dimensi.',
      );
    }
    // Zero padding preserves cosine similarity and the existing vector(1536) schema.
    return vector.concat(new Array(1536 - vector.length).fill(0));
  }
}
