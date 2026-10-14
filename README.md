# EduRAG: RAG SaaS Platform for Educators & Content Creators

Platform **Multi-Tenant RAG-as-a-Service** modern berskala enterprise untuk Edukator dan Kreator konten. Dibangun dengan arsitektur canggih:
- **Backend**: [NestJS 12](https://nestjs.com/) + [Prisma 8](https://www.prisma.io/) (`@prisma/orm-postgres`)
- **Database & Vektor**: [PostgreSQL 16](https://www.postgresql.org/) dengan ekstensi `pgvector`
- **Asynchronous Task Queue**: [BullMQ](https://bullmq.io/) + [Redis](https://redis.io/)
- **AI & RAG Engine**: [Transformers.js](https://huggingface.co/docs/transformers.js/) menjalankan model Hugging Face di browser pengguna (WebGPU / WASM), tanpa API key. Jika percobaan perangkat gagal, aplikasi otomatis memakai model Ollama di server. API eksternal tetap opsional melalui konfigurasi administrator.
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
- **Asynchronous Ingestion Pipeline**: Dokumen PDF/CSV diproses asinkron oleh worker BullMQ (`IngestionProcessor`), dibagi menjadi chunks (600 karakter, overlap 100 karakter), lalu di-embed oleh browser kreator. Vektor diisi nol hingga 1536 dimensi agar kompatibel dengan skema pgvector yang ada.

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
│   │   └── ingestion.processor.ts  # BullMQ Worker ekstraksi dokumen & chunking
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
- **Bun** (v1.3+) untuk menjalankan backend, seeder, dan tes. **Node.js** (v20+) dapat digunakan untuk tool npm dan build frontend.
- **Docker & Docker Compose** (untuk PostgreSQL pgvector & Redis)
- **Git**

---

### 2. Jalankan Database & Redis via Docker
Buka terminal di root direktori proyek, jalankan:
```bash
docker compose up -d
```
Container yang akan berjalan:
- `rag_postgres_vector` pada port `5433`
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
DATABASE_URL="postgresql://postgres:postgres@localhost:5433/rag_creator_platform?schema=public"
REDIS_HOST=localhost
REDIS_PORT=6379

JWT_SECRET=super_secret_jwt_key_for_rag_creator_platform_at_least_32_chars
JWT_EXPIRES_IN=7d

# Komputasi AI di browser masing-masing pengguna, tanpa API key
AI_EXECUTION=browser

# Persentase Bagi Hasil Platform
PLATFORM_COMMISSION_PERCENT=20

# Xendit API Keys (Opsional untuk testing sandbox pembayaran)
XENDIT_SECRET_KEY=xnd_development_...
XENDIT_WEBHOOK_VERIFICATION_TOKEN=webhook_token_...
```

---

### AI di perangkat pengguna (default)

`AI_EXECUTION=browser` adalah default, termasuk ketika variabel ini tidak diisi. Aplikasi mencoba komputasi perangkat pengguna dahulu: Qwen3 pada WebGPU → Qwen3 pada CPU → SmolLM2 135M pada CPU. Perpindahan dilakukan setelah percobaan nyata gagal atau tidak memberi kemajuan selama empat menit; unduhan/token yang masih berjalan memperpanjang waktu tunggu. Kegagalan unduhan memakai server untuk permintaan tersebut tanpa menandai perangkat tidak mampu. Jika seluruh percobaan perangkat gagal, permintaan berikutnya dalam tab itu memakai server sampai pengguna mencoba perangkat kembali.

Pengguna tidak perlu memasang aplikasi AI, mengisi API key, atau memiliki akun Hugging Face. Model publik diunduh saat pertama dipakai dan disimpan dalam cache browser. Hugging Face digunakan untuk unduhan model; saat fallback, konteks pertanyaan/PDF diproses oleh backend dan provider server yang dikonfigurasi. Tidak ada dialog persetujuan untuk perpindahan model.

- **Chat murid:** browser menghitung embedding pertanyaan; server memeriksa langganan/hak akses lalu mencari konteks sesuai kreator dan kursus. Browser menghasilkan jawaban menggunakan model lokal. Server menyimpan jawaban dan menghitung estimasi kuota dari teks, tanpa mempercayai angka token kiriman klien. Pengiriman ulang hasil yang sama tidak dipotong dua kali.
- **Fallback chat:** `/chat/server-fallback` hanya menerima ID pertanyaan yang sudah disiapkan server. Server memeriksa pemilik dan langganan, memakai prompt tersimpan, serta menggabungkan retry bersamaan. Inferensi fallback berjalan satu per satu untuk membatasi pemakaian RAM. Jawaban dan kuota disimpan dalam satu transaksi.
- **Sumber dan kredit:** pemeriksaan kata/angka terhadap sumber menolak jawaban yang tidak cukup didukung; UI menyediakan kutipan yang dapat dibuka. Ini pemeriksaan leksikal, bukan bukti kebenaran semantik. Jika jawaban gagal pemeriksaan, kredit rendah, atau server juga gagal, aplikasi menampilkan kutipan materi tanpa biaya token. Embedding perangkat yang gagal memakai pencarian kata kunci; dokumen tetap tersimpan dan indeks bisa dilanjutkan.
- **Upload materi kreator:** server hanya mengekstrak PDF/CSV/TXT dan membagi teks. Browser kreator menghitung embedding secara bertahap dan mengirim vektornya untuk disimpan di pgvector. Selama embedding belum selesai, status dokumen PENDING. Tetap buka halaman sampai selesai; tombol **Indeks di perangkat** dapat melanjutkan pekerjaan setelah tab ditutup atau unduhan gagal.
- **Silabus PDF:** server mengekstrak teks dan menyiapkan prompt, browser kreator menulis Markdown. Aplikasi menyusun heading menjadi modul dan lesson, menjaga code block, lalu memeriksa materi sebelum menampilkan draf untuk ditinjau dan disimpan. Model tidak perlu menghasilkan JSON yang kompleks. Mode browser mengambil sampel maksimal 6.000 karakter dari awal, tengah, dan akhir PDF.
- **Fallback PDF:** konteks ditandatangani server, terikat pada kreator, dan berlaku 30 menit. Server menghasilkan Markdown ketika model perangkat gagal. Materi yang gagal pemeriksaan sumber menjadi kutipan PDF untuk disunting. Hasil selalu draf privat; penerbitan melalui builder memerlukan peninjauan eksplisit. Tombol batal menghentikan worker atau request server; cache AI bisa dihapus tanpa menghapus draf/dokumen.

Model bahasa: [Qwen3 0.6B ONNX](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX), kuantisasi 4-bit untuk WebGPU dan 8-bit untuk WASM di CPU. Model embedding: [multilingual MiniLM](https://huggingface.co/Xenova/paraphrase-multilingual-MiniLM-L12-v2), 384 dimensi. Vektor diisi nol hingga 1536 dimensi agar skema database tetap kompatibel. Keduanya dimuat dalam Web Worker agar antarmuka tetap responsif. WebGPU digunakan jika tersedia; perangkat tanpa WebGPU memakai WASM di CPU dan dapat jauh lebih lambat. Unduhan bobot model bahasa sekitar 483 MB pada WebGPU dengan shader-f16 dan 617 MB pada CPU; kebutuhan memori saat inference lebih besar dari ukuran unduhan. Untuk deployment, gunakan HTTPS; localhost juga merupakan konteks aman. Browser memerlukan akses internet untuk unduhan pertama dan cache tetap tersedia untuk pemakaian berikutnya. Cache dapat dibersihkan oleh browser; aplikasi serta pencarian data tetap membutuhkan backend.

Model kecil dapat salah menjelaskan fakta atau mengabaikan instruksi format. Draf silabus tetap perlu ditinjau edukator. Prompt browser dibuat ringkas dan output dibatasi agar lebih sesuai dengan kemampuan perangkat pengguna. Pada pengujian CPU tanpa WebGPU, jawaban contoh selesai sekitar 110 detik dan rangkaian chat serta draf sekitar 197 detik; ini hasil satu mesin, bukan jaminan kecepatan semua perangkat.

**Dokumen lama:** gunakan **Indeks di perangkat** untuk menghasilkan embedding browser dari chunks yang sudah tersimpan, tanpa mengunggah ulang file. Selama belum diindeks, dokumen lama tetap bisa dicari lewat kata kunci. Vektor model lama tidak dibandingkan dengan vektor model browser. Tidak ada migrasi atau penghapusan data otomatis.

**Kepercayaan data:** jawaban dan embedding dihitung di perangkat klien, sehingga server memvalidasi ukuran/tipe, kepemilikan dokumen, konteks permintaan, dan langganan. Server tidak dapat membuktikan bahwa hasil klien benar-benar berasal dari model. Jawaban chat disimpan untuk pemilik sesi; draf silabus tetap ditinjau kreator sebelum diterbitkan.

**Server fallback wajib disiapkan:** instal Ollama di mesin backend dan jalankan:

```bash
ollama serve
# Di terminal lain:
ollama pull qwen3:1.7b
ollama pull embeddinggemma
bun run verify:server-ai
```

Default `SERVER_FALLBACK_PROVIDER=ollama` dan `SERVER_FALLBACK_MODEL=qwen3:1.7b` tidak membutuhkan token atau biaya API LLM. Infrastruktur/komputasi server tetap memakai sumber daya. Pastikan Ollama berjalan sebagai layanan pada host deployment; `localhost:11434` harus menunjuk mesin backend, bukan perangkat siswa. Skrip verifikasi wajib berhasil sebelum deployment: ia menjalankan inference nyata, menguji jalur API dengan gateway bertoken ke model nyata (termasuk penolakan 401), dan embedding Ollama. Gateway ini tidak membuktikan keabsahan kredensial provider komersial. Jika fallback dikonfigurasi ke API eksternal, panggilan pertama skrip langsung memverifikasi provider tersebut.

**Inferensi utama di server opsional:** administrator dapat mengaktifkan `AI_EXECUTION=server`. Untuk API eksternal sebagai fallback, isi `SERVER_FALLBACK_PROVIDER=openai`, `SERVER_FALLBACK_MODEL`, `OPENAI_BASE_URL`, dan `OPENAI_API_KEY` (atau `GROQ_API_KEY`). Untuk inferensi utama API:

```env
AI_EXECUTION=server
LLM_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=isi_key_provider
LLM_MODEL=gpt-4o-mini
EMBEDDING_PROVIDER=ollama
```

Groq juga didukung melalui endpoint OpenAI-compatible dan nama model/key yang sesuai. Embedding API terpisah dipilih dengan `EMBEDDING_PROVIDER=openai`, `EMBEDDING_BASE_URL`, `EMBEDDING_API_KEY`, dan `EMBEDDING_MODEL` (maksimal 1536 dimensi). Token hanya berada di backend. Token placeholder tidak mengalahkan token Groq yang valid. Provider berbayar dipakai hanya ketika administrator mengonfigurasi provider tersebut.

---

### 4. Instalasi Dependensi Backend
```bash
bun install
# atau menggunakan npm:
npm install
```

---

Uji perubahan provider AI dengan `npm run test:ai` (memerlukan Bun). Tes ini memakai respons tiruan sehingga tidak membutuhkan API key, unduhan model, atau database.

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

# Build dan jalankan hasil kompilasi untuk produksi (runtime Bun)
bun run build
bun run start:prod
```
Backend akan aktif di:
- **Base API**: `http://localhost:3000/api/v1`
- **Swagger API Docs**: `http://localhost:3000/api/docs`

---

### 7. Seed Database dengan Data Riil (Satu Perintah!)
Jalankan skrip seeder untuk mengisi akun, tier, kursus, materi, catatan, forum diskusi, dan pembayaran simulasi. Dokumen yang sudah ada pada akun kreator akan ditautkan ke kursus; unggah dokumen referensi melalui Creator Studio untuk database baru.

```bash
bun run seed
# atau
npm run seed
```

> **Data yang Dibuat Otomatis oleh Seeder**:
> - **Akun Creator**: `creator@edurag.com` (Password: `password123`)
> - **Akun Student**: `student@edurag.com` (Password: `password123`)
> - **Kursus**: *"Enterprise RAG Systems"*
> - **Modul & Materi**: 4 modul dengan 5 lesson bacaan/video/hybrid pada database baru
> - **Langganan Demo**: Siswa mendapat akses melalui order dan webhook simulasi ketika Xendit memakai konfigurasi sandbox
> - **Catatan Murid & Forum Diskusi**: Diskusi interaktif terisi riil

Seeder memeriksa status HTTP setiap mutasi dan gagal jika data tidak tersimpan. Menjalankannya ulang tidak menggandakan entitas demo. Skrip startup menggunakan Bun karena backend dikompilasi sebagai ESM dengan resolusi impor bundler.

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
# Tes provider, browser orchestration, keamanan, parser, kuota, dan runtime Prisma
bun run test:ai

# Build backend
bun run build

# Build frontend production bundle
cd frontend && bun run build

# Lint frontend (jalankan dari direktori frontend)
bun run lint
```

Prisma ORM dipatok ke `8.0.0-rc.11` agar kompatibel dengan toolchain CLI yang digunakan proyek. `temporal-polyfill/global` dimuat sebelum client Prisma untuk runtime yang belum menyediakan Temporal. Tidak ada perubahan skema database yang diperlukan untuk AI browser.

Catatan pengujian model nyata, PostgreSQL/Redis, pemulihan indeks, isolasi akses, dan pembayaran simulasi tersedia pada [docs/browser-ai-verification.md](docs/browser-ai-verification.md).

---

## 📄 Lisensi
Platform ini dikembangkan untuk kebutuhan RAG SaaS Edukator & Kreator berskala profesional. Hak Cipta dilindungi.
