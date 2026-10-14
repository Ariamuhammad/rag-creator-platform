# Verifikasi AI di perangkat pengguna

## Pembaruan 15 Oktober 2026: perangkat dahulu, server sebagai fallback AI terakhir

Implementasi terbaru mencoba Qwen3 WebGPU/CPU lalu SmolLM2 135M CPU sebelum otomatis memanggil model server. Jawaban yang tidak cukup didukung sumber juga mencoba server; kutipan materi menjadi hasil terakhir bila output server tidak didukung atau layanan gagal. Kegagalan lokal pada pengujian perpindahan diinjeksi untuk memicu semua cabang secara deterministik; inferensi server serta penyimpanan PostgreSQL/ledger benar-benar dijalankan.

| Pemeriksaan terbaru | Bukti hasil |
| --- | --- |
| Model perangkat utama | Worker Qwen3 dengan profile `auto` menghasilkan `RAG retrieves relevant documents.` dalam sekitar 13,6 detik menggunakan model cache. |
| Model perangkat ringkas | Worker SmolLM2 135M q8/WASM menghasilkan teks nyata dalam sekitar 70,6 detik termasuk unduhan pertama. Hasil contoh menambah fakta di luar konteks; pemeriksaan sumber tetap diperlukan. Percobaan Gemma 270M gagal pada runtime yang terpasang, sehingga tidak dipakai. |
| Fallback server tanpa key | `verify:server-ai` berhasil memanggil Ollama Qwen3 1.7B nyata (27 token pada contoh singkat), serta EmbeddingGemma menghasilkan vektor nyata, dipadding ke 1536 dimensi. Ollama yang terpasang versi 0.18.0 memakai CPU pada mesin ini. |
| Jalur API bertoken | Gateway lokal menolak token salah dengan HTTP 401. Token benar diteruskan melalui jalur OpenAI-compatible aplikasi ke model Ollama nyata dan menghasilkan teks. Ini menguji kontrak autentikasi/transport; bukan validasi akun OpenAI/Groq komersial. |
| Perpindahan browser → server | Worker uji memicu dua kegagalan embedding, lalu kegagalan generator `auto`, `cpu`, dan `lite`. API aplikasi otomatis memakai server; jawaban tersimpan sebagai `generated`, 860 prompt + 61 completion = 921 kredit. Saldo akhir contoh 242.619. Tidak ada persetujuan perpindahan. |
| PDF nyata | PDF valid diekstrak dan fallback server dipanggil setelah kegagalan perangkat diinjeksi. Output belum memenuhi pemeriksaan sumber, sehingga frontend menghasilkan draf kutipan PDF, `isPublished=false`, dengan teks sumber tetap tersedia. |
| Privasi dan publikasi draf | Publikasi tanpa `reviewed=true` ditolak HTTP 400. Draf tersimpan dapat dibaca pemilik, tidak muncul dalam daftar publik, dan akses siswa ditolak HTTP 404. Semua diuji melalui HTTP dan database pengujian. |
| Retry dan keamanan | Tes memeriksa prompt chat tersimpan, deduplikasi inference bersamaan, tanda tangan PDF/pemilik/kedaluwarsa, penolakan angka/fakta yang tidak didukung, dan pemotongan sekali. Jawaban dan ledger menggunakan transaksi baik pada mode browser/fallback maupun mode server utama. |
| Pembatalan dan pemulihan | Tes worker memeriksa penghentian pekerjaan aktif, pembatalan antrean tanpa memulai worker baru, pelepasan model, dan reset percobaan perangkat. UI chat, PDF, dan upload menyediakan pembatalan; cache AI dapat dibersihkan terpisah dari dokumen/draf. |
| Pemeriksaan kode terbaru | 48 tes otomatis lolos, 0 gagal (211 assertion). Build backend, build frontend, dan lint frontend lolos. |

Jalankan `bun run verify:server-ai` sebelum deployment dan setelah mengubah endpoint/model/token. Default fallback tidak membutuhkan token berbayar. Kredensial komersial di environment pengujian hanya placeholder; panggilan provider komersial nyata belum diverifikasi. Ollama tetap harus aktif pada host backend deployment. Pemeriksaan sumber bersifat leksikal per kalimat, termasuk angka, negasi, dan urutan sebelum/sesudah; bukan evaluator kebenaran semantik. PDF masih memakai sampel 6.000 karakter, dan model ringkas dapat memiliki kemampuan bahasa Indonesia yang terbatas.

## Catatan pengujian awal 14 Oktober 2026

Dijalankan 14 Oktober 2026 di Windows dengan Chrome, Bun 1.3.5, PostgreSQL/pgvector, dan Redis/BullMQ. Pengujian integrasi memakai database serta Redis khusus pengujian; database utama dan volume Docker yang ada tidak dihapus. Semua pembayaran memakai simulasi Xendit.

## Hasil

| Alur | Bukti hasil |
| --- | --- |
| Default tanpa token LLM | `AI_EXECUTION=browser`; tes memblokir seluruh panggilan inference backend, termasuk ketika konfigurasi provider lama masih terisi. |
| Model WebGPU | Qwen3 0.6B menghasilkan jawaban nyata dalam Web Worker. Bundle produksi juga memuat model, menghitung embedding, dan menghasilkan jawaban. Uji cache pada bundle produksi selesai sekitar 11 detik. |
| Model CPU tanpa WebGPU | `navigator.gpu` disembunyikan pada worker pengujian; worker aplikasi memilih Qwen3 0.6B q8 pada WASM. Embedding 384 dimensi, jawaban berbasis materi, penyimpanan chat, dan draf Markdown berhasil. Chat contoh sekitar 110 detik; rangkaian sampai draf sekitar 197 detik. |
| Upload dan indeks | Dokumen 6.246 byte menghasilkan 13 chunk. Semua embedding dihitung di browser, disimpan pada pgvector 1536 dimensi dengan padding nol dan marker model. |
| Resume setelah reload | Dokumen 14 chunk: simpan batch pertama 8 chunk, reload halaman, lalu klik **Indeks di perangkat**. Enam chunk tersisa selesai; status `COMPLETED` dan seluruh 14 vektor tersimpan. |
| Chat dan kuota | Jawaban nyata tersimpan dengan riwayat user/assistant; pengurangan saldo sama dengan penggunaan yang dihitung server. |
| Saldo pada UI | Setelah jawaban selesai, saldo header dan AI Mentor sama dengan saldo backend; contoh terakhir berkurang 953 kredit dengan ledger 953. |
| Login gagal | Simulasi HTTP 401 saat berganti akun menampilkan error dan tidak membuka view akun lain. Tombol coba kembali memulihkan login. |
| Retry bersamaan | Dua completion untuk pertanyaan yang sama menghasilkan ID jawaban yang sama dan satu pemotongan kredit. |
| Dua pertanyaan berbeda bersamaan | Selisih saldo cocok dengan jumlah kedua pemotongan. SQL decrement mencegah perubahan saldo saling menimpa. |
| Kredit tidak cukup | Completion mengembalikan HTTP 403; saldo tetap dan transaksi tidak meninggalkan jawaban assistant atau ledger. |
| Isolasi kursus | Kursus A tidak menerima sumber khusus kursus B/C. Kontrol positif pada kursus B menerima dokumennya sendiri. |
| Hak akses | Akses lintas tenant/kursus ditolak, sumber milik kreator lain tidak dibocorkan, siswa tidak dapat membaca endpoint chunk kreator, dan ID chunk palsu ditolak sebelum penulisan. |
| Validasi data klien | Vektor dengan dimensi/data tidak valid serta angka pemakaian token palsu ditolak HTTP 400. |
| PDF ke kursus | PDF nyata diekstrak backend; browser menghasilkan Markdown, parser menjaga struktur modul/lesson, lalu hasil tersimpan di PostgreSQL. Alur UI unggah → draf → tinjau → simpan juga berhasil. |
| Seeder database baru | Terbentuk 2 user, 1 kursus, 4 modul, 5 lesson, 2 tier, 1 langganan, 1 order, dan 1 payout. Menjalankan ulang tidak menggandakan entitas tersebut. |
| Runtime produksi | Hasil kompilasi backend berhasil berjalan melalui `bun run start:prod`, terhubung ke PostgreSQL/Redis, dan melayani seeder. |
| Pemeriksaan kode | 32 tes otomatis lolos, 0 gagal (138 assertion). Build backend, build frontend, serta lint frontend lolos. |

## Perbaikan yang berasal dari pengujian

- Browser menulis silabus sebagai Markdown lalu aplikasi membentuk objek kursus. Model kecil sebelumnya gagal menjaga JSON yang kompleks.
- Prompt untuk model browser dibuat ringkas; kode tetap mempertahankan prompt serta format JSON untuk mode server opsional.
- CPU menggunakan bobot q8. Percobaan bobot q4 pada WASM gagal karena memori; q4f16 dan model Qwen2.5 yang dicoba tidak memberikan hasil yang memadai pada materi pengujian.
- Temporal polyfill dimuat sebelum client Prisma, dan versi ORM dipatok agar sesuai dengan toolchain proyek.
- View akun menunggu login/bootstrap selesai sehingga daftar kursus/catatan tidak dimuat dengan token akun sebelumnya.
- Kuota disimpan dalam transaksi yang sama dengan jawaban dan ledger, dengan pengurangan saldo bersyarat yang aman untuk concurrency.
- Startup backend memakai Bun sesuai konfigurasi ESM/resolusi impor proyek.
- Seeder memeriksa hasil HTTP dan membuat kursus dasar ketika database masih kosong.

## Menjalankan pemeriksaan otomatis

```powershell
bun run test:ai
bun run build
Set-Location frontend
bun run lint
bun run build
```

Tes otomatis menggunakan respons provider/model tiruan untuk pemeriksaan kontrak, parser, auth, dan quota; satu tes menjalankan client Prisma nyata tanpa query database. Pengujian model nyata dan integrasi database pada tabel di atas dijalankan secara terpisah melalui browser dan endpoint aplikasi.

## Batas hasil pengujian

Ini verifikasi pada satu mesin dan browser, bukan benchmark semua perangkat. Model 0.6B tetap dapat mengabaikan instruksi atau menghasilkan fakta yang salah; edukator perlu meninjau materi. CPU memerlukan lebih banyak waktu dan bobot model sekitar 617 MB; kebutuhan RAM inference lebih besar dari ukuran unduhan. WebGPU dengan shader-f16 mengunduh sekitar 483 MB. Internet diperlukan saat unduhan awal, dan cache bisa dibersihkan browser. Pengujian ini tidak melakukan transaksi Xendit sungguhan atau panggilan ke provider LLM berbayar.
