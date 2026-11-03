# Jasa-in — Dokumen Proyek

Marketplace jasa edit foto · `jasa-in.my.id`
Repo: `github.com/asra0602/jasa-in-project` · Deploy: Vercel (`jasa-in-project.vercel.app`)
Terakhir diperbarui: 19 Oktober 2026
Pembaruan model pembayaran: 3 November 2026 — pembayaran berubah dari QRIS per seller ke QRIS pusat Jasa-in (lihat §1 dan fitur 6). Bagian lain dokumen ini belum diperbarui sepenuhnya dan mungkin masih menyebut model lama di beberapa tempat.

> Keterangan status: ✅ sudah ada dan terverifikasi · 🟡 ada di kode tapi belum teruji / belum lengkap · ❌ belum ada · ❓ dugaan, belum dipastikan

---

## Checklist pembaruan — Perbaikan upload galeri (3 November 2026)

- [x] Bug 413 diperbaiki: foto tidak lagi dikirim lewat Server Action (batas body 1 MB, foto JPG 1,4 MB sudah gagal sebelum kode jalan dan produk tidak terbuat). Foto kini diunggah langsung dari browser ke Storage `service-images` lewat komponen klien `service-photo-forms.tsx`
- [x] Server action buat/tambah foto kini hanya menerima URL foto dan memvalidasinya: host Supabase yang sama, bucket `service-images`, path diawali ID jasa yang bersangkutan, ekstensi JPG/PNG/WebP/GIF, maks. 10 foto per jasa
- [x] Typecheck lolos dan build Next.js lolos
- [ ] PR perbaikan upload di-merge ke main dan diverifikasi live dengan foto JPG di atas 1 MB
- [ ] Uji ulang live: buat produk baru dengan foto, pastikan muncul di katalog dan dashboard

## Checklist pembaruan — Sinkronisasi checklist (3 November 2026)

Dokumen-only: tidak ada perubahan kode. Centang di bawah diperbarui berdasarkan
kejadian yang sudah terverifikasi malam ini, bukan janji baru.
- [x] PR #1 di-merge ke main (dee04de, 3 Nov 2026 ~19:53 WITA) dan deploy produksi diverifikasi Ready (24 detik, jasa-in.my.id, ~19:54 WITA)
- [x] Halaman detail layanan dari PR #1 sudah live lewat merge yang sama
- [x] PR #2 keamanan order di-merge (aaff2da) dan deploy produksi diverifikasi Ready (16 detik, ~22:45 WITA)
- [x] PR #3 galeri foto di-merge (9b9b832) dan deploy produksi diverifikasi Ready (18 detik, ~22:55 WITA)
- [x] Role admin Asra dan migrasi 003/004 terverifikasi di Supabase (~23:00 WITA; kebijakan/tabel/bucket sudah ada di database, SQL tidak dijalankan ulang untuk menghindari duplikat)
- [ ] Masih tertunda: variable Vercel yang hilang dengan nilai baru hasil rotasi, RPC atomik penuh (S7), dan rilis QRIS pusat

## Checklist pembaruan — PR #1 (3 November 2026)

Aturan kerja ke depan: ikuti langkah di dokumen ini berurutan, dan setiap ada pembaruan, checklist ini diperbarui di commit yang sama.

- [x] Slot QRIS pusat `JASA_IN_QRIS_STATIC_PAYLOAD` disiapkan di kode (kosong dulu, fallback seller sementara)
- [x] Notifikasi Telegram bukti bayar ke grup seller/admin (`src/lib/telegram.ts`)
- [x] Konfirmasi pembayaran dibuka untuk admin di kode + migrasi `003_admin_payments.sql` disiapkan (belum diterapkan di Supabase)
- [x] `.env.local` dihapus dari branch + `.env.example` dibuat (nama key saja, tanpa nilai)
- [x] Dokumen ini diperbarui ke model QRIS pusat
- [x] PR #1 di-merge ke main
- [x] Deploy produksi diverifikasi setelah merge
- [ ] Variable Vercel yang hilang diisi dengan nilai baru hasil rotasi: SAWERIA_URL, SAWERIA_WEBHOOK_SECRET, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, plus slot QRIS pusat saat dirilis
- [x] Akun admin di Supabase di-set role=admin dan migrasi 003 diterapkan (terverifikasi 3 Nov 2026 ~23:00 WITA; sudah ada di database, tidak dijalankan ulang)
- [ ] QRIS pusat dirilis Asra, fallback seller dinonaktifkan

## Checklist pembaruan — Detail layanan (3 November 2026)

- [x] Halaman detail layanan `/catalog/[id]` dibuat: judul, kategori, harga, deskripsi, sampul, info toko seller, ulasan seller, dan formulir pesanan (jumlah 1–50 + catatan buyer) yang memanggil `createOrderAction`
- [x] Halaman menangani layanan tidak ditemukan/tidak aktif, layanan milik sendiri (tidak bisa dipesan), dan pengunjung belum login (diarahkan ke login dengan `next` kembali ke detail layanan)
- [x] Typecheck lolos dan build Next.js lolos; route `/catalog/[id]` terdaftar sebagai dynamic
- [x] PR di-merge dan halaman detail diverifikasi live di jasa-in.my.id

## Checklist pembaruan — Galeri foto jasa (3 November 2026)

- [x] Form tambah jasa di dashboard kini punya input foto (maks. 5 foto per unggahan, maks. 10 foto per jasa, masing-masing maks. 5 MB, JPG/PNG/WebP/GIF) yang diunggah ke bucket Storage Supabase `service-images`
- [x] Foto dicatat di tabel baru `service_images` (migrasi `004_service_images.sql`); foto pertama juga menjadi `cover_image_url` sehingga katalog menampilkan sampul
- [x] Katalog `/catalog` menampilkan sampul jasa; halaman detail `/catalog/[id]` menampilkan galeri lengkap (foto utama + thumbnail), dengan fallback ke cover untuk jasa lama
- [x] Form tambah foto ke jasa yang sudah ada di dashboard (hanya seller pemilik jasa, dibatasi total 10 foto per jasa)
- [x] Typecheck lolos dan build Next.js lolos
- [x] PR galeri foto di-merge ke main dan diverifikasi live
- [x] Migrasi `004_service_images.sql` diterapkan di Supabase (bucket + tabel + kebijakan) (terverifikasi sudah ada di database 3 Nov 2026 ~23:00 WITA; tidak dijalankan ulang)

## Checklist pembaruan — Keamanan order (3 November 2026)

- [x] `updateOrderStatusAction` kini memverifikasi partisipan dan hanya mengizinkan transisi sah: seller `paid -> in_progress -> delivered`, pembeli `delivered -> completed`, dan pembatalan hanya oleh partisipan saat `pending_payment`
- [x] `submitPaymentProofAction` kini hanya dari pembeli pesanan, hanya saat pesanan `pending_payment` dan payment `pending`/`rejected` (bukti tidak menimpa payment yang sudah `confirmed`)
- [x] `confirmOrderPaymentAction` kini hanya untuk payment `submitted` dan pesanan `pending_payment` (konfirmasi), dengan cek error sehingga kegagalan RLS tidak tampil sebagai sukses; penolakan hanya untuk payment `submitted`
- [x] `submitReviewAction` kini memverifikasi pembeli, status `completed`, dan seller ulasan harus cocok dengan seller pesanan
- [x] `createOrderAction` kini menghapus pesanan jika insert item atau payment gagal, supaya tidak ada pesanan tanpa item/payment
- [x] PR keamanan order di-merge ke main dan diverifikasi live
- [ ] Transaksi atomik penuh via RPC untuk create order (S7) — saat ini masih cleanup kompensasi, bukan satu transaksi database
- [x] Migrasi `003_admin_payments.sql` diterapkan dan role admin di-set, supaya konfirmasi admin tidak diblokir RLS (terverifikasi 3 Nov 2026 ~23:00 WITA)

## 1. Ringkasan

Toko jasa edit foto di mana **seller** menjual jasa lewat dashboard, **buyer** memesan lewat katalog global, dan pembayaran memakai **QRIS pusat milik Jasa-in** (statis diubah menjadi dinamis dengan nominal tetap). Dana masuk ke Jasa-in; payout ke seller dilakukan manual untuk tahap ini. Slot QRIS pusat disiapkan lewat variable server `JASA_IN_QRIS_STATIC_PAYLOAD` dan sengaja dikosongkan dulu sampai Asra merilis QRIS pusat; selama slot itu kosong, QRIS seller dipakai sebagai fallback sementara agar pesanan tidak langsung kehilangan QRIS.

### Stack saat ini (sesuai isi repo)

| Bagian | Teknologi |
|---|---|
| Framework | Next.js 16.4.2 (App Router, Turbopack), TypeScript |
| Auth & database | Supabase (Auth, PostgreSQL, RLS) |
| Hosting | Vercel |
| Lingkungan kerja | GitHub Codespaces |
| Modul QRIS | `src/lib/qris.ts` (port dari prototipe PHP `qris-dinamis-test`) |

Catatan: fondasi PHP Native sempat disiapkan sebagai alternatif, tetapi tidak dipakai dan tidak pernah dikirim. Jika arah stack berubah lagi, putuskan sebelum menambah fitur.

---

## 2. Status fitur yang diminta

| # | Fitur | Status | Catatan |
|---|---|---|---|
| 1 | Login user/seller | 🟡 | Halaman dan server action ada. Login setelah daftar gagal (lihat §4, B2). |
| 2 | Dashboard seller (tambah jasa) | 🟡 | Buka toko, edit toko, tambah jasa, ubah status jasa sudah ada di kode. Belum teruji. |
| 3 | Katalog global | 🟡 | `/catalog` dan `/catalog/[id]` ada. Kategori masih salah (bukan edit foto). |
| 4 | Keranjang | ❌ | Belum ada. Saat ini satu pesanan = satu jasa. |
| 5 | Checkout | 🟡 | Hanya satu jasa per order. Belum ada pemisahan per seller, kode unik, dan batas waktu bayar. |
| 6 | Payment QRIS pusat Jasa-in | 🟡 | Logika QRIS selesai dan teruji. QRIS pusat belum dirilis (slot env kosong); fallback seller sementara. Belum ada gambar QR (hanya teks payload). Bukti bayar masih berupa teks referensi, dan notifikasi bukti bayar dikirim ke grup Telegram seller/admin untuk verifikasi admin Jasa-in. |
| 7 | Review project | 🟡 | Form dan action ada. Aturan kelayakan masih bergantung pada RLS yang belum ditulis. |

---

## 3. Yang sudah selesai

- ✅ `src/lib/qris.ts`: validasi QRIS (CRC16, merchant, NMID, negara/mata uang), konversi statis → dinamis (tag 01, 54, 63), QRIS contoh. Hasilnya **identik** dengan output PHP asli untuk QRIS contoh dan QRIS dinamis Rp75.000.
- ✅ Regression test QRIS: `scripts/qris-regression.ts` (19 cek lolos). Jalankan: `npx tsx scripts/qris-regression.ts`.
- ✅ Halaman detail order dipindah ke `src/app/orders/[id]/page.tsx` (sebelumnya di `orders/page.tsx`, sehingga link `/orders/{id}` akan 404).
- ✅ `SERVICE_CATEGORIES` dipindah ke `src/lib/categories.ts`.
- ✅ `src/lib/supabase/client.ts`: teks nyasar `https:` yang membuat type-check gagal sudah dihapus.
- ✅ Dashboard hanya menerima QRIS **statis** saat seller menyimpan QRIS toko.
- ✅ Versi lengkap `src/` lolos `tsc` dan `next build` (Next 16.4.2) di lingkungan uji.

---

## 4. Perbaikan yang diperlukan

### P0 — Memblokir deploy (kerjakan dulu)

- [ ] **B1. `src/app/orders/actions.ts` belum ada di repo.** Log Vercel commit `72a1c8f` masih gagal karena file ini. Pulihkan: `git show a2f4bac:src/app/orders/actions.ts > src/app/orders/actions.ts`, lalu `git add` dan commit.
- [ ] **B2. Tambahkan `.gitignore` dan keluarkan `.next` dari git** (log Vercel memperingatkan folder `.next` ikut ter-upload). Isi: `node_modules`, `.next`, `.vercel`, `.env`, `.env*.local`, `*.tsbuildinfo`, `next-env.d.ts`.
- [ ] **B3. Pastikan baris `Commit:` di log Vercel berganti.** Tombol *Redeploy* memakai commit lama dan menghasilkan error yang sama.
- [ ] **B4. Jalankan `npm run build` di Codespaces sebelum setiap push.** Error file hilang akan terlihat lebih cepat daripada menunggu Vercel.

### P1 — Memblokir fitur inti (auth & data)

- [ ] **A1. Login gagal setelah daftar.** ❓ Dugaan: email belum terkonfirmasi di Supabase (Confirm email aktif, email bawaan Supabase sangat dibatasi). Cek di Authentication → Users. Perbaikan cepat: `update auth.users set email_confirmed_at = now() where email = '...'`. Untuk masa testing, matikan *Confirm email*.
- [ ] **A2. Pesan error login terlalu umum.** `loginAction` menampilkan "Email atau kata sandi tidak sesuai" untuk semua kegagalan. Tangani kasus email belum diverifikasi secara terpisah.
- [ ] **A3. Daftar sebagai seller tanpa sesi tidak membuat toko.** Jika konfirmasi email aktif, `registerAction` berhenti sebelum memanggil `register_as_seller`. Simpan niat seller (mis. di metadata) lalu buat toko setelah login pertama, atau arahkan jelas ke form buka toko di dashboard.
- [ ] **A4. Daftar dengan email yang sudah terpakai.** Saat konfirmasi email aktif, Supabase bisa membalas "sukses" palsu. Perlu penanganan pesan yang tepat.
- [ ] **A5. Cocokkan kode dengan SQL migration.** Isi `supabase/migrations` belum pernah ditinjau. Kode memakai RPC `register_as_seller` dan kolom berikut, yang harus ada semuanya: `profiles(display_name, username, role)`, `seller_profiles(store_name, store_slug, bio, qris_static_payload, qris_enabled)`, `services(price_idr, category, status, slug)`, `orders(order_number, subtotal_idr, platform_fee_idr, total_idr, buyer_notes)`, `order_items(service_title_snapshot, unit_price_idr, line_total_idr)`, `payments(amount_idr, qris_payload, proof_image_path, confirmed_at, status)`, `reviews`.
- [ ] **A6. Tulis policy RLS dan trigger profil.** README menyatakan RLS aktif tanpa policy permisif, jadi penulisan profil/toko/jasa dari klien akan ditolak. Perlu trigger yang membuat baris `profiles` otomatis saat user mendaftar.
- [ ] **A7. Atur Supabase Auth URL:** Site URL dan Redirect URLs diisi domain Vercel dan `jasa-in.my.id`.
- [ ] **A8. Isi env di Vercel** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`) **sebelum** `.env.local` dikeluarkan dari git. Saat ini Vercel membaca nilainya dari file yang ter-commit.

### P1 — Keamanan (bergantung pada RLS, terverifikasi dari kode)

- [ ] **S1. `updateOrderStatusAction` tidak memeriksa pemilik order dan tidak membatasi alur status.** Siapa pun yang login bisa mengubah status order mana pun jika RLS longgar. Perlu: cek peran (seller/buyer) per transisi dan aturan transisi yang jelas.
- [ ] **S2. `submitPaymentProofAction` meng-update berdasarkan `order_id` saja,** tanpa memastikan pengirim adalah buyer order tersebut.
- [ ] **S3. `submitReviewAction` mengambil `seller_id` dari form** (bisa dipalsukan). Ambil dari order di server, dan pastikan order berstatus selesai, milik buyer, dan belum diulas.
- [ ] **S4. Status order tidak konsisten.** `confirmOrderPaymentAction` mengubah order menjadi `paid`, tetapi `updateOrderStatusAction` tidak mengenal `paid`. Definisikan satu mesin status: `pending_payment → paid → in_progress → delivered → revision → completed`, ditambah `cancelled` dan `expired`.
- [ ] **S5. QRIS seller bisa milik orang lain.** Tambahkan persetujuan admin atas QRIS seller sebelum aktif. Nama merchant (tag 59) sudah ditampilkan ke buyer di halaman order, pertahankan.
- [ ] **S6. Checkbox "QRIS contoh (Testing)" tampil di produksi.** Batasi lewat flag lingkungan atau khusus admin.
- [ ] **S7. `createOrderAction` tidak atomik.** Order, item, dan pembayaran disimpan terpisah, hasil insert `payments` tidak dicek. Bisa menghasilkan order tanpa item atau tanpa pembayaran. Pindahkan ke satu fungsi database (RPC) dalam satu transaksi.
- [ ] **S8. Hapus `.env.local` dari git** setelah A8 selesai (`git rm --cached .env.local`) dan buat `.env.example`. Isinya hanya URL dan *publishable key* (aman dibuka), tetapi file env tidak seharusnya di repo.

### P2 — Kualitas dan perawatan

- [ ] **Q1. Pin versi dependency.** `package.json` memakai `"latest"` untuk next, react, supabase, eslint, dan seterusnya, dan tidak ada `package-lock.json`. Pin versi dan commit lockfile agar build tidak pecah mendadak.
- [ ] **Q2. Ganti `middleware.ts` menjadi `proxy.ts`** (Next 16 menandainya deprecated). Gunakan `npx @next/codemod@canary middleware-to-proxy .` lalu uji ulang.
- [ ] **Q3. Kategori jasa** masih Desain & Branding, Web, Penulisan, Video, Pemasaran. Ganti ke kategori edit foto: Retouch & Beauty, Hapus/Ganti Background, Restorasi Foto Lama, Foto Produk, Pas Foto, Manipulasi & Kreatif, Lainnya.
- [ ] **Q4. Perbarui README.** Masih menyebut auth belum dibuat dan QRIS PHP sebagai acuan.
- [ ] **Q5. Arsipkan folder `qris-reference/`** (PHP) setelah paritas TypeScript dikonfirmasi. Paritas sudah terbukti untuk kasus uji yang ada.
- [ ] **Q6. Tidak ada halaman daftar order** (`/orders`). Saat ini hanya lewat dashboard.

---

## 5. Fitur yang perlu ditambahkan

### Inti marketplace

- [ ] **Keranjang** (tabel `cart_items`, tambah/hapus, jumlah per jasa).
- [ ] **Checkout multi-seller:** satu keranjang dipecah menjadi **satu order per seller** (`checkout_group`), masing-masing punya QRIS dinamis dan nominal sendiri, dibayar satu per satu. Total dihitung di server.
- [ ] **Kode unik 10–99** pada nominal dan **batas waktu bayar** (mis. 30 menit) dengan kedaluwarsa otomatis.
- [ ] **Gambar QR.** Saat ini hanya string payload yang tampil dan tidak ada library QR di `package.json`. Render QR (SVG) dari payload dinamis di halaman order.
- [ ] **Upload bukti bayar** ke Supabase Storage (bucket privat, tautan bertanda tangan), menggantikan input teks referensi.
- [ ] **File kerja foto:** buyer mengunggah foto asli (brief), seller mengunggah hasil edit. Akses hanya untuk pihak di order tersebut.
- [ ] **Portofolio jasa:** gambar sebelum/sesudah, jumlah revisi, estimasi hari pengerjaan.
- [ ] **Halaman toko publik** per seller (`store_slug`).
- [ ] **Rating:** rata-rata dan jumlah ulasan per seller, balasan seller, ulasan hanya untuk order selesai.
- [ ] **Pencarian, filter, urutan, dan pagination** katalog.

### Operasional

- [ ] **Panel admin:** persetujuan QRIS seller, kelola user dan kategori, tangani sengketa.
- [ ] **Notifikasi:** Telegram bot ke grup seller/admin saat ada bukti bayar baru — sudah diimplementasikan sebagai notifikasi best-effort di `src/lib/telegram.ts` untuk verifikasi admin Jasa-in — serta email.
- [ ] **Riwayat status order** (audit) dan chat sederhana buyer–seller untuk revisi.
- [ ] **Tugas terjadwal** untuk menandai order kedaluwarsa (Supabase `pg_cron` atau Vercel Cron).
- [ ] **Halaman legal:** syarat layanan, kebijakan privasi, kebijakan refund.
- [ ] **Monitoring error** (mis. Sentry) dan pencatatan aksi penting.

### Rencana jangka panjang

- [ ] **Payment gateway resmi** (mis. Midtrans/Xendit) dengan penampungan dana (escrow) dan notifikasi pembayaran otomatis. Dibutuhkan saat transaksi mulai ramai, karena QRIS hasil modifikasi tidak memiliki webhook dan konfirmasinya manual.
- [ ] **Model monetisasi:** langganan bulanan seller dan/atau biaya platform (`platform_fee_idr` saat ini 0).
- [ ] **Hubungkan `jasa-in.my.id` ke Vercel** (DNS) setelah situs stabil.

---

## 6. Keputusan yang belum diambil

0. **Pembayaran (diputuskan 3 November 2026):** QRIS pusat milik Jasa-in, bukan QRIS per seller. Verifikasi oleh admin Jasa-in untuk sementara, payout ke seller manual untuk tahap ini.
1. **Stack final:** tetap Next.js + Supabase (repo saat ini), atau kembali ke PHP Native?
2. **Persetujuan seller:** langsung aktif setelah daftar, atau perlu disetujui admin? (Usulan: langsung aktif, tetapi QRIS wajib disetujui admin sebelum jasa tampil di katalog.)
3. **Satu jasa per order atau keranjang multi-jasa** untuk tahap pertama.
4. **Biaya platform:** gratis di awal, biaya per transaksi, atau langganan seller.
5. **Kebijakan sengketa dan refund** karena dana kini masuk ke Jasa-in (sebelumnya langsung ke seller) dan payout ke seller dilakukan manual untuk tahap ini.

---

## 7. Catatan teknis QRIS

- Hanya tag **01** (`11` → `12`), **54** (nominal) dan **63** (CRC16) yang diubah. Data merchant (tag 26–51, 59, 60) tidak disentuh.
- CRC16: CCITT-FALSE, polinomial `0x1021`, nilai awal `0xFFFF`. Vektor uji: `"123456789"` = `29B1`.
- Batas nominal: 1 sampai Rp10.000.000 per transaksi, bilangan bulat.
- Urutan tag dibangun ulang secara eksplisit (jangan memakai objek JavaScript biasa, karena kunci angka akan diurutkan ulang otomatis).
- Tidak ada ID transaksi di payload, sehingga pencocokan pembayaran memakai nominal + kode unik.
- QRIS hasil modifikasi **tidak punya notifikasi otomatis**. Seller memverifikasi pembayaran secara manual.
- Fungsi yang tersedia: `crc16`, `parseQrisTlv` (longgar, untuk tampilan), `validateQrisPayload` (statis atau dinamis), `validateStaticQrisPayload` (khusus statis), `makeDynamicQris`, `buildDummyStaticQris`.

---

## 8. Alur kerja agar tidak terulang

- Ekstrak ZIP perbaikan **tanpa menimpa folder secara buta**. Folder `src/lib/supabase/` dan `src/app/orders/` pernah kehilangan file karena penyalinan sebagian.
- Sebelum push: `npm run build`, lalu `git status` dan `git ls-files src` untuk memastikan semua file terlacak.
- Di Vercel, selalu cek baris `Commit:` pada log. Nomor yang sama berarti kode yang dibangun sama.
- Gunakan commit terpilih: `git add <file>` (beri tanda kutip untuk nama ber-kurung, mis. `"src/app/(auth)/actions.ts"`), lalu `git commit` dan `git push`.
- Jangan keluarkan `.env.local` dari git sebelum env di Vercel terisi.

---

## 9. Urutan pengerjaan yang disarankan

1. **Deploy hijau:** B1 → B4.
2. **Auth jalan end-to-end:** A5 (tinjau SQL) → A6 (RLS + trigger profil) → A7, A8 → A1–A4.
3. **Amankan alur order:** S1–S4, S7 (RPC order atomik).
4. **Alur pembayaran lengkap:** gambar QR, upload bukti bayar, kode unik, kedaluwarsa, persetujuan QRIS oleh admin (S5, S6).
5. **Keranjang dan checkout multi-seller.**
6. **Kategori dan portofolio edit foto**, halaman toko, rating.
7. **Notifikasi Telegram/email dan panel admin.**
8. **Perawatan:** pin dependency, `proxy.ts`, README, monitoring, halaman legal.
