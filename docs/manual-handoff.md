# Langkah yang memerlukan akses pemilik atau host deployment

Ollama, Qwen3 1.7B, EmbeddingGemma, dan inference browser sudah diuji pada laptop pengembangan. Tidak perlu membuat token LLM untuk memakai konfigurasi default. Bagian berikut hanya diperlukan ketika memakai host lain, provider komersial, atau perangkat nyata yang belum tersedia untuk pengujian.

## 1. Menyiapkan host backend yang akan digunakan pengguna

Host/domain dan akses deployment belum diberikan. Pemilik perlu menentukan host atau memberikan akses melalui fasilitas kredensial/remote yang aman. Setelah akses tersedia, pemasangan, konfigurasi layanan, dan verifikasi dapat dilanjutkan oleh Codex; tidak perlu mengerjakan seluruh deployment sendiri.

Jika menyiapkan sendiri:

1. Checkout branch perubahan pada host backend. Pasang Bun dan dependensi proyek menggunakan `bun install --frozen-lockfile`; jalankan perintah yang sama di direktori `frontend`.
2. Pasang Ollama mengikuti [panduan Linux](https://docs.ollama.com/linux) atau [panduan Windows](https://docs.ollama.com/windows). Pada Linux yang sudah memiliki unit layanan Ollama, jalankan `sudo systemctl enable --now ollama`. Pada Windows jalankan aplikasi Ollama; API default tersedia pada `localhost:11434`.
3. Pada host Ollama, unduh model dan periksa daftar:

   ```sh
   ollama pull qwen3:1.7b
   ollama pull embeddinggemma
   ollama list
   ```

4. Edit environment backend yang sudah ada; pertahankan konfigurasi database, Redis, JWT, dan pembayaran. Jika host baru belum memiliki environment, gunakan `.env.example` sebagai dasar. Konfigurasi AI default:

   ```env
   AI_EXECUTION=browser
   SERVER_FALLBACK_PROVIDER=ollama
   SERVER_FALLBACK_MODEL=qwen3:1.7b
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_LLM_MODEL=qwen3:1.7b
   OLLAMA_EMBEDDING_MODEL=embeddinggemma
   ```

   `localhost` benar jika backend dan Ollama berjalan pada host/network namespace yang sama. Jika backend berada di container atau Ollama di host berbeda, isi alamat privat yang dapat dijangkau backend. Compose proyek saat ini hanya menyediakan PostgreSQL dan Redis. Batasi akses Ollama pada backend/jaringan privat; [FAQ Ollama](https://docs.ollama.com/faq) menjelaskan binding dan konfigurasi layanan.

5. Dari root proyek, jalankan:

   ```sh
   bun run verify:server-ai
   bun run test:ai
   bun run build
   ```

   Verifikasi server harus exit code 0 dan menampilkan keberhasilan inference fallback, autentikasi gateway API, serta embedding. Jika gagal, periksa layanan Ollama, alamat endpoint, dan hasil `ollama list` sebelum melanjutkan deployment.

6. Jalankan backend melalui `bun run start:prod` pada process manager/layanan host dengan restart otomatis. Bangun frontend menggunakan `bun run build` dari direktori `frontend` dan sajikan `frontend/dist` melalui HTTPS. Reverse proxy harus meneruskan `/api` ke backend dengan path `/api/v1/...` tetap utuh. Proxy Vite hanya untuk development.
7. Sesudah restart host, ulangi verifikasi server dan coba chat/PDF dari URL deployment. Ini memastikan layanan dan model tetap tersedia setelah reboot. Konfigurasi tersebut belum diuji pada host deployment yang belum diberikan.

## 2. Memvalidasi token provider komersial, hanya jika ingin menggunakannya

Bagian ini dapat dilewati bila tetap memakai Ollama gratis. Token komersial di environment pengembangan masih placeholder; gateway lokal yang sudah diuji membuktikan transport autentikasi, bukan validitas akun provider.

1. Pemilik akun membuka dashboard provider dan membuat/memilih API key dengan akses ke model yang akan digunakan. Tindakan akun ini belum dapat dilakukan tanpa akses pemilik.
2. Simpan key melalui secret manager hosting atau `.env` backend yang diabaikan Git. Jangan menaruhnya dalam variabel frontend `VITE_*`. [Dokumentasi autentikasi OpenAI](https://developers.openai.com/api/reference/overview) menjelaskan penyimpanan key pada server dan Bearer authentication.
3. Untuk contoh fallback OpenAI, tetap pertahankan `AI_EXECUTION=browser` lalu set:

   ```env
   SERVER_FALLBACK_PROVIDER=openai
   SERVER_FALLBACK_MODEL=gpt-4o-mini
   OPENAI_BASE_URL=https://api.openai.com/v1
   OPENAI_API_KEY=KEY_ASLI_DI_ENV_BACKEND
   ```

   Pilih model yang benar-benar tersedia pada akun. Untuk Groq/provider kompatibel lainnya, gunakan endpoint, model, dan token provider tersebut; proyek juga membaca `GROQ_API_KEY`. Ubah `SERVER_FALLBACK_MODEL` ketika mengganti provider, jangan mempertahankan nama model Ollama.

4. Dari root proyek, jalankan `bun run verify:server-ai`. Dengan provider `openai`, panggilan pertama skrip langsung menuju provider yang dikonfigurasi. Keberhasilan harus menampilkan `Configured fallback openai/...: real inference OK` dan exit code 0. HTTP 401/403 perlu pemeriksaan kredensial/izin; 404 perlu pemeriksaan endpoint/model; 429 perlu pemeriksaan limit pada dashboard provider.
5. Restart backend untuk memuat environment baru. Coba chat atau PDF dan pastikan fallback bekerja. Jika ingin kembali tanpa API berbayar, set provider/model fallback kembali ke Ollama, restart backend, dan ulangi verifikasi.

## 3. Pengujian pada perangkat pengguna yang belum tersedia

Pengujian nyata baru dilakukan pada satu laptop Windows/Chrome, ditambah pengujian CPU tanpa WebGPU. Pemilik perlu menyediakan perangkat atau akses browser untuk memperluas pengujian; Codex dapat melanjutkan bila akses tersedia.

1. Buka deployment HTTPS pada perangkat sasaran. Coba chat dengan pertanyaan yang jawabannya ada pada dokumen kursus.
2. Biarkan unduhan dan proses berjalan; amati status model perangkat dan sumber jawaban. Catat jenis perangkat/browser, waktu, dan hasil.
3. Pada perangkat yang gagal menjalankan model, pastikan status beralih otomatis ke server dan jawaban/kutipan tetap muncul. Retry permintaan yang sama tidak boleh mengurangi saldo dua kali untuk completion yang sama.
4. Coba pembatalan, membuka ulang halaman, dan melanjutkan indeks dokumen. Dokumen yang sudah tersimpan harus tetap ada.
5. Coba PDF: hasil harus tetap draf privat, tidak terlihat oleh siswa sebelum diterbitkan. Peninjauan akurasi materi oleh kreator tetap diperlukan; pemeriksaan leksikal otomatis belum membuktikan kebenaran semantik.

Hasil yang sudah diuji tercatat dalam [browser-ai-verification.md](browser-ai-verification.md).
