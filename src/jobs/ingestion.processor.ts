import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../modules/prisma/prisma.service';
import { IngestionJobPayload } from '../modules/knowledge-base/knowledge-base.service';
import { DocumentStatus } from '../common/types/enums';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { AiService } from '../modules/ai/ai.service';
import * as pdfParse from 'pdf-parse';
import { randomUUID } from 'crypto';

@Processor('document-ingestion')
export class IngestionProcessor extends WorkerHost {
  private readonly logger = new Logger(IngestionProcessor.name);
  constructor(private readonly prisma: PrismaService, private readonly ai: AiService) {
    super();
  }

  async process(job: Job<IngestionJobPayload, any, string>): Promise<any> {
    const { documentId, creatorProfileId, fileBufferBase64, fileName, fileType } =
      job.data;

    this.logger.log(
      `Starting ingestion for document ${documentId} (${fileName}) of Creator ${creatorProfileId}`,
    );

    // 1. Set document status to PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: DocumentStatus.PROCESSING },
    });

    try {
      // 2. Decode file buffer
      const buffer = Buffer.from(fileBufferBase64, 'base64');

      // 3. Extract text content based on file type
      let rawText = '';
      if (fileType.toUpperCase() === 'PDF') {
        const parsePdf: any =
          typeof pdfParse === 'function'
            ? pdfParse
            : (pdfParse as any).default || pdfParse;
        const pdfData = await parsePdf(buffer);
        rawText = pdfData.text;
      } else {
        // CSV, TXT, or transcript
        rawText = buffer.toString('utf-8');
      }

      if (!rawText || rawText.trim().length === 0) {
        throw new Error('Extracted text is empty or could not be parsed.');
      }

      // 4. Chunking: 600 characters/tokens with 100 overlap
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 600,
        chunkOverlap: 100,
      });

      const docs = await splitter.createDocuments(
        [rawText],
        [
          {
            source: fileName,
            documentId,
            creatorProfileId,
          },
        ],
      );

      this.logger.log(
        `Document ${documentId} split into ${docs.length} chunks. Generating embeddings...`,
      );

      // 5. Generate embeddings and store in pgvector
      for (let i = 0; i < docs.length; i++) {
        const chunk = docs[i];
        const chunkContent = chunk.pageContent;
        const chunkIndex = i;
        const tokenEstimate = Math.ceil(chunkContent.length / 4);

        const vectorArray = this.ai.browser ? null : await this.ai.embed(chunkContent, true);

        const vectorString = vectorArray ? `[${vectorArray.join(',')}]` : null;
        const chunkId = randomUUID();

        // 6. Direct SQL insertion to cast to pgvector vector(1536)
        await this.prisma.$executeRawUnsafe(
          `
          INSERT INTO document_chunks (
            id, "documentId", "creatorProfileId", content, "chunkIndex", "tokenCount", metadata, embedding, "createdAt"
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7::jsonb, $8::vector, NOW()
          );
        `,
          chunkId,
          documentId,
          creatorProfileId,
          chunkContent,
          chunkIndex,
          tokenEstimate,
          JSON.stringify({ ...chunk.metadata, ...(this.ai.browser ? {} : { embeddingSpace: this.ai.embeddingSpace }) }),
          vectorString,
        );
      }

      // 7. Update document status to COMPLETED
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: this.ai.browser ? DocumentStatus.PENDING : DocumentStatus.COMPLETED,
          errorMessage: null,
        },
      });

      this.logger.log(
        `Successfully ingested document ${documentId} with ${docs.length} chunks.`,
      );

      return {
        status: this.ai.browser ? 'AWAITING_BROWSER_EMBEDDINGS' : 'SUCCESS',
        documentId,
        chunksCount: docs.length,
      };
    } catch (error) {
      this.logger.error(`Error ingesting document ${documentId}:`, error);

      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: DocumentStatus.FAILED,
          errorMessage: error.message || 'Unknown ingestion error',
        },
      });

      throw error;
    }
  }

}
