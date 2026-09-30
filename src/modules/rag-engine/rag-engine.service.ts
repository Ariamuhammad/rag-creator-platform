import { Injectable, Logger } from '@nestjs/common';
import { PrismaService, VectorSearchResult } from '../prisma/prisma.service';
import { OpenAIEmbeddings, ChatOpenAI } from '@langchain/openai';

export interface RagResponse {
  answer: string;
  sources: {
    documentId: string;
    content: string;
    similarity: number;
    metadata: any;
  }[];
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

@Injectable()
export class RagEngineService {
  private readonly logger = new Logger(RagEngineService.name);
  private embeddings: OpenAIEmbeddings | null = null;
  private llm: ChatOpenAI | null = null;

  constructor(private readonly prisma: PrismaService) {
    const openaiKey = process.env.OPENAI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const baseURL = process.env.OPENAI_BASE_URL;

    if (openaiKey && openaiKey !== 'sk-placeholder-openai-api-key') {
      this.llm = new ChatOpenAI({
        openAIApiKey: openaiKey,
        modelName: process.env.LLM_MODEL || 'openai/gpt-oss-20b',
        temperature: 0.2, // Low temperature for high factual grounding
        ...(baseURL ? { configuration: { baseURL } } : {}),
      });
    } else if (groqKey && groqKey !== 'gsk-placeholder-groq-api-key') {
      // Groq OpenAI-compatible endpoint
      this.llm = new ChatOpenAI({
        apiKey: groqKey,
        configuration: {
          baseURL: 'https://api.groq.com/openai/v1',
        },
        modelName: 'openai/gpt-oss-20b',
        temperature: 0.2,
      });
    }

    // 2. Embeddings Model (OpenAI or custom embedding provider)
    const embeddingKey =
      process.env.EMBEDDING_API_KEY || process.env.OPENAI_API_KEY;
    const isGroq =
      embeddingKey?.startsWith('gsk_') ||
      process.env.OPENAI_BASE_URL?.includes('groq.com');

    if (
      embeddingKey &&
      embeddingKey !== 'sk-placeholder-openai-api-key' &&
      !isGroq
    ) {
      this.embeddings = new OpenAIEmbeddings({
        openAIApiKey: embeddingKey,
        modelName: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
        ...(process.env.EMBEDDING_BASE_URL
          ? { configuration: { baseURL: process.env.EMBEDDING_BASE_URL } }
          : {}),
      });
    }
  }

  /**
   * Executes multi-tenant isolated RAG retrieval and generation.
   *
   * @param creatorProfileId Tenant isolation key
   * @param query User's question
   * @param creatorDisplayName Creator name for personalized grounding
   */
  async executeRagQuery(
    creatorProfileId: string,
    query: string,
    creatorDisplayName = 'the Creator',
    courseId?: string,
  ): Promise<RagResponse> {
    this.logger.log(
      `Executing RAG query for tenant ${creatorProfileId} (course: ${courseId || 'ALL'}): "${query.slice(0, 50)}..."`,
    );

    // 1. Generate query embedding
    let queryEmbedding: number[];
    if (this.embeddings) {
      try {
        queryEmbedding = await this.embeddings.embedQuery(query);
      } catch (err: any) {
        this.logger.warn(
          `Embedding API call failed (${err?.message || err}). Falling back to deterministic query vector.`,
        );
        queryEmbedding = this.generateFallbackVector(query, 1536);
      }
    } else {
      queryEmbedding = this.generateFallbackVector(query, 1536);
    }

    // 2. Hybrid Vector + Keyword Search with strict tenant & course isolation filter
    const retrievedChunks: VectorSearchResult[] =
      await this.prisma.searchSimilarChunks(
        creatorProfileId,
        queryEmbedding,
        5, // Top-5 chunks
        0.05, // Adaptive similarity threshold for Hybrid Search
        courseId,
        query,
      );

    // 3. Build Grounded Context
    let contextText = '';
    if (retrievedChunks.length > 0) {
      contextText = retrievedChunks
        .map(
          (chunk, index) =>
            `[Source ${index + 1}]:\n${chunk.content.trim()}`,
        )
        .join('\n\n');
    } else {
      contextText = 'NO_RELEVANT_CONTEXT_FOUND';
    }

    // 4. Construct Strict Grounding & Zero-Slop Professional Prompt
    const systemPrompt = `You are the Senior Technical Mentor and official Private Teaching Fellow for ${creatorDisplayName}.
Your mission is to provide authoritative, razor-sharp, technically dense, and deeply educational answers based EXCLUSIVELY on the verified course materials in the CONTEXT below.

ZERO-SLOP & DIRECT COMMUNICATION RULES:
1. NO CONVERSATIONAL FILLER: Never start with "Halo!", "Tentu saja!", "Sebagai asisten AI...", "Berdasarkan dokumen...", or "Saya senang membantu...". Answer the core question directly in the very first sentence with maximum clarity.
2. NO ROBOTIC DISCLAIMERS: Do not end with "Semoga membantu!", "Jika ada pertanyaan lain silakan...", or similar empty platitudes. End immediately after delivering the substantive explanation.
3. EXCLUSIVITY & IP PROTECTION:
   - NEVER mention raw filenames, file extensions (e.g. .pdf), URLs, internal source indexes, or citations (never output "[Source 1]", "pada file pdf", or "[1]").
   - Speak with first-hand authority as ${creatorDisplayName}'s dedicated engineering fellow. Deliver knowledge directly and seamlessly.
4. STRICT GROUNDING:
   - Answer exclusively based on facts in the CONTEXT. If the context does not contain the answer, reply cleanly: "Materi kursus oleh ${creatorDisplayName} belum mencakup topik ini. Silakan tanyakan materi teknis lain yang relevan."
5. FORMATTING & TYPOGRAPHY:
   - Format all key technical concepts, terms, and system components in bold (**term**).
   - Never wrap terms in single/double quotes or single asterisks. Always use bold (**term**) for clean, authoritative aesthetics.
   - When explaining technical mechanisms, provide structured explanations, code snippets, or architecture parameters if mentioned in context.
   - Reply in natural, articulate, professional Indonesian if the question is in Indonesian (or English if in English).`;

    const userPrompt = `CONTEXT:
${contextText}

QUESTION:
${query}

ANSWER:`;

    // 5. LLM Generation
    let answer = '';
    let promptTokens = Math.ceil((systemPrompt.length + userPrompt.length) / 4);
    let completionTokens = 0;

    if (this.llm) {
      try {
        const response = await this.llm.invoke([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ]);

        answer =
          typeof response.content === 'string'
            ? response.content
            : JSON.stringify(response.content);

        if (response.response_metadata?.tokenUsage) {
          promptTokens =
            response.response_metadata.tokenUsage.promptTokens || promptTokens;
          completionTokens =
            response.response_metadata.tokenUsage.completionTokens ||
            Math.ceil(answer.length / 4);
        } else {
          completionTokens = Math.ceil(answer.length / 4);
        }
      } catch (llmErr: any) {
        this.logger.warn(
          `LLM provider call failed (${llmErr?.message || llmErr}). Generating grounded factual fallback.`,
        );
        if (retrievedChunks.length > 0) {
          answer = `[AI Mentor untuk ${creatorDisplayName}]: Berdasarkan materi resmi kursus ini:\n\n${retrievedChunks[0].content.slice(
            0,
            300,
          )}...\n\n(Disarikan langsung dari dokumen kurikulum terisolasi).`;
        } else {
          answer = `Maaf, materi yang diajarkan oleh ${creatorDisplayName} untuk kursus ini belum mencakup topik yang ditanyakan.`;
        }
        completionTokens = Math.ceil(answer.length / 4);
      }
    } else {
      // Mock factual answer for development/testing when no external LLM API key is set
      if (retrievedChunks.length > 0) {
        answer = `[AI Copilot for ${creatorDisplayName}]: Berdasarkan materi resmi kreator:\n\n${retrievedChunks[0].content.slice(
          0,
          300,
        )}...\n\n(Informasi disarikan langsung dari dokumen terverifikasi).`;
      } else {
        answer = `Maaf, materi yang diajarkan oleh ${creatorDisplayName} belum mencakup topik ini. Silakan tanyakan materi lain yang relevan.`;
      }
      completionTokens = Math.ceil(answer.length / 4);
    }

    return {
      answer,
      sources: retrievedChunks.map((chunk) => ({
        documentId: chunk.documentId,
        documentTitle: chunk.metadata?.source || 'Dokumen Materi Kursus',
        text: chunk.content,
        content: chunk.content,
        similarity: chunk.similarity,
        metadata: chunk.metadata,
      })),
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    };
  }

  private generateFallbackVector(text: string, dimensions = 1536): number[] {
    const vector: number[] = new Array(dimensions).fill(0);
    const words = text.toLowerCase().replace(/[^\w\s]/g, ' ').split(/\s+/).filter(Boolean);
    for (const word of words) {
      let h = 0;
      for (let i = 0; i < word.length; i++) {
        h = (Math.imul(31, h) + word.charCodeAt(i)) | 0;
      }
      const idx = Math.abs(h) % dimensions;
      vector[idx] += 1.0;
    }
    const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vector.map((val) => Number((val / norm).toFixed(6)));
  }
}
