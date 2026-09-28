# Panduan Komprehensif Prisma 8: Arsitektur, Perbedaan dengan Prisma 7, dan Pola Penggunaan

Dokumen ini adalah panduan referensi mendalam mengenai **Prisma 8** (generasi baru Prisma ORM), perbedaan mendasar dibanding Prisma 7 (dan versi sebelumnya), panduan setup, serta pola penulisan query modern dan integrasi ke dalam framework enterprise seperti NestJS.

---

## Daftar Isi
1. [Paradigm Shift: Mengapa Prisma 8?](#1-paradigm-shift-mengapa-prisma-8)
2. [Tabel Perbandingan Lengkap: Prisma 7 vs Prisma 8](#2-tabel-perbandingan-lengkap-prisma-7-vs-prisma-8)
3. [Arsitektur Baru: Contract-First & Target-Specific ORM](#3-arsitektur-baru-contract-first--target-specific-orm)
4. [Langkah Setup & Konfigurasi Proyek](#4-langkah-setup--konfigurasi-proyek)
5. [Evolusi Perintah CLI](#5-evolusi-perintah-cli)
6. [Panduan Query Modern (Dual Query Lanes)](#6-panduan-query-modern-dual-query-lanes)
   - [ORM Lane (`db.orm`)](#a-orm-lane-dborm)
   - [SQL Builder Lane (`db.sql`)](#b-sql-builder-lane-dbsql)
   - [Raw SQL & Driver Execution (pgvector)](#c-raw-sql--driver-execution-pgvector)
7. [Penanganan Tanggal & Waktu: ECMAScript Temporal API](#7-penanganan-tanggal--waktu-ecmascript-temporal-api)
8. [Pola Integrasi NestJS & Adapter Facade](#8-pola-integrasi-nestjs--adapter-facade)
9. [Troubleshooting & Solusi Error Umum](#9-troubleshooting--solusi-error-umum)
10. [Checklist untuk Pengembang & AI Agent](#10-checklist-untuk-pengembang--ai-agent)

---

## 1. Paradigm Shift: Mengapa Prisma 8?

Pada Prisma 1 hingga 7, Prisma mengandalkan paket monolitik `@prisma/client` dengan mesin query Rust biner/Wasm yang memuat seluruh logika ORM. Pendekatan ini memiliki beberapa keterbatasan:
- **Ukuran bundle dan cold-start**: Engine binary membebani lingkungan serverless dan edge runtime.
- **Keterbatasan SQL fleksibel**: Terlalu kaku untuk query kompleks tanpa beralih ke `$queryRaw` yang rawan type-safety hilang.
- **Standar waktu lawas**: Penggunaan JavaScript `Date` yang rentan terhadap masalah timezone dan serialisasi ambigu.

**Prisma 8 menyelesaikan masalah ini dengan perombakan arsitektur total**:
1. **Target-Specific Packages**: `@prisma/orm-postgres`, `@prisma/orm-sqlite`, `@prisma/orm-mongo`. Hanya mengunduh dan menjalankan driver yang dibutuhkan.
2. **Contract-First**: Skema didefinisikan sebagai **Data Contract** yang menghasilkan artefak lokal `contract.json` (runtime metadata) dan `contract.d.ts` (TypeScript types).
3. **Dual Query Lanes**: Mendukung ORM tingkat tinggi (model-based) sekaligus SQL Builder tingkat rendah (plan-based) dalam satu klien terpadu.
4. **Native ECMAScript Temporal**: Mengadopsi standar `Temporal.Instant` untuk presisi waktu tinggi tanpa ambiguitas timezone.

---

## 2. Tabel Perbandingan Lengkap: Prisma 7 vs Prisma 8

| Fitur | Prisma 7 (Legacy) | Prisma 8 (Modern) |
|---|---|---|
| **Paket Client** | `@prisma/client` | `@prisma/orm-postgres` (atau `@prisma/orm-*`) |
| **Lokasi Skema** | `prisma/schema.prisma` | `src/prisma/contract.prisma` |
| **Konfigurasi** | Blok `datasource` di `schema.prisma` | `prisma.config.ts` (`definePrismaConfig`) |
| **Artefak Tipe** | Disimpan di `node_modules/@prisma/client` | Disimpan di direktori lokal: `contract.json` & `contract.d.ts` |
| **Kompilasi Skema** | `npx prisma generate` | `npx prisma contract emit` |
| **Sinkronisasi DB** | `npx prisma db push` | `npx prisma db init` / `npx prisma db update` |
| **Migrasi Produksi** | `npx prisma migrate dev` | `npx prisma migration plan` & `npx prisma db migrate` |
| **Akses Model (Postgres)** | `prisma.user` (flat) | `db.orm.public.User` (namespace-aware) |
| **Metode Baca Tunggal** | `findUnique()`, `findFirst()` | `.first()` (otomatis menambahkan `LIMIT 1`) atau `.first({ id })` |
| **Metode Baca Banyak** | `findMany()` | `.all()` (mengembalikan Thenable `AsyncIterableResult`) |
| **Bentuk Query** | Objek opsi (`{ where: ..., select: ... }`) | **Fluent Chaining**: `.where(...).select(...).orderBy(...).all()` |
| **Operator Perbandingan** | Objek: `{ age: { gte: 18 } }` | Lambda: `(u) => u.age.gte(18)` |
| **Filter Range (`between`)** | Tidak native (pakai `gte` + `lte`) | Chaining `.where((u) => u.age.gte(18)).where((u) => u.age.lte(30))` |
| **Eager Loading Relasi** | `include: { posts: true }` | `.include('posts', (post) => post.select(...).limit(5))` |
| **Agregat Relasi** | `_count: { select: { posts: true } }` | Reducer: `.include('posts', (posts) => posts.count())` |
| **Tipe Tanggal (DateTime)** | `Date` (JavaScript native) | `Temporal.Instant` (ECMAScript Temporal API) |
| **Kolom Waktu Otomatis** | `@updatedAt` | `temporal.updatedAt()` |
| **Transaksi** | `prisma.$transaction([p1, p2])` | `db.transaction(async (tx) => { ... })` |
| **Query Kompleks / Join** | `$queryRaw` string literal | `db.sql.public.user.select(...).innerJoin(...).build()` |

---

## 3. Arsitektur Baru: Contract-First & Target-Specific ORM

```
┌──────────────────────────────────────────────────────────┐
│                 src/prisma/contract.prisma               │
│               (Definisi Data Contract / PSL)             │
└────────────────────────────┬─────────────────────────────┘
                             │
                  bun x prisma contract emit
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
   src/prisma/contract.json      src/prisma/contract.d.ts
    (Metadata Serialized AST)      (Definisi Tipe TypeScript)
              │                             │
              └──────────────┬──────────────┘
                             │ Dimuat oleh
                             ▼
                    src/prisma/db.ts
             postgres<Contract>({ ... })
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
       db.orm.public.*                db.sql.public.*
      (ORM Lane: Fluent)        (SQL Builder Lane: Plan-Based)
```

---

## 4. Langkah Setup & Konfigurasi Proyek

### A. Instalasi Dependensi
Gunakan **Bun** atau Node.js 20+:
```bash
bun add @prisma/orm-postgres
bun add -d prisma @prisma/cli-engine
```

### B. Konfigurasi `prisma.config.ts`
Buat file `prisma.config.ts` di root proyek:
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

### C. Penulisan Data Contract (`src/prisma/contract.prisma`)
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
  content   String
  createdAt DateTime @default(now())
  updatedAt temporal.updatedAt()

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@map("posts")
}
```

### D. Inisialisasi Database Client (`src/prisma/db.ts`)
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

### E. Konfigurasi `tsconfig.json`
Pastikan `tsconfig.json` mendukung resolusi modul modern:
```json
{
  "compilerOptions": {
    "module": "esnext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "skipLibCheck": true
  }
}
```

---

## 5. Evolusi Perintah CLI

| Alur Kerja | Perintah Prisma 8 | Penjelasan |
|---|---|---|
| **Emit Artefak** | `bun x prisma contract emit` | Mengompilasi `contract.prisma` menjadi `contract.json` dan `contract.d.ts`. |
| **Inisialisasi Database** | `bun x prisma db init` | Membuat tabel awal di PostgreSQL dan menandatangani contract hash. |
| **Update DB (Dev)** | `bun x prisma db update` | Mengaplikasikan perubahan contract ke database saat development. |
| **Rencana Migrasi** | `bun x prisma migration plan` | Membuat rencana migrasi baru di folder `migrations/`. |
| **Terapkan Migrasi** | `bun x prisma db migrate` | Menjalankan migrasi terencana ke database produksi. |

---

## 6. Panduan Query Modern (Dual Query Lanes)

### A. ORM Lane (`db.orm`)
ORM Lane adalah cara default untuk operasi CRUD dengan relasi:

#### 1. Membaca Data (Read)
```typescript
import { db } from './src/prisma/db';

// Cari 1 berdasarkan primary key shorthand
const user = await db.orm.public.User.first({ id: 'user-uuid' });

// Cari 1 dengan filter predicate
const alice = await db.orm.public.User
  .where((u) => u.email.eq('alice@example.com'))
  .first();

// Cari banyak dengan seleksi kolom, sort, dan pagination
const users = await db.orm.public.User
  .where((u) => u.role.eq('STUDENT'))
  .select('id', 'email', 'fullName')
  .orderBy((u) => u.createdAt.desc())
  .limit(10)
  .offset(0)
  .all();
```

#### 2. Eager-Loading Relasi (`.include`)
```typescript
// Muat relasi posts dengan filter dan sort pada relasi tersebut
const usersWithPosts = await db.orm.public.User
  .include('posts', (post) =>
    post
      .select('id', 'title', 'createdAt')
      .orderBy((p) => p.createdAt.desc())
      .limit(5)
  )
  .all();

// Relasi Reducer: Hitung jumlah post tanpa memuat semua baris
const usersWithPostCount = await db.orm.public.User
  .include('posts', (posts) => posts.count())
  .all();
```

#### 3. Penulisan Data (Create, Update, Delete)
```typescript
// Create single
const newUser = await db.orm.public.User.create({
  email: 'john@example.com',
  fullName: 'John Doe',
});

// Create many
await db.orm.public.User.createAll([
  { email: 'user1@example.com' },
  { email: 'user2@example.com' },
]);

// Update
await db.orm.public.User
  .where({ id: 'user-uuid' })
  .update({ fullName: 'Johnathan Doe' });

// Delete
await db.orm.public.User
  .where({ id: 'user-uuid' })
  .delete();

// Upsert
await db.orm.public.User.upsert({
  create: { id: 'user-uuid', email: 'john@example.com', fullName: 'John' },
  update: { fullName: 'John Updated' },
});
```

#### 4. Transaksi Atomik (`db.transaction`)
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

### B. SQL Builder Lane (`db.sql`)
Digunakan jika Anda membutuhkan query SQL dengan kontrol penuh (JOIN kustom, ekspresi matematika, window functions) tanpa kehilangan type-safety:

```typescript
// Membangun rencana query (Plan)
const plan = db.sql.public.users
  .select('id', 'email')
  .where((f, fns) => fns.eq(f.email, 'alice@example.com'))
  .limit(1)
  .build();

// Eksekusi query plan yang mengembalikan baris
const rows = await db.runtime().query(plan);

// Eksekusi mutation plan (mengembalikan affectedRows)
const deletePlan = db.sql.public.users
  .delete()
  .where((f, fns) => fns.eq(f.id, 'user-id'))
  .build();
const { affectedRows } = await db.runtime().execute(deletePlan);
```

---

### C. Raw SQL & Driver Execution (pgvector)
Untuk ekstensi database khusus seperti **pgvector** (`vector(1536)` dan operator distance `<=>`):

```typescript
const conn = await db.connect();

// 1. Eksekusi DDL / Migrasi Ekstensi
await (conn as any).driver.execute({
  sql: 'CREATE EXTENSION IF NOT EXISTS vector;',
});

// 2. Query Similarity Vector Terisolasi Tenant
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

## 7. Penanganan Tanggal & Waktu: ECMAScript Temporal API

Prisma 8 mengadopsi standar **ECMAScript Temporal** untuk kolom `DateTime` (`timestamptz`).

### ❌ Kesalahan yang Sering Terjadi:
Mengirimkan JavaScript `new Date()` langsung ke method Prisma 8:
```typescript
// ERROR: RUNTIME.ENCODE_FAILED: Codec 'pg/timestamptz-temporal@1' encodes a Temporal.Instant, but received a Date.
await db.orm.public.Subscription.create({
  currentPeriodStart: new Date(),
});
```

###  Cara yang Benar:
Gunakan `Temporal.Instant`:
```typescript
// Waktu saat ini:
const now = Temporal.Now.instant();

// Konversi dari Date / ISO String:
const start = Temporal.Instant.from(new Date().toISOString());

await db.orm.public.Subscription.create({
  currentPeriodStart: start,
  currentPeriodEnd: Temporal.Instant.from(endDate.toISOString()),
});
```

---

## 8. Pola Integrasi NestJS & Adapter Facade

Agar aplikasi NestJS yang telah ada dapat bermigrasi ke Prisma 8 tanpa menulis ulang ratusan method di berbagai service, gunakan pola **Adapter Facade** di `src/modules/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { db } from '../../prisma/db';

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
    if (val !== null && typeof val === 'object' && !(val instanceof Date) && !('epochMilliseconds' in val)) {
      const ops = val as Record<string, any>;
      for (const [op, opVal] of Object.entries(ops)) {
        const normalizedVal = normalizeInput(opVal);
        if (op === 'gte') q = q.where((m: any) => m[key].gte(normalizedVal));
        else if (op === 'lte') q = q.where((m: any) => m[key].lte(normalizedVal));
        else if (op === 'gt') q = q.where((m: any) => m[key].gt(normalizedVal));
        else if (op === 'lt') q = q.where((m: any) => m[key].lt(normalizedVal));
        else if (op === 'in') q = q.where((m: any) => m[key].in(normalizedVal));
        else if (op === 'not') q = q.where((m: any) => m[key].neq(normalizedVal));
        else if (op === 'equals') q = q.where((m: any) => m[key].eq(normalizedVal));
      }
    } else {
      q = q.where((m: any) => m[key].eq(normalizeInput(val)));
    }
  }
  return q;
}

export function createModelAdapter(ormModel: any) {
  return {
    async findUnique(args: { where: any; include?: any }) {
      return applyWhere(ormModel, args.where).first();
    },
    async findFirst(args: { where?: any; orderBy?: any; include?: any } = {}) {
      return applyWhere(ormModel, args.where).first();
    },
    async findMany(args: { where?: any; orderBy?: any; take?: number; skip?: number } = {}) {
      let q = applyWhere(ormModel, args.where);
      if (args.take) q = q.limit(args.take);
      if (args.skip) q = q.offset(args.skip);
      return q.all();
    },
    async create(args: { data: any }) {
      return ormModel.create(normalizeInput(args.data));
    },
    async update(args: { where: any; data: any }) {
      return applyWhere(ormModel, args.where).update(normalizeInput(args.data));
    },
    async delete(args: { where: any }) {
      return applyWhere(ormModel, args.where).delete();
    },
    async count(args: { where?: any } = {}) {
      const res = await applyWhere(ormModel, args.where).aggregate((a: any) => ({ count: a.count() }));
      return res?.count ?? 0;
    },
  };
}

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  public readonly db = db;
  public readonly orm = db.orm;

  public readonly user = createModelAdapter(db.orm.public.User);
  public readonly post = createModelAdapter(db.orm.public.Post);

  async onModuleInit() {
    await db.connect();
  }

  async onModuleDestroy() {
    await db.close();
  }

  async $transaction<T>(fn: (tx: any) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      const txFacade = {
        user: createModelAdapter(tx.orm.public.User),
        post: createModelAdapter(tx.orm.public.Post),
      };
      return fn(txFacade);
    });
  }
}
```

---

## 9. Troubleshooting & Solusi Error Umum

### 1. `RUNTIME.ENCODE_FAILED: Codec 'pg/timestamptz-temporal@1' encodes a Temporal.Instant, but received a Date`
- **Penyebab**: Mengirim objek `Date` JavaScript native ke kolom bertipe DateTime.
- **Solusi**: Gunakan `Temporal.Instant.from(date.toISOString())` atau gunakan helper `normalizeInput`.

### 2. `RUNTIME.ITERATOR_CONSUMED`
- **Penyebab**: Mengonsumsi hasil `.all()` lebih dari satu kali (`await result` dua kali).
- **Solusi**: Simpan hasil pertama ke dalam variabel array dan gunakan kembali variabel tersebut.

### 3. `TS2307: Cannot find module '@prisma/orm-postgres/runtime'`
- **Penyebab**: `moduleResolution` di `tsconfig.json` masih bernilai `"node"`.
- **Solusi**: Ubah ke `"moduleResolution": "bundler"` dan `"module": "esnext"`.

### 4. `type "public.UserRole" does not exist`
- **Penyebab**: Enum PostgreSQL belum terdaftar saat inisialisasi awal.
- **Solusi**: Jalankan `bun x prisma db init` atau pastikan enum dibuat melalui migrasi.

---

## 10. Checklist untuk Pengembang & AI Agent

- [ ] Pastikan tidak ada dependensi atau impor `@prisma/client`.
- [ ] Pastikan `prisma.config.ts` ada dan menggunakan `definePrismaConfig`.
- [ ] Gunakan `temporal.updatedAt()` di `contract.prisma`.
- [ ] Jalankan `bun x prisma contract emit` setiap kali `contract.prisma` diubah.
- [ ] Akses model PostgreSQL melalui namespace: `db.orm.public.<Model>`.
- [ ] Jangan gunakan operator `.between()`. Gunakan chaining `.where()`.
- [ ] Konversi nilai waktu ke `Temporal.Instant` sebelum dikirim ke database.
- [ ] Gunakan `db.transaction(async (tx) => { ... })` untuk operasi atomik.
- [ ] Jalankan `bun x tsc --noEmit` untuk memverifikasi type-safety secara berkala.
