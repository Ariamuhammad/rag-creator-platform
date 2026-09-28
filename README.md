# RAG-as-a-Service for Creators/Educators (Monetized Knowledge Base Platform)

Enterprise Multi-Tenant Backend Platform berbasis **NestJS 12** dan **Prisma 8** dengan **PostgreSQL + pgvector**, **BullMQ + Redis**, dan **LangChain**.

Platform ini memungkinkan Influencer, Edukator, dan Content Creator mengunggah materi privat (PDF, CSV, Transkrip) dan menjual akses langganan (*subscription*) kepada murid/pengikut mereka untuk berinteraksi dengan AI Copilot berbasis RAG dengan isolasi data terjamin dan penagihan kuota token berbasis *Token Credit Ledger*.

---

## Fitur Utama Arsitektur

1. **Multi-Tenant Vector Isolation**:
   - Setiap similarity search di pgvector wajib menyertakan filter metadata `{ creatorProfileId: string }` pada level SQL untuk menjamin tidak ada kebocoran data antar-kreator.
2. **Asynchronous Ingestion Pipeline**:
   - Upload dokumen diunggah dan langsung dikembalikan dengan status `PENDING`.
   - BullMQ Worker (`IngestionProcessor`) mengekstraksi teks (PDF/CSV), membagi menjadi *chunks* (600 token, overlap 100 via `RecursiveCharacterTextSplitter`), menghasilkan embedding vektor 1536 dimensi, dan menyimpannya ke `document_chunks`.
3. **Token Credit Ledger System**:
   - Setiap interaksi chat RAG menghitung penggunaan token (*prompt* + *completion*).
   - Penggunaan dicatat ke tabel `credit_ledgers` dan didebit langsung dari sisa kuota bulanan murid.
4. **Subscription & Commission Engine**:
   - Kreator dapat membuat berbagai tier langganan.
   - Sistem secara otomatis memotong komisi platform (misal: 20% platform, 80% kreator) pada setiap transaksi.
5. **Security & Guardrails**:
   - `TenantAccessGuard`: Memverifikasi kepemilikan kreator atau status langganan aktif murid sebelum mengizinkan query.
   - `GuardrailsMiddleware`: Memfilter serangan *prompt injection* / *jailbreak* dan melakukan masking terhadap data sensitif (*PII Masking* seperti email, nomor telepon, dan kartu kredit).

---

## Struktur Direktori Proyek

```
rag-saas-educators/
├── docker-compose.yml           # PostgreSQL (pgvector) & Redis containers
├── .env.example                 # Template konfigurasi environment
├── .env                         # Konfigurasi environment lokal
├── package.json                 # Dependensi proyek
├── tsconfig.json                # Konfigurasi TypeScript
├── nest-cli.json                # Konfigurasi NestJS CLI
├── prisma/
│   └── schema.prisma            # Skema database Prisma 8 lengkap
├── src/
│   ├── main.ts                  # Bootstrap aplikasi & Swagger docs
│   ├── app.module.ts            # Root module & middleware bindings
│   ├── common/
│   │   ├── guards/
│   │   │   └── tenant-access.guard.ts     # Guard isolasi tenant & langganan
│   │   └── middlewares/
│   │       └── guardrails.middleware.ts   # Anti-prompt injection & PII masking
│   ├── jobs/
│   │   └── ingestion.processor.ts         # BullMQ worker untuk parsing & embedding
│   └── modules/
│       ├── prisma/              # PrismaService global & pgvector helper
│       ├── auth/                # JWT auth, register, login, roles guard
│       ├── creators/            # Manajemen profil kreator, tier, slug
│       ├── knowledge-base/      # Upload dokumen & BullMQ producer
│       ├── rag-engine/          # Strict grounding RAG retrieval & LLM chain
│       ├── billing-credits/     # Token usage ledger & subscription split
│       └── chat/                # RAG Copilot query & riwayat sesi chat
└── README.md
```

---

## Langkah Menjalankan Aplikasi (Step-by-Step)

### 1. Prasyarat
- **Node.js**: v18+ atau v20+
- **Docker & Docker Compose**: Untuk PostgreSQL dengan pgvector dan Redis.

### 2. Jalankan PostgreSQL (pgvector) & Redis
Jalankan container database dan cache queue dengan satu perintah:
```bash
docker compose up -d
```
Container yang akan aktif:
- `rag_postgres_vector` pada port `5432`
- `rag_redis` pada port `6379`

### 3. Konfigurasi File `.env`
Pastikan file `.env` sudah sesuai:
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_creator_platform?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=super_secret_jwt_key_for_rag_creator_platform_at_least_32_chars
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=sk-... # Masukkan OpenAI API Key atau biarkan untuk mode testing fallback
GROQ_API_KEY=gsk-... # Opsional: jika menggunakan Groq Llama-3.3-70b
PLATFORM_COMMISSION_PERCENT=20
```

### 4. Instalasi Dependensi
```bash
npm install
```

### 5. Eksekusi Migrasi Prisma
Generate client dan jalankan migrasi database ke PostgreSQL:
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 6. Jalankan Aplikasi
Jalankan server dalam mode development:
```bash
npm run start:dev
```
Aplikasi akan aktif di:
- **Base API**: `http://localhost:3000/api/v1`
- **Swagger Interactive API Documentation**: `http://localhost:3000/api/docs`

---

## Alur Pengujian End-to-End via Swagger / API

1. **Registrasi Akun Kreator**:
   - `POST /api/v1/auth/register`
   - Body:
     ```json
     {
       "email": "creator@expert.com",
       "password": "Password123!",
       "fullName": "Dr. Andrew Ng",
       "role": "CREATOR",
       "slug": "andrew-ng",
       "displayName": "Andrew Ng AI Academy"
     }
     ```
   - Salin `accessToken` dan `creatorProfile.id`.

2. **Buat Subscription Tier**:
   - `POST /api/v1/creators/tiers` (Gunakan Bearer Token Kreator)
   - Body:
     ```json
     {
       "name": "VIP Scholar Plan",
       "description": "Full access to AI Copilot and 500,000 token credits",
       "price": 49.00,
       "monthlyCreditQuota": 500000
     }
     ```
   - Catat `tierId` yang dihasilkan.

3. **Unggah Dokumen Materi Privat (PDF/CSV)**:
   - `POST /api/v1/knowledge-base/upload` (Gunakan Bearer Token Kreator)
   - Form-Data:
     - `file`: Pilih file PDF atau CSV materi.
     - `title`: "Deep Learning Specialization Notes.pdf"
   - Cek status pemrosesan asinkron via `GET /api/v1/knowledge-base/documents/{id}/status` hingga berstatus `COMPLETED`.

4. **Registrasi Akun Murid (Student)**:
   - `POST /api/v1/auth/register`
   - Body:
     ```json
     {
       "email": "student@student.com",
       "password": "Password123!",
       "fullName": "Budi Santoso",
       "role": "STUDENT"
     }
     ```
   - Salin `accessToken` Murid.

5. **Murid Berlangganan ke Kreator**:
   - `POST /api/v1/billing/subscribe` (Gunakan Bearer Token Murid)
   - Body:
     ```json
     {
       "creatorProfileId": "<CREATOR_PROFILE_ID>",
       "tierId": "<TIER_ID>"
     }
     ```
   - Sistem akan mengalokasikan kuota kredit token (500.000) dan menghitung bagi hasil komisi platform (20%).

6. **Interaksi dengan RAG Copilot**:
   - `POST /api/v1/chat/query` (Gunakan Bearer Token Murid)
   - Body:
     ```json
     {
       "creatorProfileId": "<CREATOR_PROFILE_ID>",
       "message": "Jelaskan konsep backpropagation dari materi yang ada."
     }
     ```
   - Response mengembalikan jawaban yang *grounded*, potongan sumber context (`sources`), dan jumlah token yang otomatis dipotong dari kuota murid (`credits.remainingCredits`).

7. **Audit Penggunaan Kredit**:
   - `GET /api/v1/billing/history/<CREATOR_PROFILE_ID>` untuk melihat catatan audit transaksi token ledger.

8. **Alur Pembayaran Nyata via Xendit & Dompet Kreator (Pendekatan 2)**:
   - **Student Buat Invoice Xendit**: `POST /api/v1/billing/create-invoice`
     ```json
     {
       "creatorProfileId": "<CREATOR_PROFILE_ID>",
       "tierId": "<TIER_ID>"
     }
     ```
     Menghasilkan link checkout Xendit (`invoiceUrl`) dengan kalkulasi otomatis 20% platform fee dan 80% hak kreator.
   - **Simulasi/Callback Webhook Xendit**: `POST /api/v1/billing/xendit-webhook` (header `x-callback-token`)
     Saat berstatus `PAID`, sistem mengaktifkan langganan murid, menambah kuota token, dan mendepositkan 80% ke dompet kreator (`walletBalance`).
   - **Kreator Atur Rekening Bank**: `PATCH /api/v1/billing/creator/bank-account`
     ```json
     {
       "bankName": "BCA",
       "bankAccountNumber": "1234567890",
       "bankAccountHolderName": "Nama Kreator"
     }
     ```
   - **Kreator Cek Saldo Dompet**: `GET /api/v1/billing/creator/wallet`
   - **Kreator Tarik Dana (Payout)**: `POST /api/v1/billing/creator/payout-request`
     ```json
     {
       "amount": 100000,
       "notes": "Penarikan hasil langganan murid"
     }
     ```
   - **Histori Penarikan**: `GET /api/v1/billing/creator/payouts`

