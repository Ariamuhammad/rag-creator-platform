# EduRAG: RAG SaaS Platform for Educators & Content Creators

Platform **Multi-Tenant RAG-as-a-Service** modern berskala enterprise untuk Edukator dan Kreator konten. Dibangun dengan arsitektur canggih:
- **Backend**: [NestJS 12](https://nestjs.com/) + [Prisma 8](https://www.prisma.io/) (`@prisma/orm-postgres`)
- **Database & Vektor**: [PostgreSQL 16](https://www.postgresql.org/) dengan ekstensi `pgvector`
- **Asynchronous Task Queue**: [BullMQ](https://bullmq.io/) + [Redis](https://redis.io/)
- **AI & RAG Engine**: [LangChain](https://js.langchain.com/) + OpenAI (`text-embedding-3-small`, `gpt-4o-mini`) / Groq
- **Frontend**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/) + [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/)
- **Payment Gateway**: [Xendit](https://www.xendit.co/) (Invoice otomatis, Webhook split fee, Dompet Kreator & Penarikan Dana / Payout)

---

## 🌟 Fitur Utama Platform

### 1. 🎓 Interactive Classroom Workspace (Ruang Belajar Interaktif Murid)
- **3-Panel Ergonomic Layout**:
  - **Left Sidebar**: Navigasi silabus/kurikulum, indikator status selesai, dan **progres bar dinamis** yang ter-update secara riil ke database saat materi selesai.
  - **Center Canvas**: Pemutar video materi modern (otomatis mendeteksi YouTube Embed atau file video langsung/MP4), beralih otomatis ke tab *"Video Materi"*, mode hybrid (video + teks bacaan komprehensif), dan navigasi otomatis ke materi berikutnya.
  - **Right Panel (Notebook & AI Copilot)**: Editor catatan pribadi murid berformat Markdown (*auto-save*) + **AI Copilot** cerdas yang ter-grounding khusus pada materi kursus yang sedang dipelajari.
- **Forum Diskusi Kursus**: Tanya-jawab langsung per kursus dengan dukungan komentar bersarang (*threaded discussions*).

### 2. 🛠️ Creator Studio & Unified Curriculum Builder
- **Curriculum Builder Dual-View**: Visual tree editor dan live preview sekaligus.
- **Flexible Duration Parser**: Input durasi materi fleksibel (mendukung format angka murni misal `15` atau format teks misal `15 min`).
- **Media Support**: Tambahkan video YouTube, video URL, materi bacaan komprehensif Markdown, dan modul berjenjang.
- **Role-Based Access Control (RBAC)**: Murid tidak dapat mengakses dashboard atau data sensitif kreator.

### 3. 🧠 Multi-Tenant RAG & Vector Isolation
- **Metadata SQL Filtering**: Setiap pencarian kemiripan (*similarity search*) di pgvector wajib menyertakan filter metadata `{ creatorProfileId, courseId }` untuk menjamin **nol kebocoran data** antar-kreator maupun antar-kursus.
- **Asynchronous Ingestion Pipeline**: Dokumen PDF/CSV diproses asinkron oleh worker BullMQ (`IngestionProcessor`), dibagi menjadi chunks (600 token, overlap 100 token), lalu di-embed menjadi vektor 1536-dimensi.

### 4. 💳 Monetisasi, Ledger Kredit & Payment Gateway Xendit
- **Token Credit Ledger**: Setiap prompt & respons dipotong otomatis dari kuota bulanan murid dengan catatan audit transparan.
- **Xendit Payment Engine**: Pembuatan checkout invoice otomatis, webhook real-time saat pembayaran lunas (`PAID`).
- **Revenue Sharing & Creator Wallet**: Otomatis memotong komisi platform (misal: 20% platform, 80% kreator) langsung ke dompet digital kreator (`walletBalance`).
- **Creator Bank Payout**: Formulir rekening bank kreator dan penarikan saldo (*payout request*).

### 5. 🛡️ Keamanan & Guardrails
- **Anti-Prompt Injection & Jailbreak Guard**: Memblokir manipulasi prompt berbahaya.
- **PII Masking**: Otomatis mendeteksi dan menyamarkan data sensitif (email, nomor telepon, kartu kredit) sebelum dikirim ke LLM.

---

## 📁 Struktur Direktori

```text
rag-saas-educators/
├── docker-compose.yml              # Container PostgreSQL (pgvector) & Redis
├── .env.example                    # Template environment variables
├── package.json                    # Dependensi backend NestJS & script Prisma 8
├── tsconfig.json                   # Konfigurasi TypeScript backend
├── scripts/
│   └── seed-platform.ts           # Seeder data riil (Creator, Student, Kursus, Video, Catatan, Diskusi)
├── src/
│   ├── main.ts                     # Bootstrap NestJS & konfigurasi Swagger docs
│   ├── app.module.ts               # Root module
│   ├── prisma/
│   │   ├── contract.prisma         # Prisma 8 Data Contract
│   │   ├── contract.json           # Skema JSON hasil emit
│   │   └── contract.d.ts           # Definisi TypeScript Prisma 8
│   ├── common/
│   │   ├── guards/                 # TenantAccessGuard & OptionalJwtAuthGuard
│   │   └── middlewares/            # GuardrailsMiddleware (Anti-injection, PII)
│   ├── jobs/
│   │   └── ingestion.processor.ts  # BullMQ Worker pemroses dokumen & embedding
│   └── modules/
│       ├── auth/                   # JWT Authentication & role guards
│       ├── creators/               # Profil kreator, subscription tiers
│       ├── courses/                # Kursus, modul, materi pelajaran (Lessons) & progres murid
│       ├── notes/                  # Catatan Markdown murid per materi
│       ├── discussions/            # Thread forum diskusi & komentar kursus
│       ├── knowledge-base/         # Upload file materi & BullMQ producer
│       ├── rag-engine/             # Strict grounding RAG retrieval & LLM chain
│       ├── billing-credits/        # Token ledger, Xendit invoice, payout & dompet
│       └── chat/                   # RAG chat query & riwayat percakapan
└── frontend/                       # Aplikasi Client Modern (React 19 + Vite)
    ├── package.json                # Dependensi frontend
    ├── vite.config.ts              # Konfigurasi Vite & proxy API
    ├── src/
    │   ├── App.tsx                 # Root router & autentikasi frontend
    │   ├── components/
    │   │   ├── Header.tsx          # Navigasi, switcher akun demo & role
    │   │   ├── classroom/          # ClassroomWorkspace, LearningCanvas, Sidebar, Copilot
    │   │   ├── creator/            # CreatorStudio, UnifiedCurriculumBuilder
    │   │   ├── student/            # StudentView, MasterSyllabusView
    │   │   └── modals/             # XenditCheckoutModal, BankAccountModal, PayoutModal
    │   ├── services/
    │   │   └── api.ts              # API client ke backend NestJS
    │   └── types/                  # Definisi TypeScript
```

---

## 🚀 Panduan Langkah Menjalankan Aplikasi (Step-by-Step)

### 1. Prasyarat Sistem
Pastikan perangkat Anda telah terpasang:
- **Node.js** (v20+) atau **Bun** (v1.1+)
- **Docker & Docker Compose** (untuk PostgreSQL pgvector & Redis)
- **Git**

---

### 2. Jalankan Database & Redis via Docker
Buka terminal di root direktori proyek, jalankan:
```bash
docker compose up -d
```
Container yang akan berjalan:
- `rag_postgres_vector` pada port `5432`
- `rag_redis` pada port `6379`

> **Verifikasi Container**: Jalankan `docker ps` untuk memastikan kedua container berstatus *Up*.

---

### 3. Konfigurasi Environment (`.env`)
Salin file `.env.example` menjadi `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi pada `.env` (contoh default):
```env
PORT=3000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rag_creator_platform?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=super_secret_jwt_key_for_rag_creator_platform_at_least_32_chars
JWT_EXPIRES_IN=7d

# OpenAI API Key untuk Embedding & RAG Copilot (opsional untuk mode testing)
OPENAI_API_KEY=sk-proj-...

# Persentase Bagi Hasil Platform
PLATFORM_COMMISSION_PERCENT=20

# Xendit API Keys (Opsional untuk testing sandbox pembayaran)
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_VERIFICATION_TOKEN=webhook_token_...
```

---

### 4. Instalasi Dependensi Backend
```bash
bun install
# atau menggunakan npm:
npm install
```

---

### 5. Inisialisasi Database (Prisma 8)
Jalankan perintah berikut untuk meng-emit data contract dan menyelaraskan skema ke PostgreSQL:
```bash
# Emit kontrak Prisma 8
bun run prisma:emit

# Sinkronkan skema ke database PostgreSQL
bun run prisma:update
```

---

### 6. Jalankan Server Backend (NestJS)
Jalankan server backend:
```bash
# Menggunakan Bun (Sangat cepat):
bun run src/main.ts

# Atau menggunakan Nest CLI:
npm run start:dev
```
Backend akan aktif di:
- **Base API**: `http://localhost:3000/api/v1`
- **Swagger API Docs**: `http://localhost:3000/api/docs`

---

### 7. Seed Database dengan Data Riil (Satu Perintah!)
Jalankan skrip seeder untuk mengisi data lengkap (Akun Edukator, Akun Murid, Kursus AI, Video Materi, Dokumen, Catatan, dan Forum Diskusi):

```bash
bun run seed
# atau
npm run seed
```

> **Data yang Dibuat Otomatis oleh Seeder**:
> - **Akun Creator**: `creator@edurag.com` (Password: `password123`)
> - **Akun Student**: `student@edurag.com` (Password: `password123`)
> - **Kursus**: *"Mastering RAG Systems & Vector Database"*
> - **Modul & Video**: 3 Materi pelajaran lengkap dengan YouTube stream & hybrid markdown lecture
> - **Progress Belajar**: Status progres murid tersimpan
> - **Catatan Murid & Forum Diskusi**: Diskusi interaktif terisi riil

---

### 8. Jalankan Frontend (React + Vite)
Buka tab terminal baru, masuk ke folder `frontend` dan jalankan aplikasi:
```bash
cd frontend

# Install dependensi (jika baru pertama kali)
bun install
# atau: npm install

# Jalankan dev server frontend
bun run dev
# atau: npm run dev
```
Aplikasi frontend akan aktif di:
👉 **`http://localhost:5173`**

---

## 👥 Akun Demo & Alur Pengujian

Gunakan switcher akun di kanan atas navbar aplikasi frontend untuk berganti mode secara instan:

| Peran | Email | Password | Hak Akses & Fitur |
|---|---|---|---|
| **Edukator / Creator** | `creator@edurag.com` | `password123` | • Akses **Creator Studio**<br>• Kelola Kurikulum di **Curriculum Builder**<br>• Tambah/Edit Video & Modul Materi<br>• Cek Saldo Dompet & Rekening Bank |
| **Murid / Student** | `student@edurag.com` | `password123` | • Akses **Classroom Workspace** (3-Panel)<br>• Tonton Video & Baca Materi Pelajaran<br>• Simpan Catatan Pribadi (Markdown)<br>• Berinteraksi dengan **Course RAG AI Copilot**<br>• Ikut serta dalam Forum Diskusi Kursus |

---

## 🛠️ Ringkasan Endpoint API Utama

Dokumentasi lengkap dan antarmuka uji interaktif tersedia di **Swagger UI**: [`http://localhost:3000/api/docs`](http://localhost:3000/api/docs).

### Autentikasi
- `POST /api/v1/auth/register` : Pendaftaran pengguna baru (`CREATOR` atau `STUDENT`)
- `POST /api/v1/auth/login` : Autentikasi login & generate JWT token

### Kursus & Pembelajaran
- `GET /api/v1/courses/public` : Daftar seluruh kursus yang dipublikasikan
- `GET /api/v1/courses/:id` : Detail lengkap kursus beserta silabus modul dan materinya
- `POST /api/v1/courses` : Buat kursus baru (Khusus Creator)
- `POST /api/v1/courses/:id/modules` : Buat modul pelajaran baru
- `POST /api/v1/courses/:id/modules/:moduleId/lessons` : Tambah materi video/bacaan baru
- `POST /api/v1/courses/:id/enroll` : Pendaftaran murid ke kursus
- `POST /api/v1/courses/:id/progress` : Simpan progres penyelesaian materi murid

### Catatan & Forum Diskusi
- `GET /api/v1/notes/:lessonId` : Ambil catatan pribadi murid pada materi tertentu
- `POST /api/v1/notes/:lessonId` : Simpan / auto-save catatan markdown murid
- `GET /api/v1/discussions/courses/:courseId` : Daftar pertanyaan dan diskusi pada kursus
- `POST /api/v1/discussions/courses/:courseId` : Kirim pertanyaan diskusi baru
- `POST /api/v1/discussions/threads/:id/comments` : Balas diskusi (*threaded reply*)

### Knowledge Base & RAG Copilot
- `POST /api/v1/knowledge-base/upload` : Upload dokumen referensi RAG (PDF / CSV)
- `GET /api/v1/knowledge-base/documents/:id/status` : Monitor status parsing & embedding vektor
- `POST /api/v1/chat/query` : Query ke RAG Copilot (terisolasi per kursus & aman dari prompt injection)

### Pembayaran & Dompet (Xendit)
- `POST /api/v1/billing/create-invoice` : Buat link pembayaran Xendit Invoice
- `POST /api/v1/billing/xendit-webhook` : Webhook handler penerimaan pembayaran
- `GET /api/v1/billing/creator/wallet` : Cek saldo dompet kreator
- `PATCH /api/v1/billing/creator/bank-account` : Simpan nomor rekening bank kreator
- `POST /api/v1/billing/creator/payout-request` : Permintaan penarikan dana kreator

---

## 🧪 Validasi & Pengujian

Untuk memastikan kualitas kode dan keandalan sistem:
```bash
# Build backend
bun run build

# Build frontend production bundle
cd frontend && bun run build
```

---

## 📄 Lisensi
Platform ini dikembangkan untuk kebutuhan RAG SaaS Edukator & Kreator berskala profesional. Hak Cipta dilindungi.
