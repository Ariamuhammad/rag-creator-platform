import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { db } from '../../prisma/db';

export interface VectorSearchResult {
  id: string;
  documentId: string;
  creatorProfileId: string;
  content: string;
  chunkIndex: number;
  metadata: any;
  similarity: number;
}

function normalizeInput(input: any): any {
  if (input === null || input === undefined) return input;
  if (input instanceof Date) {
    return (globalThis as any).Temporal.Instant.from(input.toISOString());
  }
  if (Array.isArray(input)) {
    return input.map(normalizeInput);
  }
  if (typeof input === 'object' && input.constructor === Object) {
    const result: any = {};
    for (const [key, val] of Object.entries(input)) {
      result[key] = normalizeInput(val);
    }
    return result;
  }
  return input;
}

function applyWhere(ormModel: any, whereObj: any): any {
  if (!whereObj || typeof whereObj !== 'object') return ormModel;
  let q = ormModel;
  for (const [key, val] of Object.entries(whereObj)) {
    if (val === undefined) continue;
    if (
      val !== null &&
      typeof val === 'object' &&
      !(val instanceof Date) &&
      !('epochMilliseconds' in val)
    ) {
      const ops = val as Record<string, any>;
      for (const [op, opVal] of Object.entries(ops)) {
        const normalizedVal = normalizeInput(opVal);
        if (op === 'gte') {
          q = q.where((m: any) => m[key].gte(normalizedVal));
        } else if (op === 'lte') {
          q = q.where((m: any) => m[key].lte(normalizedVal));
        } else if (op === 'gt') {
          q = q.where((m: any) => m[key].gt(normalizedVal));
        } else if (op === 'lt') {
          q = q.where((m: any) => m[key].lt(normalizedVal));
        } else if (op === 'in') {
          q = q.where((m: any) => m[key].in(normalizedVal));
        } else if (op === 'not') {
          q = q.where((m: any) => m[key].neq(normalizedVal));
        } else if (op === 'equals') {
          q = q.where((m: any) => m[key].eq(normalizedVal));
        }
      }
    } else {
      const normalizedVal = normalizeInput(val);
      q = q.where((m: any) => m[key].eq(normalizedVal));
    }
  }
  return q;
}

function applyOrderBy(query: any, orderBy: any): any {
  if (!orderBy) return query;
  if (Array.isArray(orderBy)) {
    let q = query;
    for (const item of orderBy) {
      q = applyOrderBy(q, item);
    }
    return q;
  }
  if (typeof orderBy === 'object') {
    let q = query;
    for (const [col, dir] of Object.entries(orderBy)) {
      if (typeof dir === 'string') {
        const direction = dir.toLowerCase();
        q = q.orderBy((m: any) =>
          direction === 'desc' ? m[col].desc() : m[col].asc(),
        );
      }
    }
    return q;
  }
  return query;
}

export function createModelAdapter(ormModel: any) {
  return {
    async findUnique(args: { where: any; include?: any; select?: any }) {
      let q = applyWhere(ormModel, args.where);
      if (args.include) {
        for (const [rel, val] of Object.entries(args.include)) {
          if (val && typeof rel === 'string' && rel !== '_count') {
            q = q.include(rel);
          }
        }
      }
      return q.first();
    },
    async findFirst(args: {
      where?: any;
      orderBy?: any;
      include?: any;
      select?: any;
    } = {}) {
      let q = applyWhere(ormModel, args.where);
      q = applyOrderBy(q, args.orderBy);
      if (args.include) {
        for (const [rel, val] of Object.entries(args.include)) {
          if (val && typeof rel === 'string' && rel !== '_count') {
            q = q.include(rel);
          }
        }
      }
      return q.first();
    },
    async findMany(args: {
      where?: any;
      orderBy?: any;
      take?: number;
      skip?: number;
      include?: any;
      select?: any;
    } = {}) {
      let q = applyWhere(ormModel, args.where);
      q = applyOrderBy(q, args.orderBy);
      if (args.include) {
        for (const [rel, val] of Object.entries(args.include)) {
          if (val && typeof rel === 'string' && rel !== '_count') {
            q = q.include(rel);
          }
        }
      }
      if (args.take) q = q.limit(args.take);
      if (args.skip) q = q.offset(args.skip);
      return q.all();
    },
    async create(args: { data: any; select?: any; include?: any }) {
      return ormModel.create(normalizeInput(args.data));
    },
    async createMany(args: { data: any[] }) {
      return ormModel.createAll(args.data.map(normalizeInput));
    },
    async update(args: { where: any; data: any; select?: any }) {
      const q = applyWhere(ormModel, args.where);
      return q.update(normalizeInput(args.data));
    },
    async updateMany(args: { where?: any; data: any }) {
      const q = applyWhere(ormModel, args.where);
      return q.updateAll(normalizeInput(args.data));
    },
    async delete(args: { where: any }) {
      const q = applyWhere(ormModel, args.where);
      return q.delete();
    },
    async deleteMany(args: { where?: any } = {}) {
      const q = applyWhere(ormModel, args.where);
      return q.deleteAll();
    },
    async count(args: { where?: any } = {}) {
      const q = applyWhere(ormModel, args.where);
      const res = await q.aggregate((a: any) => ({ count: a.count() }));
      return res?.count ?? 0;
    },
    async upsert(args: { where: any; create: any; update: any }) {
      const q = applyWhere(ormModel, args.where);
      return q.upsert({
        create: normalizeInput(args.create),
        update: normalizeInput(args.update),
      });
    },
  };
}

export function createDatabaseFacade(targetOrm: any) {
  return {
    user: createModelAdapter(targetOrm.public.User),
    creatorProfile: createModelAdapter(targetOrm.public.CreatorProfile),
    subscriptionTier: createModelAdapter(targetOrm.public.SubscriptionTier),
    subscription: createModelAdapter(targetOrm.public.Subscription),
    creditLedger: createModelAdapter(targetOrm.public.CreditLedger),
    knowledgeBase: createModelAdapter(targetOrm.public.KnowledgeBase),
    document: createModelAdapter(targetOrm.public.Document),
    documentChunk: createModelAdapter(targetOrm.public.DocumentChunk),
    chatSession: createModelAdapter(targetOrm.public.ChatSession),
    chatMessage: createModelAdapter(targetOrm.public.ChatMessage),
    paymentOrder: createModelAdapter(targetOrm.public.PaymentOrder),
    payoutRequest: createModelAdapter(targetOrm.public.PayoutRequest),
  };
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  public readonly db = db;
  public readonly orm = db.orm;

  // Model Facades
  public readonly user = createModelAdapter(db.orm.public.User);
  public readonly creatorProfile = createModelAdapter(db.orm.public.CreatorProfile);
  public readonly subscriptionTier = createModelAdapter(db.orm.public.SubscriptionTier);
  public readonly subscription = createModelAdapter(db.orm.public.Subscription);
  public readonly creditLedger = createModelAdapter(db.orm.public.CreditLedger);
  public readonly knowledgeBase = createModelAdapter(db.orm.public.KnowledgeBase);
  public readonly document = createModelAdapter(db.orm.public.Document);
  public readonly documentChunk = createModelAdapter(db.orm.public.DocumentChunk);
  public readonly chatSession = createModelAdapter(db.orm.public.ChatSession);
  public readonly chatMessage = createModelAdapter(db.orm.public.ChatMessage);
  public readonly paymentOrder = createModelAdapter(db.orm.public.PaymentOrder);
  public readonly payoutRequest = createModelAdapter(db.orm.public.PayoutRequest);

  private connectionPromise: Promise<any> | null = null;

  private async getConnection() {
    if (!this.connectionPromise) {
      this.connectionPromise = db.connect();
    }
    return this.connectionPromise;
  }

  async onModuleInit() {
    try {
      const conn = await this.getConnection();
      // Ensure vector extension and embedding column exist in pgvector
      await (conn as any).driver.execute({
        sql: 'CREATE EXTENSION IF NOT EXISTS vector;',
      });
      await (conn as any).driver.execute({
        sql: 'ALTER TABLE document_chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);',
      });

      this.logger.log('Prisma 8 (@prisma/orm-postgres) connected with pgvector support.');
    } catch (error) {
      this.logger.error('Failed to initialize Prisma 8 connection:', error);
    }
  }

  async onModuleDestroy() {
    try {
      await db.close();
      this.logger.log('Disconnected Prisma 8 client.');
    } catch (error) {
      this.logger.error('Error closing Prisma 8 client:', error);
    }
  }

  /**
   * Prisma 8 Transaction Runner
   */
  async $transaction<T>(
    fn: (tx: ReturnType<typeof createDatabaseFacade>) => Promise<T>,
  ): Promise<T> {
    return db.transaction(async (tx) => {
      const txFacade = createDatabaseFacade(tx.orm);
      return fn(txFacade);
    });
  }

  /**
   * Execute raw SQL mutations (e.g. INSERT ... ::vector)
   */
  async $executeRawUnsafe(sql: string, ...params: any[]): Promise<{ affectedRows: number }> {
    const conn = await this.getConnection();
    return (conn as any).driver.execute({
      sql,
      params,
    });
  }

  /**
   * Execute raw SQL queries returning rows
   */
  async $queryRawUnsafe<T = any>(sql: string, ...params: any[]): Promise<T[]> {
    const conn = await this.getConnection();
    const rows: T[] = [];
    for await (const row of (conn as any).driver.query({ sql, params })) {
      rows.push(row as T);
    }
    return rows;
  }

  /**
   * Multi-Tenant Vector Similarity Search with strict tenant isolation.
   * Enforces creatorProfileId filter in SQL to prevent any cross-tenant data leakage.
   *
   * @param creatorProfileId Tenant isolation key
   * @param queryEmbedding Array of numbers representing the 1536-dimensional vector
   * @param limit Top-K chunks to retrieve (default 5)
   * @param similarityThreshold Minimum cosine similarity threshold (default 0.60)
   */
  async searchSimilarChunks(
    creatorProfileId: string,
    queryEmbedding: number[],
    limit = 5,
    similarityThreshold = 0.6,
  ): Promise<VectorSearchResult[]> {
    const vectorString = `[${queryEmbedding.join(',')}]`;
    const conn = await this.getConnection();
    const rows: VectorSearchResult[] = [];

    for await (const row of (conn as any).driver.query({
      sql: `
        SELECT 
          id,
          "documentId",
          "creatorProfileId",
          content,
          "chunkIndex",
          metadata,
          (1 - (embedding <=> $1::vector)) AS similarity
        FROM document_chunks
        WHERE "creatorProfileId" = $2
          AND embedding IS NOT NULL
          AND (1 - (embedding <=> $1::vector)) >= $3
        ORDER BY embedding <=> $1::vector ASC
        LIMIT $4;
      `,
      params: [vectorString, creatorProfileId, similarityThreshold, limit],
    })) {
      rows.push(row as VectorSearchResult);
    }

    return rows;
  }
}
