const API_BASE = 'http://localhost:3000/api/v1';

async function seed() {
  console.log('🌱 Starting Comprehensive Platform Seeder for EduRAG (PostgreSQL)...\n');

  // 1. Authenticate or Register Creator (Bob)
  let creatorToken = '';
  let creatorUser: any = null;
  let creatorProfile: any = null;

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'creator@edurag.com', password: 'password123' }),
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      creatorToken = data.accessToken;
      creatorUser = data.user;
      creatorProfile = data.user.creatorProfile;
      console.log('1. ✅ Creator (Bob) Authenticated:', creatorUser.email);
    } else {
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'creator@edurag.com',
          password: 'password123',
          fullName: 'Teacher Bob S.Pd',
          role: 'CREATOR',
          slug: 'bob-ai',
          displayName: 'Bob AI Academy',
        }),
      });
      const data = await regRes.json();
      creatorToken = data.accessToken;
      creatorUser = data.user;
      creatorProfile = data.user.creatorProfile;
      console.log('1. ✅ Creator (Bob) Registered:', creatorProfile.slug);
    }
  } catch (err: any) {
    console.error('Error seeding creator:', err.message);
  }

  const creatorHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${creatorToken}`,
  };

  // 2. Configure Creator Bank Account
  await fetch(`${API_BASE}/billing/creator/bank-account`, {
    method: 'PATCH',
    headers: creatorHeaders,
    body: JSON.stringify({
      bankName: 'BCA (Bank Central Asia)',
      bankAccountNumber: '8830123456',
      bankAccountHolderName: 'Teacher Bob S.Pd',
    }),
  });
  console.log('2. ✅ Bank account configured for Bob');

  // 3. Ensure Subscription Tiers for Bob
  const tiersRes = await fetch(`${API_BASE}/creators/${creatorProfile.id}/tiers`);
  let tiers = await tiersRes.json();
  if (!Array.isArray(tiers) || tiers.length === 0) {
    await fetch(`${API_BASE}/creators/tiers`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({
        name: 'Masterclass AI & Vector Tier',
        description: 'Akses penuh modul enterprise, AI Copilot, dan 250.000 kredit token',
        price: 200000,
        monthlyCreditQuota: 250000,
      }),
    });
    await fetch(`${API_BASE}/creators/tiers`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({
        name: 'Starter AI Tier',
        description: 'Akses ringkas modul pengantar dan 50.000 token AI',
        price: 50000,
        monthlyCreditQuota: 50000,
      }),
    });
    const updatedTiers = await fetch(`${API_BASE}/creators/${creatorProfile.id}/tiers`);
    tiers = await updatedTiers.json();
  }
  console.log(`3. ✅ Tiers verified for Bob (${tiers.length} tiers)`);

  // 4. Authenticate or Register Student (Alice)
  let studentToken = '';
  let studentUser: any = null;

  try {
    const loginRes = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'student@edurag.com', password: 'password123' }),
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      studentToken = data.accessToken;
      studentUser = data.user;
      console.log('4. ✅ Student (Alice) Authenticated:', studentUser.email);
    } else {
      const regRes = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'student@edurag.com',
          password: 'password123',
          fullName: 'Alice (Student)',
          role: 'STUDENT',
        }),
      });
      const data = await regRes.json();
      studentToken = data.accessToken;
      studentUser = data.user;
      console.log('4. ✅ Student (Alice) Registered:', studentUser.fullName);
    }
  } catch (err: any) {
    console.error('Error seeding student:', err.message);
  }

  const studentHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${studentToken}`,
  };

  // 5. Ensure Student has Active Subscription and Orders
  const studentBalanceRes = await fetch(`${API_BASE}/billing/student/balance/${creatorProfile.id}`, {
    headers: studentHeaders,
  });
  const studentBalance = await studentBalanceRes.json();
  if (!studentBalance.hasActiveSubscription) {
    console.log('👉 Creating real subscription & invoice order for Alice...');
    const masterTier = tiers.find((t: any) => t.name.includes('Masterclass')) || tiers[0];
    const invoiceRes = await fetch(`${API_BASE}/billing/create-invoice`, {
      method: 'POST',
      headers: studentHeaders,
      body: JSON.stringify({ creatorProfileId: creatorProfile.id, tierId: masterTier.id }),
    });
    const invoice = await invoiceRes.json();
    // Simulate webhook paid
    await fetch(`${API_BASE}/billing/xendit-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': 'rag_xendit_webhook_token_secret',
      },
      body: JSON.stringify({
        id: `xendit_${Date.now()}`,
        external_id: invoice.externalId,
        status: 'PAID',
        payment_method: 'QRIS',
        amount: invoice.amount,
      }),
    });
    console.log('5. ✅ Subscription & Paid Order created for Alice');
  } else {
    console.log(`5. ✅ Alice already has active subscription (${studentBalance.remainingCredits} tokens)`);
  }

  // 6. Ensure Course Syllabus has full 4 modules and lessons
  const courseSlug = 'enterprise-rag-systems';
  let courseRes = await fetch(`${API_BASE}/courses/slug/${courseSlug}`, {
    headers: studentHeaders,
  });
  let course = await courseRes.json();
  const existingModules = course.modules || [];

  console.log(`6. 🔍 Checking Course "${course.title}" (${existingModules.length} existing modules)...`);

  // If Module 3 does not exist, add it
  const hasMod3 = existingModules.some((m: any) => m.title.includes('Modul 3'));
  if (!hasMod3) {
    console.log('👉 Adding Modul 3: Document Ingestion & Chunking...');
    const mod3Res = await fetch(`${API_BASE}/courses/${course.id}/modules`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({
        title: 'Modul 3: Document Ingestion & Chunking Strategies',
        description: 'Teknik segmentasi dokumen PDF, deduplikasi, dan metadata enrichment skala enterprise.',
        orderIndex: 2,
      }),
    });
    const mod3 = await mod3Res.json();
    if (mod3.id) {
      await fetch(`${API_BASE}/courses/modules/${mod3.id}/lessons`, {
        method: 'POST',
        headers: creatorHeaders,
        body: JSON.stringify({
          title: '3.1 Recursive Character vs Semantic Chunking',
          type: 'reading',
          duration: '20 min',
          orderIndex: 0,
          contentMarkdown: `# 3.1 Recursive Character vs Semantic Chunking

Strategi pemotongan dokumen (chunking) adalah penentu terbesar kualitas retrieval pada sistem RAG.

## Pendekatan Chunking Utama
1. **Recursive Character Text Splitting:**
   - Membagi dokumen berdasarkan separator hierarkis: paragraf ganda (\`\\n\\n\`), baris tunggal (\`\\n\`), spasi, lalu karakter.
   - Menjaga keutuhan unit semantik alami teks bahasa manusia.
2. **Semantic Chunking:**
   - Menghitung cosine similarity antar kalimat berurutan.
   - Titik potong (split point) diletakkan ketika ada pergeseran makna (*semantic shift*) yang drastis di atas ambang batas (threshold 95 percentile).

\`\`\`typescript
// Contoh implementasi chunking window dengan sliding overlap
function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += (chunkSize - overlap);
  }
  return chunks;
}
\`\`\``,
        }),
      });

      await fetch(`${API_BASE}/courses/modules/${mod3.id}/lessons`, {
        method: 'POST',
        headers: creatorHeaders,
        body: JSON.stringify({
          title: '3.2 Ingestion Pipeline Asinkron dengan BullMQ & Redis',
          type: 'reading',
          duration: '24 min',
          orderIndex: 1,
          contentMarkdown: `# 3.2 Ingestion Pipeline Asinkron dengan BullMQ & Redis

Memproses ratusan dokumen PDF ribuan halaman secara sinkron di thread utama HTTP request adalah anti-pattern yang dapat menyebabkan memory leak dan timeout.

## Arsitektur Worker Queue
- **Client/Frontend:** Mengunggah file multipart ke endpoint \`/knowledge-base/upload\`.
- **API Server:** Menyimpan metadata awal ke tabel \`documents\` dengan status \`PENDING\`, lalu mendispatch job ke antrean BullMQ.
- **Worker Process:**
  1. Mengekstrak teks murni menggunakan pdf-parse.
  2. Membagi teks menjadi 500-800 token chunks.
  3. Memanggil model embedding OpenAI (\`text-embedding-3-small\`).
  4. Menyimpan vektor dense 1536-dimensi ke tabel \`document_chunks\` PostgreSQL.
  5. Mengubah status dokumen menjadi \`COMPLETED\`.`,
        }),
      });
      console.log('✅ Modul 3 and lessons created');
    }
  }

  // If Module 4 does not exist, add it
  const hasMod4 = existingModules.some((m: any) => m.title.includes('Modul 4'));
  if (!hasMod4) {
    console.log('👉 Adding Modul 4: Monetisasi & Pembagian Hasil...');
    const mod4Res = await fetch(`${API_BASE}/courses/${course.id}/modules`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({
        title: 'Modul 4: Monetisasi & Kuota Token Edukator',
        description: 'Implementasi Ledger Transaksi, Prisma 8, dan Pembagian Hasil Xendit 80/20.',
        orderIndex: 3,
      }),
    });
    const mod4 = await mod4Res.json();
    if (mod4.id) {
      await fetch(`${API_BASE}/courses/modules/${mod4.id}/lessons`, {
        method: 'POST',
        headers: creatorHeaders,
        body: JSON.stringify({
          title: '4.1 Atomic Token Deduction & Credit Ledger Design',
          type: 'reading',
          duration: '18 min',
          orderIndex: 0,
          contentMarkdown: `# 4.1 Atomic Token Deduction & Credit Ledger

Sistem SaaS AI multi-tenant wajib mencegah race condition di mana murid dengan sisa 100 token mengirim 10 query secara paralel.

## Transaksi Atomik Prisma 8
Untuk menjamin konsistensi, pemotongan kredit token harus dibungkus dalam transaksi database atomik:

\`\`\`typescript
const updated = await this.prisma.subscription.updateMany({
  where: {
    studentId,
    creatorProfileId,
    remainingCredits: { gte: totalTokensNeeded },
  },
  data: {
    remainingCredits: { decrement: totalTokensNeeded },
  },
});

if (updated.count === 0) {
  throw new ForbiddenException('Kuota token tidak mencukupi untuk kueri ini.');
}
\`\`\`

Setiap transaksi kemudian dicatat permanen di tabel \`credit_ledgers\` untuk audit dan transparansi bagi edukator.`,
        }),
      });
      console.log('✅ Modul 4 and lessons created');
    }
  }

  // Refresh course details
  courseRes = await fetch(`${API_BASE}/courses/slug/${courseSlug}`, {
    headers: studentHeaders,
  });
  course = await courseRes.json();
  const allCurrentLessons = (course.modules || []).flatMap((m: any) => m.lessons);

  // 7. Attach Real Documents to Course
  const docsRes = await fetch(`${API_BASE}/knowledge-base/documents`, {
    headers: creatorHeaders,
  });
  const allDocs = await docsRes.json();
  if (Array.isArray(allDocs) && allDocs.length > 0) {
    const docIds = allDocs.map((d: any) => d.id);
    await fetch(`${API_BASE}/knowledge-base/courses/${course.id}/assign-documents`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({ documentIds: docIds }),
    });
    console.log(`7. ✅ Assigned ${docIds.length} real document(s) to course "${course.title}"`);
  }

  // 8. Seed Real Student Notes for Alice
  if (allCurrentLessons.length > 0) {
    const existingNotesRes = await fetch(`${API_BASE}/notes`, { headers: studentHeaders });
    const existingNotes = await existingNotesRes.json();

    if (!Array.isArray(existingNotes) || existingNotes.length === 0) {
      const les1 = allCurrentLessons[0];
      const les2 = allCurrentLessons[1] || allCurrentLessons[0];

      await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          lessonId: les1.id,
          selectedText: 'Hierarchical Navigable Small World (HNSW) graphs offer logarithm time complexity O(log N).',
          noteText: 'Ingat: HNSW graf logaritmik mirip dengan konsep Skip List pada linked list bertingkat.',
        }),
      });

      await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          lessonId: les2.id,
          selectedText: 'Overlap Window (e.g. 50-100 token): Menjaga kesinambungan konteks antar chunk.',
          noteText: 'Formula overlap: 10% sampai 15% dari total chunk size sudah ideal untuk OpenAI embedding.',
        }),
      });
      console.log('8. ✅ Real student notes created for Alice');
    } else {
      console.log(`8. ✅ Alice already has ${existingNotes.length} notes in DB`);
    }
  }

  // 9. Seed Real Lesson Discussions & Replies
  if (allCurrentLessons.length > 0) {
    const les1 = allCurrentLessons[0];
    const discRes = await fetch(`${API_BASE}/discussions/lesson/${les1.id}`);
    const existingDiscussions = await discRes.json();

    if (!Array.isArray(existingDiscussions) || existingDiscussions.length === 0) {
      // Alice asks
      const createdDiscRes = await fetch(`${API_BASE}/discussions`, {
        method: 'POST',
        headers: studentHeaders,
        body: JSON.stringify({
          lessonId: les1.id,
          content: 'Apakah parameter m=16 dan ef_construction=64 sudah cukup jika dataset dokumen edukator mencapai 50.000 halaman?',
        }),
      });
      const createdDisc = await createdDiscRes.json();

      // Bob replies
      if (createdDisc && createdDisc.id) {
        await fetch(`${API_BASE}/discussions/${createdDisc.id}/replies`, {
          method: 'POST',
          headers: creatorHeaders,
          body: JSON.stringify({
            content: 'Untuk 50.000 halaman (~200.000 chunks), konfigurasi m=16 dan ef_construction=64 sudah memberikan rasio recall di atas 98.5%. Anda baru perlu menaikkan m=24 jika ada terminologi hukum/medis yang sangat spesifik.',
          }),
        });
        console.log('9. ✅ Real discussion thread and educator reply created');
      }
    } else {
      console.log(`9. ✅ Lesson 1 already has ${existingDiscussions.length} discussion threads`);
    }
  }

  // 10. Seed Payout Request for Bob
  const payoutsRes = await fetch(`${API_BASE}/billing/creator/payouts`, { headers: creatorHeaders });
  const payouts = await payoutsRes.json();
  if (!Array.isArray(payouts) || payouts.length === 0) {
    await fetch(`${API_BASE}/billing/creator/payout-request`, {
      method: 'POST',
      headers: creatorHeaders,
      body: JSON.stringify({
        amount: 50000,
        notes: 'Penarikan hasil royalti tier Masterclass via BCA',
      }),
    });
    console.log('10. ✅ Real payout request created for Bob');
  } else {
    console.log(`10. ✅ Bob already has ${payouts.length} payout requests in DB`);
  }

  console.log('\n🎉 ALL DATABASE SEEDING COMPLETED SUCCESSFULLY! All entities populated with real PostgreSQL records.\n');
}

seed().catch((err) => {
  console.error('Fatal seed error:', err);
  process.exit(1);
});
