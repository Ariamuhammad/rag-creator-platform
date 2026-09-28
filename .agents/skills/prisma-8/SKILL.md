---
name: prisma-8
description: >-
  Panduan lengkap dan cheatsheet resmi arsitektur Prisma 8 (@prisma/orm-postgres,
  @prisma/orm-sqlite, @prisma/orm-mongo). Digunakan saat memulai proyek Prisma 8,
  menulis Data Contract (contract.prisma), menjalankan CLI Prisma 8 (contract emit,
  db init/update), menulis query db.orm.<namespace>.<Model> atau db.sql, menangani
  Temporal.Instant untuk DateTime, transaksi atomik, serta integrasi NestJS/Bun.
---

# Prisma 8 — Ultimate Reference & AI Agent Skill Guide

> **"Edit your data contract. Prisma handles the rest."**

Prisma 8 (sebelumnya dikenal sebagai Prisma Next) merupakan perombakan arsitektur total dari Prisma ORM (Prisma 1–7). Prisma 8 meninggalkan pendekatan monolitik `@prisma/client` dan beralih ke arsitektur **modular, target-specific, contract-first**, dengan performa native tinggi dan dukungan query lanes ganda (ORM & SQL Builder).

---

## 1. Perbandingan Utama: Prisma 7 vs Prisma 8

| Aspek | Prisma 7 (Legacy) | Prisma 8 (Modern) |
|---|---|---|
| **Paket Utama** | `@prisma/client` & `prisma` | `@prisma/orm-postgres`, `@prisma/orm-sqlite`, `@prisma/orm-mongo` |
| **Definisi Skema** | `prisma/schema.prisma` | **Data Contract**: `src/prisma/contract.prisma` atau TypeScript builder |
| **Konfigurasi** | Blok `datasource` di `.prisma` | [`prisma.config.ts`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/prisma.config.ts) (`definePrismaConfig` + `ormConfig`) |
| **Artefak Generasi** | `node_modules/@prisma/client` | File lokal: `contract.json` (runtime) & `contract.d.ts` (tipe) |
| **CLI Generate** | `prisma generate` | `prisma contract emit` |
| **CLI Database Sync** | `prisma db push` / `prisma migrate dev` | `prisma db init` / `prisma db update` / `prisma migration plan` |
| **Akses Model Client** | `prisma.user.findMany()` | **Namespace-aware**: `db.orm.public.User.all()` (PostgreSQL) |
| **Bentuk Query** | Objek opsi (`{ where, select, include }`) | **Fluent Chaining**: `.where(...).select(...).orderBy(...).all()` |
| **Single Row Read** | `findUnique()`, `findFirst()` | `.first()` (menghasilkan `LIMIT 1`) atau `.first({ id })` |
| **Tipe Tanggal (DateTime)** | JavaScript `Date` | **Temporal API**: `Temporal.Instant` (misal `Temporal.Now.instant()`) |
| **Update Otomatis Waktu** | `@updatedAt` | `temporal.updatedAt()` |
| **Query Lanes** | Hanya ORM + `$queryRaw` | **Dual Lanes**: ORM (`db.orm`) + SQL Builder (`db.sql`) + Raw (`db.raw.sql`) |
| **Transaksi** | `prisma.$transaction([p1, p2])` | `db.transaction(async (tx) => { ... })` |

---

## 2. Struktur Proyek & Konfigurasi

### A. Dependensi (`package.json`)
Gunakan `@prisma/orm-<target>` sesuai database yang digunakan:
```json
{
  "dependencies": {
    "@prisma/orm-postgres": "8.0.0-rc.11"
  },
  "devDependencies": {
    "@prisma/cli-engine": "8.0.0-rc.15",
    "prisma": "8.0.0-rc.15"
  }
}
```
> **Catatan Runtime**: Prisma 8 bekerja sangat baik dengan **Bun** (`bun add ...`, `bun x prisma ...`, `bun run ...`). Jika menggunakan Node.js, gunakan Node 20+ / 22+ dengan `moduleResolution: "bundler"` atau `"nodenext"`.

### B. Konfigurasi [`prisma.config.ts`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/prisma.config.ts)
```typescript
import 'dotenv/config';
import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/prisma/contract.prisma',
    db: {
      connection: process.env['DATABASE_URL']!,
    },
  }),
});
```

### C. Data Contract ([`src/prisma/contract.prisma`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/src/prisma/contract.prisma))
Aturan penulisan contract:
- Gunakan `temporal.updatedAt()` untuk kolom pembaruan otomatis (bukan `@updatedAt`).
- ID default UUID: `@id @default(uuid())` atau `@id @default(autoincrement())`.
- Relasi tetap menggunakan `@relation(fields: [...], references: [...])`.

Contoh:
```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  fullName  String?
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()

  posts     Post[]
  @@map("users")
}

model Post {
  id        String   @id @default(uuid())
  userId    String
  title     String
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("posts")
}
```

### D. Inisialisasi Database Client ([`src/prisma/db.ts`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/src/prisma/db.ts))
```typescript
import 'dotenv/config';
import postgres from '@prisma/orm-postgres/runtime';
import type { Contract } from './contract.d';
import contractJson from './contract.json' with { type: 'json' };

export const db = postgres<Contract>({
  contractJson,
  url: process.env['DATABASE_URL']!,
});
```

---

## 3. Perintah CLI Prisma 8

| Perintah | Fungsi |
|---|---|
| `bun x prisma contract emit` | Mengompilasi `contract.prisma` menjadi `contract.json` dan `contract.d.ts`. Wajib dijalankan setiap kali contract berubah! |
| `bun x prisma db init` | Membuat tabel awal di database dan menandatangani contract hash. |
| `bun x prisma db update` | Menerapkan perubahan contract ke database saat development. |
| `bun x prisma migration plan` | Merencanakan paket migrasi produksi (menghasilkan folder migrasi). |
| `bun x prisma db migrate` | Menjalankan migrasi terencana di environment staging/produksi. |

---

## 4. Pola Query Prisma 8 (ORM Lane)

### A. Namespace-Aware Accessors
Pada PostgreSQL, model selalu diakses melalui namespace skema (default: `public`):
- `db.orm.public.User`
- `db.orm.public.Post`

### B. Membaca Data (Read)
```typescript
// 1. Ambil satu berdasarkan Primary Key (shorthand)
const user = await db.orm.public.User.first({ id: 'user-id' });

// 2. Ambil satu dengan filter predicate
const user = await db.orm.public.User
  .where((u) => u.email.eq('alice@example.com'))
  .first();

// 3. Ambil banyak dengan filter, proyeksi, sort, dan pagination
const users = await db.orm.public.User
  .where((u) => u.role.eq('STUDENT'))
  .select('id', 'email', 'fullName')
  .orderBy((u) => u.createdAt.desc())
  .limit(10)
  .offset(0)
  .all();
```

> [!IMPORTANT]
> **Aturan `.all()`**:
> 1. `.all()` mengembalikan `AsyncIterableResult<Row>`, yang merupakan `PromiseLike<Row[]>`. Cukup gunakan `await db.orm...all()` untuk mendapatkan array biasa.
> 2. Hasil `.all()` bersifat **single-consumption**. Jangan melakukan `await` dua kali pada variabel result yang sama karena akan melempar error `RUNTIME.ITERATOR_CONSUMED`. Simpan hasil `await` ke variabel baru!

### C. Predikat & Filter
- **Shorthand Object**: `.where({ role: 'STUDENT', isActive: true })` (hanya untuk kesetaraan sederhana).
- **Lambda Predicate**: `.where((u) => u.email.eq('...'))`
  - Operator: `.eq()`, `.neq()`, `.lt()`, `.lte()`, `.gt()`, `.gte()`, `.like()`, `.ilike()`, `.in([...])`, `.isNull()`, `.isNotNull()`.
  - **TIDAK ADA `.between()`**: Gunakan chaining `.where((u) => u.age.gte(18)).where((u) => u.age.lte(30))` atau kombinator `and()`.
- **Kombinator**:
  ```typescript
  import { and, or, not } from '@prisma/orm-postgres/orm-client';

  db.orm.public.User.where((u) =>
    and(
      or(u.role.eq('ADMIN'), u.email.ilike('%@stanford.edu')),
      not(u.posts.none())
    )
  );
  ```

### D. Relasi & Eager-Loading (`.include`)
Gunakan callback cabang untuk memuat relasi dan mengatur proyeksi/filter relasi:
```typescript
const usersWithPosts = await db.orm.public.User
  .include('posts', (post) =>
    post
      .select('id', 'title', 'createdAt')
      .orderBy((p) => p.createdAt.desc())
      .limit(5)
  )
  .all();

// Reducer Relasi (Menghitung jumlah relasi tanpa memuat seluruh baris)
const usersWithCount = await db.orm.public.User
  .include('posts', (posts) => posts.count())
  .all();
// Menghasilkan { ...user, posts: number }
```

### E. Penulisan Data (Mutations)
```typescript
// Create
const newUser = await db.orm.public.User.create({
  email: 'budi@example.com',
  fullName: 'Budi Santoso',
});

// Create Many
await db.orm.public.User.createAll([
  { email: 'user1@example.com' },
  { email: 'user2@example.com' },
]);

// Update
await db.orm.public.User
  .where({ id: 'user-id' })
  .update({ fullName: 'Budi S.' });

// Delete
await db.orm.public.User
  .where({ id: 'user-id' })
  .delete();

// Upsert
await db.orm.public.User.upsert({
  create: { id: 'user-id', email: 'budi@example.com', fullName: 'Budi' },
  update: { fullName: 'Budi Updated' },
});
```

### F. Transaksi (`db.transaction`)
Transaksi membungkus operasi atomik dan memberikan instance `tx`:
```typescript
const result = await db.transaction(async (tx) => {
  const user = await tx.orm.public.User.create({
    email: 'creator@example.com',
  });

  const profile = await tx.orm.public.CreatorProfile.create({
    userId: user.id,
    slug: 'creator-slug',
  });

  return { user, profile };
});
```

---

## 5. Temporal API untuk Tanggal & Waktu (DateTime)

Prisma 8 menggunakan standar **ECMAScript Temporal API** untuk tipe data temporal PostgreSQL (`timestamptz` / `timestamp`).

> [!CAUTION]
> **Jangan mengirim JavaScript `new Date()` langsung ke kolom timestamptz!**
> Jika Anda mengirim `new Date()`, Prisma 8 akan melempar error:
> `RUNTIME.ENCODE_FAILED: Codec 'pg/timestamptz-temporal@1' encodes a Temporal.Instant, but received a Date.`

### Solusi Penggunaan Temporal:
```typescript
// Waktu sekarang:
const now = Temporal.Now.instant();

// Dari string ISO atau JavaScript Date:
const instant = Temporal.Instant.from(new Date().toISOString());

// Kirim ke query:
await db.orm.public.Subscription.create({
  currentPeriodStart: Temporal.Now.instant(),
  currentPeriodEnd: Temporal.Instant.from(endDate.toISOString()),
});
```

---

## 6. Dual Lanes: SQL Builder & Raw Driver Execution

### A. SQL Builder Lane (`db.sql.<ns>.<table>`)
Digunakan untuk query kompleks yang membutuhkan explicit JOIN, computed columns, atau window functions:
```typescript
const plan = db.sql.public.users
  .select('id', 'email')
  .where((f, fns) => fns.eq(f.email, 'budi@example.com'))
  .limit(1)
  .build();

// Eksekusi plan yang mengembalikan baris:
const rows = await db.runtime().query(plan);

// Eksekusi plan non-returning write:
// const { affectedRows } = await db.runtime().execute(plan);
```

### B. Raw SQL & PgVector Cosine Distance
Untuk query native seperti pencarian vektor pgvector (`<=>`), gunakan koneksi driver langsung:
```typescript
const conn = await db.connect();

// 1. Eksekusi DDL / Mutasi Raw:
await (conn as any).driver.execute({
  sql: 'CREATE EXTENSION IF NOT EXISTS vector;',
});

// 2. Query Baris Raw (pgvector Cosine Similarity):
const vectorString = `[${embedding.join(',')}]`;
const rows: any[] = [];

for await (const row of (conn as any).driver.query({
  sql: `
    SELECT 
      id,
      content,
      (1 - (embedding <=> $1::vector)) AS similarity
    FROM document_chunks
    WHERE "creatorProfileId" = $2
      AND (1 - (embedding <=> $1::vector)) >= $3
    ORDER BY embedding <=> $1::vector ASC
    LIMIT $4;
  `,
  params: [vectorString, creatorProfileId, 0.6, 5],
})) {
  rows.push(row);
}
```

---

## 7. Pola Integrasi NestJS: `PrismaService` Adapter Facade

Untuk memudahkan migrasi atau membuat codebase NestJS tetap bersih dan kompatibel dengan dependensi injeksi, buatlah adapter facade di [`src/modules/prisma/prisma.service.ts`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/src/modules/prisma/prisma.service.ts):

### Fitur Wajib Adapter:
1. **Normalisasi Otomatis `Date` -> `Temporal.Instant`**: Mencegah error `RUNTIME.ENCODE_FAILED`.
2. **Penerjemahan Filter Operator**: Mengubah filter objek Prisma `{ gte: val }`, `{ in: [...] }` menjadi lambda `.gte()`, `.in()`.
3. **Penyelarasan Transaksi**: Mendukung `this.prisma.$transaction(async (tx) => { ... })`.
4. **pgvector Search Method**: Menyediakan `searchSimilarChunks()` terisolasi tenant.

Lihat implementasi produksi lengkap di [`src/modules/prisma/prisma.service.ts`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/src/modules/prisma/prisma.service.ts).

---

## 8. Checklist AI Agent Saat Menggunakan Prisma 8

- [ ] Pastikan tidak ada `import { PrismaClient } from '@prisma/client'`. Hapus `@prisma/client`.
- [ ] Pastikan `prisma.config.ts` ada dan mendefinisikan `definePrismaConfig`.
- [ ] Pastikan model contract di [`src/prisma/contract.prisma`](file:///d:/AI%20Engineer/Projects/rag-saas-educators/src/prisma/contract.prisma) menggunakan `temporal.updatedAt()`.
- [ ] Jalankan `bun x prisma contract emit` setelah setiap perubahan skema.
- [ ] Di PostgreSQL, gunakan namespace: `db.orm.public.<Model>` (bukan `db.orm.<Model>`).
- [ ] Jangan gunakan `.between()`. Gunakan chaining `.where()` atau `and()`.
- [ ] Konversikan `Date` menjadi `Temporal.Instant` untuk field DateTime.
- [ ] Untuk pgvector / DDL, gunakan `conn.driver.execute` atau `conn.driver.query`.
- [ ] Pastikan `tsconfig.json` memiliki `"moduleResolution": "bundler"` dan `"module": "esnext"`.
