# BloxMart.ID

Storefront digital gaming berbasis Next.js dengan katalog, autentikasi, panel developer, dan integrasi QRIS QiosPay yang diverifikasi melalui webhook. Pembayaran tetap harus diuji di sandbox sebelum dipakai di produksi.

## Menjalankan secara lokal

Prasyarat: Node.js 22+ dan database PostgreSQL terkelola (Supabase atau Neon direkomendasikan). Migrasi SQLite lama membutuhkan Node.js 24+.

```powershell
cd C:\Users\user\bloxmart
npm install
Copy-Item .env.example .env.local
# Edit .env.local dan isi DATABASE_URL dengan PostgreSQL lokal/hosted.
npm run dev
```

Buka `http://localhost:3000`. Skema PostgreSQL dibuat otomatis dan idempoten pada request server pertama. Untuk PostgreSQL lokal tanpa TLS, set `DATABASE_SSL=disable`. Webpack digunakan karena Turbopack tidak berjalan dengan binary SWC pada lingkungan Windows ini. Warning SWC native mungkin muncul; build dan server dapat berjalan memakai WASM fallback.

## Deploy ke Vercel + PostgreSQL

Vercel tidak menyediakan filesystem persisten. Karena itu seluruh data disimpan di PostgreSQL terkelola; tidak ada `.data/bloxmart.sqlite` yang dibaca saat runtime.

1. Buat project PostgreSQL di **Supabase** atau **Neon**. Salin **pooled connection string** (Supabase port `6543`, Neon host yang mengandung `-pooler`) dan pastikan memakai `sslmode=require`.
2. Import repository ini ke Vercel, lalu isi environment variables berikut untuk Production (dan Preview bila perlu):

   | Variabel | Wajib | Keterangan |
   | --- | --- | --- |
   | `DATABASE_URL` | Ya | Connection string PostgreSQL pooled. Hanya server. |
   | `NEXT_PUBLIC_SITE_URL` | Ya | `https://domain-anda.example`, tanpa trailing slash. |
   | `QIOSPAY_BASE_URL` | Ya | Default `https://my.qiospay.com/v1`. |
   | `QIOSPAY_API_KEY` | Untuk pembayaran | API key QiosPay, hanya server. |
   | `QIOSPAY_PRIVATE_KEY` | Untuk pembayaran | Private key HMAC webhook, hanya server. |
   | `DATABASE_POOL_MAX` | Tidak | Default `5`; sesuaikan dengan batas provider. |
   | `DATABASE_SSL` | Tidak | Set `disable` hanya untuk PostgreSQL lokal tanpa TLS. |

3. Deploy. Pada request server pertama, aplikasi membuat skema dengan `CREATE TABLE IF NOT EXISTS` di bawah advisory lock PostgreSQL sehingga aman ketika beberapa instance Vercel mulai bersamaan. Cek `GET /api/catalog` untuk memastikan koneksi dan seed katalog berhasil.
4. Daftarkan akun melalui `/register`, lalu jalankan `npm run admin -- grant email-anda@example.com` dari terminal yang memiliki `DATABASE_URL` sama (ambil nilainya dari dashboard Vercel/Supabase/Neon).
5. Daftarkan callback QiosPay di dashboard QiosPay: `https://domain-anda.example/api/payments/qiospay/webhook`. Return URL: `https://domain-anda.example/checkout/return`.

Jangan memakai SQLite atau penyimpanan file lokal untuk sesi, katalog, order, atau pembayaran di Vercel. Setiap instance serverless dapat berhenti kapan saja, dan perubahan file lokal akan hilang.

## Migrasi data SQLite lama (opsional)

Jika sebelumnya sudah ada akun/katalog di `.data/bloxmart.sqlite` dan ingin mempertahankannya, salin datanya ke PostgreSQL **sebelum** memakai database production secara publik. Script membaca SQLite sebagai read-only dan tidak menimpa baris PostgreSQL yang sudah ada.

```powershell
# Prasyarat: Node.js 24+ (modul node:sqlite) dan DATABASE_URL yang sudah diisi.
npm run migrate:sqlite -- --dry-run
npm run migrate:sqlite
```

Data yang disalin: users, sesi aktif, rate limit, kategori, produk, penanda seed katalog, audit log, order, order item, dan payment event. Penanda `catalog_meta` ikut disalin agar produk demo yang sudah dihapus tidak muncul kembali. Backup database SQLite dan PostgreSQL sebelum migrasi.

## Link publik dan domain

Mengubah nama toko menjadi **BloxMart.ID tidak otomatis mendaftarkan domain `bloxmart.id` atau membuat link publik**. `localhost` hanya bisa diakses dari komputer sendiri. `192.168.x.x` hanya untuk perangkat dalam jaringan Wi-Fi yang sama, **bukan link publik**.

Untuk alamat publik yang benar:

1. Selesaikan deployment **Vercel + PostgreSQL** seperti pada bagian di atas, termasuk mengisi `DATABASE_URL` dan `NEXT_PUBLIC_SITE_URL`.
2. Hubungkan DNS domain ke Vercel sesuai petunjuk penyedia, lalu aktifkan HTTPS.
3. Buka alamat HTTPS dari perangkat lain dan pastikan `/api/catalog`, `/login`, serta `/developer` berjalan.
4. **Jangan mengumumkan situs sebagai toko aktif** sebelum pembayaran, order server-side, stok, kebijakan, dan keamanan produksi selesai.

Tidak ada domain atau akun hosting yang terhubung dalam project ini, jadi belum tersedia link internet publik. Jangan mengarahkan pengguna ke `http://BloxMart.Id` sebelum kepemilikan dan deployment domain benar-benar diverifikasi.

## Akun

- Daftar: `/register`, nama, email unik, password minimal 10 karakter.
- Masuk: `/login`, menggunakan email dan password yang didaftarkan.
- Akun: `/account` (hanya untuk pengguna yang masuk).
- Keluar: tombol pada `/account`.

Data akun, sesi, katalog, audit, order, dan payment event disimpan di PostgreSQL melalui `DATABASE_URL`. Password di-hash dengan `scrypt` + salt acak; cookie sesi HTTP-only, SameSite Lax, Secure di luar localhost. Pendaftaran selalu berperan `customer`; tidak ada akun admin bawaan. Rate limit untuk daftar/login disimpan di PostgreSQL.

## Developer panel: katalog, produk, dan harga

Panel developer tersedia di `/developer` dan hanya dapat dibuka oleh akun dengan role `admin`.

1. Pastikan `.env.local` sudah berisi `DATABASE_URL` (lihat `.env.example`):

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. **Tidak ada variabel email admin dan tidak ada password admin default.** Role admin hanya dapat diberikan pemilik database memakai CLI `npm run admin`, yang terhubung ke `DATABASE_URL`; tidak ada jalur elevasi role melalui form pendaftaran.

3. Jalankan server dan daftar akun biasa:

   ```powershell
   npm run dev
   ```

4. Buka `/register` dan daftar akun. Password tetap harus minimal 10 karakter.
5. Hentikan server, lalu berikan role admin dari terminal lokal:

   ```powershell
   npm run admin -- grant alamat-email-kamu@example.com
   ```

   Perintah ini harus dijalankan pemilik mesin/server. Perubahan dicatat di `admin_audit_logs`. Untuk mencabut akses:

   ```powershell
   npm run admin -- revoke alamat-email-kamu@example.com
   ```

6. Jalankan server lagi, masuk melalui `/login`, buka `/account`, lalu klik **Buka developer panel**. Kamu juga dapat membuka `/developer` langsung.

Fitur developer:

- Menambah kategori katalog.
- Menghapus kategori secara permanen sekaligus seluruh produk di dalamnya (termasuk produk nonaktif) dalam satu transaksi.
- Menambah produk.
- Mengedit nama, kategori, deskripsi, harga normal, harga promo, stok, status aktif, dan produk unggulan.
- Stok kosong berarti unlimited; stok `0` berarti habis.
- Menghapus produk secara permanen setelah konfirmasi. Data hilang dari katalog dan daftar admin; tidak ada fitur pemulihan.
- Validasi nama, harga, harga promo, stok, dan role dilakukan di server menggunakan Zod.
- Data demo di-seed sekali ke PostgreSQL saat endpoint katalog pertama kali dipanggil.

Menghapus kategori dari panel developer sekarang juga menghapus seluruh produk di kategori tersebut dalam satu transaksi. Produk akan hilang dari `/api/catalog` dan storefront; setiap penghapusan kategori dan produk dicatat di `admin_audit_logs`. Katalog demo hanya di-seed sekali; produk yang sudah dihapus tidak muncul kembali otomatis. Simpan backup database sebelum menghapus data penting.

Jangan commit `.env.local`, membagikan password, atau memberikan akses terminal server kepada orang lain. Jika akun developer sudah memiliki sesi aktif saat role berubah, keluar lalu masuk kembali agar role sesi diperbarui.

## Pembayaran QRIS dan QiosPay

Homepage dan `/checkout` hanya menampilkan QRIS. Endpoint server yang disiapkan:

- `POST /api/payments/qiospay` — membuat invoice QiosPay. Wajib login, order harus milik user tersebut, berstatus `pending`, dan belum punya invoice. Mengembalikan `503` jika kredensial QiosPay belum diisi.
- `POST /api/payments/qiospay/webhook` — callback URL untuk QiosPay, memverifikasi raw-body HMAC, replay window, order ID, nominal, dan event sebelum mengubah status order.
- `/checkout/return` — return URL yang hanya menampilkan status **menunggu verifikasi**; redirect tidak pernah dianggap sebagai pembayaran berhasil.
- `GET /api/payments/qiospay` — menampilkan callback dan return URL berdasarkan `NEXT_PUBLIC_SITE_URL`.

Konfigurasi default memakai `https://my.qiospay.com/v1` melalui `QIOSPAY_BASE_URL`. Dokumentasi QiosPay yang tersedia mengonfirmasi `POST /v1/invoices`, header `x-api-key`, body invoice, dan HMAC-SHA256 webhook dengan `X-QiosPay-Signature: t=...,v1=...`. Isi `NEXT_PUBLIC_SITE_URL` dengan domain HTTPS BloxMart yang benar-benar dipublikasikan, bukan localhost. Isi `QIOSPAY_API_KEY` dan `QIOSPAY_PRIVATE_KEY` hanya di server. Adapter disabled jika kredensial belum ada; order harus sudah dibuat server-side dan dimiliki user sebelum invoice dibuat.

Sebelum produksi, implementasikan berdasarkan dokumentasi QiosPay: pembuatan transaksi server-side dari harga/stok database, QR/redirect resmi, verifikasi signature webhook, verifikasi order ID/nominal/currency, idempotency, audit event, dan pengujian sandbox. Jangan menaruh secret provider di frontend.

Halaman `/checkout` masih berupa pratinjau dan belum membuat order. Invoice QiosPay hanya dapat dibuat untuk order yang sudah ada di tabel `orders`; alur pembuatan order publik (harga dari database, stok, dan pengurangan stok) belum diimplementasikan. Jangan membuka pembayaran production sebelum alur tersebut selesai dan diuji.

## Validasi

```powershell
npm run lint
npm run build
```

Katalog demo awal berasal dari `src/lib/demo-products.ts`, tetapi endpoint publik memakai tabel katalog PostgreSQL setelah seed. Data tersebut **tidak boleh digunakan untuk menentukan harga transaksi nyata** sampai order dan payment flow server-side selesai.
